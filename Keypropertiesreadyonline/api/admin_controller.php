<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/response.php';
require_once __DIR__ . '/formatter.php';
require_once __DIR__ . '/auth.php';

class AdminController {
    public static function dashboard(): void {
        Auth::requirePermission('dashboard.view');

        $propertyStats = DB::queryOne("
            SELECT
                COUNT(*) AS total,
                SUM(publication_status = 'published') AS published,
                SUM(publication_status = 'draft') AS drafts,
                SUM(publication_status = 'unpublished') AS unpublished,
                SUM(publication_status = 'archived') AS archived,
                SUM(publication_status <> 'archived' AND purpose = 'sale') AS forSale,
                SUM(publication_status <> 'archived' AND purpose = 'rent') AS forRent,
                SUM(publication_status = 'published' AND purpose = 'sale' AND availability_status = 'available') AS liveForSale,
                SUM(publication_status = 'published' AND purpose = 'rent' AND availability_status = 'available') AS liveForRent,
                SUM(availability_status = 'sold') AS sold,
                SUM(availability_status = 'rented') AS rented
            FROM properties
        ");
        $properties = [];
        foreach (['total', 'published', 'drafts', 'unpublished', 'archived', 'forSale', 'forRent', 'liveForSale', 'liveForRent', 'sold', 'rented'] as $key) {
            $properties[$key] = (int)($propertyStats[$key] ?? 0);
        }

        $inquiries = array_fill_keys(['total', 'new', 'contacted', 'in_progress', 'converted', 'closed', 'followUpsDue'], 0);
        foreach (DB::query("SELECT status, COUNT(*) AS count FROM inquiries GROUP BY status") as $row) {
            $inquiries[$row['status']] = (int)$row['count'];
            $inquiries['total'] += (int)$row['count'];
        }
        $followUps = DB::queryOne("
            SELECT COUNT(*) AS count FROM inquiries
            WHERE follow_up_at IS NOT NULL AND follow_up_at <= NOW()
              AND status NOT IN ('converted', 'closed')
        ");
        $inquiries['followUpsDue'] = (int)($followUps['count'] ?? 0);

        $expiryWindowDays = 7;
        $campaignCounts = [
            'activeFeatured' => DB::queryOne("SELECT COUNT(*) AS count FROM featured_property_campaigns WHERE is_active = 1 AND start_at <= NOW() AND (end_at IS NULL OR end_at > NOW())"),
            'activeHotDeals' => DB::queryOne("SELECT COUNT(*) AS count FROM hot_deals WHERE status = 'active' AND start_at <= NOW() AND (end_at IS NULL OR end_at > NOW())"),
            'activeAdvertisements' => DB::queryOne("SELECT COUNT(*) AS count FROM advertisements WHERE status = 'active' AND start_at <= NOW() AND (end_at IS NULL OR end_at > NOW())"),
            'activePromotions' => DB::queryOne("SELECT COUNT(*) AS count FROM promotions WHERE status = 'active' AND start_at <= NOW() AND (end_at IS NULL OR end_at > NOW())"),
        ];
        foreach ($campaignCounts as $key => $row) {
            $campaignCounts[$key] = (int)($row['count'] ?? 0);
        }

        $expiryQueries = [
            ['featured', "SELECT f.id, COALESCE(NULLIF(f.label, ''), p.title) AS name, f.end_at AS endAt FROM featured_property_campaigns f JOIN properties p ON p.id = f.property_id WHERE f.is_active = 1 AND f.start_at <= NOW() AND f.end_at > NOW() AND f.end_at <= DATE_ADD(NOW(), INTERVAL {$expiryWindowDays} DAY)"],
            ['hot_deal', "SELECT id, title AS name, end_at AS endAt FROM hot_deals WHERE status = 'active' AND start_at <= NOW() AND end_at > NOW() AND end_at <= DATE_ADD(NOW(), INTERVAL {$expiryWindowDays} DAY)"],
            ['advertisement', "SELECT id, internal_name AS name, end_at AS endAt FROM advertisements WHERE status = 'active' AND start_at <= NOW() AND end_at > NOW() AND end_at <= DATE_ADD(NOW(), INTERVAL {$expiryWindowDays} DAY)"],
            ['promotion', "SELECT id, name, end_at AS endAt FROM promotions WHERE status = 'active' AND start_at <= NOW() AND end_at > NOW() AND end_at <= DATE_ADD(NOW(), INTERVAL {$expiryWindowDays} DAY)"],
        ];
        $expiringSoon = [];
        foreach ($expiryQueries as [$type, $sql]) {
            foreach (DB::query($sql) as $row) {
                $expiringSoon[] = [
                    'id' => (int)$row['id'],
                    'type' => $type,
                    'name' => $row['name'],
                    'endAt' => date('c', strtotime($row['endAt'])),
                ];
            }
        }
        usort($expiringSoon, fn($a, $b) => strtotime($a['endAt']) <=> strtotime($b['endAt']));

        $recentInquiries = array_map(function($row) {
            return [
                'id' => (int)$row['id'],
                'customerName' => $row['customer_name'],
                'status' => $row['status'],
                'createdAt' => date('c', strtotime($row['created_at'])),
                'property' => $row['property_id'] ? ['title' => $row['property_title']] : null,
            ];
        }, DB::query("
            SELECT i.id, i.customer_name, i.status, i.created_at, i.property_id, p.title AS property_title
            FROM inquiries i
            LEFT JOIN properties p ON p.id = i.property_id
            ORDER BY i.created_at DESC
            LIMIT 6
        "));

        Response::json([
            'properties' => $properties,
            'inquiries' => $inquiries,
            'campaigns' => $campaignCounts + [
                'expiringSoonCount' => count($expiringSoon),
                'expiryWindowDays' => $expiryWindowDays,
            ],
            'expiringSoon' => $expiringSoon,
            'recentInquiries' => $recentInquiries,
        ]);
    }

    public static function properties(): void {
        Auth::requirePermission('properties.view');

        $page = max(1, (int)($_GET['page'] ?? 1));
        $limit = max(1, min(100, (int)($_GET['limit'] ?? 20)));
        $offset = ($page - 1) * $limit;

        $where = ['1=1'];
        $params = [];

        if (!empty($_GET['status'])) {
            $where[] = "p.publication_status = ?";
            $params[] = $_GET['status'];
        }
        if (!empty($_GET['category'])) {
            $where[] = "c.slug = ?";
            $params[] = $_GET['category'];
        }
        if (!empty($_GET['purpose'])) {
            $where[] = "p.purpose = ?";
            $params[] = $_GET['purpose'];
        }
        if (!empty($_GET['search'])) {
            $term = '%' . trim($_GET['search']) . '%';
            $where[] = "(p.title LIKE ? OR p.reference LIKE ? OR p.neighborhood LIKE ?)";
            $params[] = $term;
            $params[] = $term;
            $params[] = $term;
        }

        $whereClause = implode(' AND ', $where);

        $countRow = DB::queryOne("
            SELECT COUNT(*) as total FROM properties p
            LEFT JOIN property_categories c ON p.category_id = c.id
            WHERE {$whereClause}
        ", $params);
        $total = (int) ($countRow['total'] ?? 0);

        $sql = "
            SELECT p.*,
                   c.name as category_name, c.slug as category_slug, c.type_group as category_type_group,
                   (SELECT file_path FROM property_images pi WHERE pi.property_id = p.id ORDER BY pi.sort_order ASC LIMIT 1) as main_image,
                   (SELECT COUNT(*) FROM property_images pi WHERE pi.property_id = p.id) as image_count
            FROM properties p
            LEFT JOIN property_categories c ON p.category_id = c.id
            WHERE {$whereClause}
            ORDER BY p.id DESC
            LIMIT {$limit} OFFSET {$offset}
        ";

        $rows = DB::query($sql, $params);
        $items = array_map(function($r) { return Formatter::formatProperty($r); }, $rows);

        Response::json($items, 200, [
            'total' => $total,
            'page' => $page,
            'limit' => $limit,
            'totalPages' => (int) ceil($total / $limit)
        ]);
    }

    public static function propertyGet(int $id): void {
        Auth::requirePermission('properties.view');

        $row = DB::queryOne("
            SELECT p.*,
                   c.name as category_name, c.slug as category_slug, c.type_group as category_type_group
            FROM properties p
            LEFT JOIN property_categories c ON p.category_id = c.id
            WHERE p.id = ?
        ", [$id]);

        if (!$row) {
            Response::error('Property not found', 'NOT_FOUND', 404);
        }

        $images = DB::query("SELECT * FROM property_images WHERE property_id = ? ORDER BY sort_order ASC, id ASC", [$id]);
        $amenities = DB::query("
            SELECT a.* FROM amenities a
            JOIN property_amenities pa ON a.id = pa.amenity_id
            WHERE pa.property_id = ?
            ORDER BY a.name ASC
        ", [$id]);

        Response::json(Formatter::formatProperty($row, $images, $amenities));
    }

    public static function propertyCreate(): void {
        $user = Auth::requirePermission('properties.create');
        Auth::verifyCsrf();
        $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;

        $title = trim($input['title'] ?? '');
        if ($title === '') {
            Response::error('Title is required', 'VALIDATION_ERROR', 422);
        }

        $slugBase = strtolower(trim(preg_replace('/[^A-Za-z0-9-]+/', '-', $title), '-'));
        $slug = $slugBase ?: 'prop-' . time();
        $check = DB::queryOne("SELECT id FROM properties WHERE slug = ?", [$slug]);
        if ($check) {
            $slug .= '-' . time();
        }

        $categoryId = !empty($input['categoryId']) ? (int)$input['categoryId'] : null;
        $purpose = $input['purpose'] ?? 'sale';
        $price = (float)($input['price'] ?? 0);
        $currency = $input['currency'] ?? 'RWF';
        $pricePeriod = $input['pricePeriod'] ?? null;
        $address = $input['address'] ?? null;
        $neighborhood = $input['neighborhood'] ?? null;
        $district = $input['district'] ?? null;
        $city = $input['city'] ?? null;
        $latitude = isset($input['latitude']) && $input['latitude'] !== '' ? (float)$input['latitude'] : null;
        $longitude = isset($input['longitude']) && $input['longitude'] !== '' ? (float)$input['longitude'] : null;
        $bedrooms = isset($input['bedrooms']) && $input['bedrooms'] !== '' ? (int)$input['bedrooms'] : null;
        $bathrooms = isset($input['bathrooms']) && $input['bathrooms'] !== '' ? (float)$input['bathrooms'] : null;
        $propertySize = isset($input['propertySize']) && $input['propertySize'] !== '' ? (float)$input['propertySize'] : null;
        $landSize = isset($input['landSize']) && $input['landSize'] !== '' ? (float)$input['landSize'] : null;
        $desc = $input['description'] ?? null;
        $specs = isset($input['specifications']) ? json_encode($input['specifications']) : null;
        $status = $input['publicationStatus'] ?? 'draft';

        DB::execute("
            INSERT INTO properties (
                title, slug, category_id, purpose, price, currency, price_period,
                address, neighborhood, district, city, latitude, longitude,
                bedrooms, bathrooms, property_size, land_size, description, specifications,
                publication_status, created_by, updated_by, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        ", [
            $title, $slug, $categoryId, $purpose, $price, $currency, $pricePeriod,
            $address, $neighborhood, $district, $city, $latitude, $longitude,
            $bedrooms, $bathrooms, $propertySize, $landSize, $desc, $specs,
            $status, $user['id'], $user['id']
        ]);

        $newId = DB::lastInsertId();
        $ref = 'KPR-' . str_pad((string)$newId, 5, '0', STR_PAD_LEFT);
        DB::execute("UPDATE properties SET reference = ? WHERE id = ?", [$ref, $newId]);

        // Amenities
        if (!empty($input['amenities']) && is_array($input['amenities'])) {
            foreach ($input['amenities'] as $aId) {
                DB::execute("INSERT IGNORE INTO property_amenities (property_id, amenity_id) VALUES (?, ?)", [$newId, (int)$aId]);
            }
        }

        Response::json(['id' => $newId, 'reference' => $ref, 'slug' => $slug], 201);
    }

    public static function propertyUpdate(int $id): void {
        $user = Auth::requirePermission('properties.edit');
        Auth::verifyCsrf();
        $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;

        $existing = DB::queryOne("SELECT id FROM properties WHERE id = ?", [$id]);
        if (!$existing) {
            Response::error('Property not found', 'NOT_FOUND', 404);
        }

        $fields = [];
        $params = [];

        $map = [
            'title' => 'title',
            'description' => 'description',
            'purpose' => 'purpose',
            'price' => 'price',
            'currency' => 'currency',
            'pricePeriod' => 'price_period',
            'address' => 'address',
            'neighborhood' => 'neighborhood',
            'district' => 'district',
            'city' => 'city',
            'latitude' => 'latitude',
            'longitude' => 'longitude',
            'bedrooms' => 'bedrooms',
            'bathrooms' => 'bathrooms',
            'propertySize' => 'property_size',
            'landSize' => 'land_size',
            'videoUrl' => 'video_url',
            'virtualTourUrl' => 'virtual_tour_url',
            'availabilityStatus' => 'availability_status',
            'publicationStatus' => 'publication_status'
        ];

        foreach ($map as $inKey => $col) {
            if (array_key_exists($inKey, $input)) {
                $fields[] = "`{$col}` = ?";
                $params[] = $input[$inKey] === '' ? null : $input[$inKey];
            }
        }

        if (array_key_exists('categoryId', $input)) {
            $fields[] = "`category_id` = ?";
            $params[] = !empty($input['categoryId']) ? (int)$input['categoryId'] : null;
        }

        if (array_key_exists('specifications', $input)) {
            $fields[] = "`specifications` = ?";
            $params[] = is_array($input['specifications']) ? json_encode($input['specifications']) : $input['specifications'];
        }

        if (!empty($fields)) {
            $fields[] = "`updated_by` = ?";
            $params[] = $user['id'];
            $params[] = $id;

            $sql = "UPDATE properties SET " . implode(', ', $fields) . ", updated_at = NOW() WHERE id = ?";
            DB::execute($sql, $params);
        }

        if (isset($input['amenities']) && is_array($input['amenities'])) {
            DB::execute("DELETE FROM property_amenities WHERE property_id = ?", [$id]);
            foreach ($input['amenities'] as $aId) {
                DB::execute("INSERT IGNORE INTO property_amenities (property_id, amenity_id) VALUES (?, ?)", [$id, (int)$aId]);
            }
        }

        Response::json(['message' => 'Property updated successfully']);
    }

    public static function propertyPublish(int $id): void {
        Auth::requirePermission('properties.publish');
        Auth::verifyCsrf();

        DB::execute("UPDATE properties SET publication_status = 'published', published_at = IFNULL(published_at, NOW()), updated_at = NOW() WHERE id = ?", [$id]);
        Response::json(['message' => 'Property published']);
    }

    public static function propertyUnpublish(int $id): void {
        Auth::requirePermission('properties.publish');
        Auth::verifyCsrf();

        DB::execute("UPDATE properties SET publication_status = 'draft', updated_at = NOW() WHERE id = ?", [$id]);
        Response::json(['message' => 'Property unpublished']);
    }

    public static function propertyArchive(int $id): void {
        Auth::requirePermission('properties.edit');
        Auth::verifyCsrf();

        DB::execute("UPDATE properties SET publication_status = 'archived', archived_at = NOW(), updated_at = NOW() WHERE id = ?", [$id]);
        Response::json(['message' => 'Property archived']);
    }

    public static function propertyRestore(int $id): void {
        Auth::requirePermission('properties.edit');
        Auth::verifyCsrf();

        DB::execute("UPDATE properties SET publication_status = 'draft', archived_at = NULL, updated_at = NOW() WHERE id = ?", [$id]);
        Response::json(['message' => 'Property restored']);
    }

    public static function amenities(): void {
        Auth::requireAuth();
        $items = DB::query("SELECT * FROM amenities ORDER BY name ASC");
        $data = array_map(function($a) {
            return [
                'id' => (int) $a['id'],
                'name' => $a['name'],
                'slug' => $a['slug'],
                'icon' => null,
                'category' => null,
            ];
        }, $items);
        Response::json($data);
    }

    public static function propertyOptions(): void {
        Auth::requireAnyPermission(['properties.view', 'featured.manage', 'hot_deals.create', 'promotions.create', 'advertisements.create']);
        $search = $_GET['q'] ?? $_GET['search'] ?? '';
        $where = "1=1";
        $params = [];
        if ($search !== '') {
            $where = "(p.title LIKE ? OR p.reference LIKE ?)";
            $term = '%' . $search . '%';
            $params = [$term, $term];
        }
        if (($_GET['promotable'] ?? '') === 'true') {
            $where .= " AND p.publication_status = 'published' AND p.availability_status = 'available'";
        }
        $limit = max(1, min(100, (int)($_GET['limit'] ?? 50)));
        $rows = DB::query("
            SELECT p.id, p.reference, p.title, p.slug, p.price, p.currency, p.price_period, p.purpose,
                   p.publication_status, p.availability_status,
                   (SELECT file_path FROM property_images pi WHERE pi.property_id = p.id ORDER BY pi.sort_order ASC LIMIT 1) as main_image
            FROM properties p
            WHERE {$where}
            ORDER BY p.title ASC
            LIMIT {$limit}
        ", $params);
        Response::json(array_map(function($row) {
            return [
                'id' => (int)$row['id'], 'reference' => $row['reference'], 'title' => $row['title'],
                'slug' => $row['slug'], 'price' => (float)$row['price'], 'currency' => $row['currency'],
                'pricePeriod' => $row['price_period'], 'purpose' => $row['purpose'],
                'publicationStatus' => $row['publication_status'], 'availabilityStatus' => $row['availability_status'],
                'mainImage' => self::imageUrl($row['main_image']),
            ];
        }, $rows));
    }

    public static function uploadImages(int $propertyId): void {
        Auth::requirePermission('properties.edit');

        if (empty($_FILES['images']) && empty($_FILES['image']) && empty($_FILES['file'])) {
            Response::error('No images uploaded', 'VALIDATION_ERROR', 400);
        }

        $files = $_FILES['images'] ?? $_FILES['image'] ?? $_FILES['file'];
        $uploadDir = dirname(__DIR__) . '/uploads/properties';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        $uploaded = [];
        $isMultiple = is_array($files['name']);
        $count = $isMultiple ? count($files['name']) : 1;

        for ($i = 0; $i < $count; $i++) {
            $name     = $isMultiple ? $files['name'][$i] : $files['name'];
            $tmpName  = $isMultiple ? $files['tmp_name'][$i] : $files['tmp_name'];
            $error    = $isMultiple ? $files['error'][$i] : $files['error'];
            $size     = $isMultiple ? $files['size'][$i] : $files['size'];
            $type     = $isMultiple ? $files['type'][$i] : $files['type'];

            if ($error !== UPLOAD_ERR_OK || !is_uploaded_file($tmpName)) continue;

            $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
            if (!in_array($ext, ['jpg', 'jpeg', 'png', 'webp', 'gif'])) continue;
            if ($size > 5 * 1024 * 1024) continue; // 5MB limit

            $fileName = uniqid('prop_' . $propertyId . '_', true) . '.' . $ext;
            $dest = $uploadDir . '/' . $fileName;

            if (move_uploaded_file($tmpName, $dest)) {
                $relPath = 'properties/' . $fileName;
                $maxSort = DB::queryOne("SELECT MAX(sort_order) as m FROM property_images WHERE property_id = ?", [$propertyId]);
                $nextSort = ($maxSort['m'] !== null) ? ((int)$maxSort['m'] + 1) : 0;

                DB::execute("
                    INSERT INTO property_images (property_id, file_path, original_name, mime_type, size_bytes, sort_order, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, NOW())
                ", [$propertyId, $relPath, $name, $type, $size, $nextSort]);

                $uploaded[] = [
                    'id' => DB::lastInsertId(),
                    'filePath' => $relPath,
                    'originalName' => $name,
                    'sortOrder' => $nextSort
                ];
            }
        }

        Response::json(['images' => $uploaded]);
    }

    public static function deleteImage(int $propertyId, int $imageId): void {
        Auth::requirePermission('properties.edit');
        Auth::verifyCsrf();

        $img = DB::queryOne("SELECT file_path FROM property_images WHERE id = ? AND property_id = ?", [$imageId, $propertyId]);
        if ($img) {
            $fullPath = dirname(__DIR__) . '/uploads/' . $img['file_path'];
            if (file_exists($fullPath)) unlink($fullPath);
            DB::execute("DELETE FROM property_images WHERE id = ?", [$imageId]);
        }
        Response::json(['message' => 'Image deleted']);
    }

    public static function reorderImages(int $propertyId): void {
        Auth::requirePermission('properties.edit');
        Auth::verifyCsrf();
        $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        $order = $input['order'] ?? $input['imageIds'] ?? [];
        foreach ($order as $i => $imageId) {
            DB::execute("UPDATE property_images SET sort_order = ? WHERE id = ? AND property_id = ?", [$i, (int)$imageId, $propertyId]);
        }
        Response::json(['message' => 'Images reordered']);
    }

    public static function updateImage(int $propertyId, int $imageId): void {
        Auth::requirePermission('properties.edit');
        Auth::verifyCsrf();
        $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        if (isset($input['altText'])) {
            DB::execute("UPDATE property_images SET alt_text = ? WHERE id = ? AND property_id = ?", [$input['altText'], $imageId, $propertyId]);
        }
        Response::json(['message' => 'Image updated']);
    }

    public static function inquiries(): void {
        Auth::requirePermission('inquiries.view');

        $page = max(1, (int)($_GET['page'] ?? 1));
        $limit = max(1, min(100, (int)($_GET['limit'] ?? 20)));
        $offset = ($page - 1) * $limit;

        $where = ['1=1'];
        $params = [];

        if (!empty($_GET['status'])) {
            $where[] = "i.status = ?";
            $params[] = $_GET['status'];
        }
        if (!empty($_GET['assignedTo'])) {
            $where[] = 'i.assigned_to = ?';
            $params[] = (int)$_GET['assignedTo'];
        }
        if (($_GET['followUpDue'] ?? '') === 'true') {
            $where[] = "i.follow_up_at IS NOT NULL AND i.follow_up_at <= NOW() AND i.status NOT IN ('converted', 'closed')";
        }
        if (!empty($_GET['search'])) {
            $term = '%' . trim($_GET['search']) . '%';
            $where[] = "(i.customer_name LIKE ? OR i.email LIKE ? OR i.phone LIKE ?)";
            $params[] = $term;
            $params[] = $term;
            $params[] = $term;
        }

        $whereClause = implode(' AND ', $where);
        $countRow = DB::queryOne("SELECT COUNT(*) as total FROM inquiries i WHERE {$whereClause}", $params);
        $total = (int) ($countRow['total'] ?? 0);

        $sql = "
            SELECT i.*, p.title as property_title, p.reference as property_reference, p.slug as property_slug,
                   u.full_name AS assigned_name
            FROM inquiries i
            LEFT JOIN properties p ON i.property_id = p.id
            LEFT JOIN users u ON i.assigned_to = u.id
            WHERE {$whereClause}
            ORDER BY i.id DESC
            LIMIT {$limit} OFFSET {$offset}
        ";

        $rows = DB::query($sql, $params);
        $data = array_map(function($r) {
            return [
                'id' => (int) $r['id'],
                'propertyId' => $r['property_id'] ? (int)$r['property_id'] : null,
                'propertyReference' => $r['property_reference'],
                'propertyTitle' => $r['property_title'],
                'propertySlug' => $r['property_slug'],
                'property' => $r['property_id'] ? [
                    'id' => (int)$r['property_id'], 'title' => $r['property_title'],
                    'reference' => $r['property_reference'], 'slug' => $r['property_slug'],
                ] : null,
                'customerName' => $r['customer_name'],
                'fullName' => $r['customer_name'],
                'email' => $r['email'],
                'phone' => $r['phone'],
                'message' => $r['message'],
                'preferredContact' => $r['preferred_contact'],
                'status' => $r['status'],
                'source' => $r['source'],
                'assignedTo' => $r['assigned_to'] ? ['id' => (int)$r['assigned_to'], 'fullName' => $r['assigned_name']] : null,
                'followUpAt' => $r['follow_up_at'] ? date('c', strtotime($r['follow_up_at'])) : null,
                'contactedAt' => $r['contacted_at'] ? date('c', strtotime($r['contacted_at'])) : null,
                'closedAt' => $r['closed_at'] ? date('c', strtotime($r['closed_at'])) : null,
                'createdAt' => $r['created_at'] ? date('c', strtotime($r['created_at'])) : null,
                'updatedAt' => $r['updated_at'] ? date('c', strtotime($r['updated_at'])) : null,
            ];
        }, $rows);

        Response::json($data, 200, [
            'total' => $total,
            'page' => $page,
            'limit' => $limit,
            'totalPages' => (int) ceil($total / $limit)
        ]);
    }

    public static function inquiryGet(int $id): void {
        Auth::requirePermission('inquiries.view');
        $row = DB::queryOne("
            SELECT i.*, p.title as property_title, p.reference as property_reference, p.slug as property_slug,
                   u.full_name AS assigned_name, a.internal_name AS advertisement_name,
                   pr.name AS promotion_name, hd.title AS hot_deal_title
            FROM inquiries i
            LEFT JOIN properties p ON i.property_id = p.id
            LEFT JOIN users u ON i.assigned_to = u.id
            LEFT JOIN advertisements a ON i.advertisement_id = a.id
            LEFT JOIN promotions pr ON i.promotion_id = pr.id
            LEFT JOIN hot_deals hd ON i.hot_deal_id = hd.id
            WHERE i.id = ?
        ", [$id]);
        if (!$row) {
            Response::error('Inquiry not found', 'NOT_FOUND', 404);
        }

        $notes = DB::query("
            SELECT n.id, n.note, n.created_at, u.full_name AS author_name
            FROM inquiry_notes n
            LEFT JOIN users u ON n.user_id = u.id
            WHERE n.inquiry_id = ?
            ORDER BY n.created_at DESC
        ", [$id]);
        $notes = array_map(fn($note) => [
            'id' => (int)$note['id'],
            'note' => $note['note'],
            'author' => $note['author_name'] ? ['fullName' => $note['author_name']] : null,
            'createdAt' => date('c', strtotime($note['created_at'])),
        ], $notes);

        $data = [
            'id' => (int) $row['id'],
            'propertyId' => $row['property_id'] ? (int)$row['property_id'] : null,
            'propertyReference' => $row['property_reference'],
            'propertyTitle' => $row['property_title'],
            'propertySlug' => $row['property_slug'],
            'property' => $row['property_id'] ? [
                'id' => (int)$row['property_id'], 'title' => $row['property_title'],
                'reference' => $row['property_reference'], 'slug' => $row['property_slug'],
            ] : null,
            'attribution' => [
                'advertisementId' => $row['advertisement_id'] ? (int)$row['advertisement_id'] : null,
                'advertisementName' => $row['advertisement_name'],
                'promotionId' => $row['promotion_id'] ? (int)$row['promotion_id'] : null,
                'promotionName' => $row['promotion_name'],
                'hotDealId' => $row['hot_deal_id'] ? (int)$row['hot_deal_id'] : null,
                'hotDealTitle' => $row['hot_deal_title'],
            ],
            'customerName' => $row['customer_name'],
            'fullName' => $row['customer_name'],
            'email' => $row['email'],
            'phone' => $row['phone'],
            'message' => $row['message'],
            'preferredContact' => $row['preferred_contact'],
            'status' => $row['status'],
            'source' => $row['source'],
            'assignedTo' => $row['assigned_to'] ? ['id' => (int)$row['assigned_to'], 'fullName' => $row['assigned_name']] : null,
            'followUpAt' => $row['follow_up_at'] ? date('c', strtotime($row['follow_up_at'])) : null,
            'contactedAt' => $row['contacted_at'] ? date('c', strtotime($row['contacted_at'])) : null,
            'closedAt' => $row['closed_at'] ? date('c', strtotime($row['closed_at'])) : null,
            'createdAt' => $row['created_at'] ? date('c', strtotime($row['created_at'])) : null,
            'updatedAt' => $row['updated_at'] ? date('c', strtotime($row['updated_at'])) : null,
            'notes' => $notes,
        ];

        Response::json($data);
    }

    public static function inquiryUpdate(int $id): void {
        Auth::requirePermission('inquiries.manage');
        Auth::verifyCsrf();
        $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;

        $fields = [];
        $params = [];

        if (isset($input['status'])) {
            if (!in_array($input['status'], ['new', 'contacted', 'in_progress', 'converted', 'closed'], true)) {
                Response::error('Invalid inquiry status', 'VALIDATION_ERROR', 422);
            }
            $fields[] = "status = ?";
            $params[] = $input['status'];
        }
        if (array_key_exists('assignedTo', $input)) { $fields[] = "assigned_to = ?"; $params[] = $input['assignedTo'] ? (int)$input['assignedTo'] : null; }
        if (array_key_exists('followUpAt', $input)) { $fields[] = "follow_up_at = ?"; $params[] = self::sqlDateTime($input['followUpAt'], 'followUpAt'); }
        if (isset($input['status']) && $input['status'] === 'contacted') { $fields[] = "contacted_at = IFNULL(contacted_at, NOW())"; }
        if (isset($input['status']) && $input['status'] === 'closed') { $fields[] = "closed_at = IFNULL(closed_at, NOW())"; }

        if (!empty($fields)) {
            $params[] = $id;
            DB::execute("UPDATE inquiries SET " . implode(', ', $fields) . ", updated_at = NOW() WHERE id = ?", $params);
        }
        Response::json(['message' => 'Inquiry updated']);
    }

    public static function inquiryAddNote(int $id): void {
        $user = Auth::requirePermission('inquiries.manage');
        Auth::verifyCsrf();
        $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        $body = trim($input['body'] ?? $input['note'] ?? '');
        if ($body === '') {
            Response::error('Note body is required', 'VALIDATION_ERROR', 422);
        }
        DB::execute("INSERT INTO inquiry_notes (inquiry_id, note, user_id, created_at) VALUES (?, ?, ?, NOW())", [$id, $body, $user['id']]);
        Response::json(['message' => 'Note added'], 201);
    }

    public static function inquiryStaff(): void {
        Auth::requirePermission('inquiries.view');
        $rows = DB::query("SELECT id, full_name FROM users WHERE status = 'active' ORDER BY full_name");
        Response::json(array_map(fn($r) => ['id' => (int)$r['id'], 'fullName' => $r['full_name']], $rows));
    }

    private static function pageMeta(int $total, int $page, int $limit): array {
        return ['total' => $total, 'page' => $page, 'limit' => $limit, 'totalPages' => (int)ceil($total / $limit)];
    }

    private static function imageUrl(?string $path): ?string {
        if (!$path || str_starts_with($path, 'http') || str_starts_with($path, '/')) return $path;
        return '/uploads/' . $path;
    }

    public static function uploadCampaignImage(): void {
        $folder = $_GET['folder'] ?? '';
        $permissions = [
            'advertisements' => 'advertisements.create',
            'promotions' => 'promotions.create',
            'hero' => 'content.manage',
        ];
        if (!isset($permissions[$folder])) Response::error('Unsupported image folder', 'VALIDATION_ERROR', 422);
        Auth::requirePermission($permissions[$folder]);
        Auth::verifyCsrf();
        $file = $_FILES['image'] ?? null;
        if (!$file || $file['error'] !== UPLOAD_ERR_OK) Response::error('Choose an image to upload', 'VALIDATION_ERROR', 422);
        if ($file['size'] > 8 * 1024 * 1024) Response::error('Image must be 8 MB or smaller', 'VALIDATION_ERROR', 422);
        $image = @getimagesize($file['tmp_name']);
        $extensions = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
        if (!$image || !isset($extensions[$image['mime']])) {
            Response::error('Only JPEG, PNG, and WebP images are supported', 'VALIDATION_ERROR', 422);
        }
        $directory = dirname(__DIR__) . '/uploads/' . $folder;
        if (!is_dir($directory) && !mkdir($directory, 0755, true) && !is_dir($directory)) {
            Response::error('Unable to create the image upload directory', 'UPLOAD_ERROR', 500);
        }
        $fileName = bin2hex(random_bytes(16)) . '.' . $extensions[$image['mime']];
        $relativePath = $folder . '/' . $fileName;
        if (!move_uploaded_file($file['tmp_name'], $directory . '/' . $fileName)) {
            Response::error('Unable to save the uploaded image', 'UPLOAD_ERROR', 500);
        }
        Response::json(['path' => $relativePath, 'url' => '/uploads/' . $relativePath], 201);
    }

    private static function sqlDateTime(?string $value, string $field = 'date'): ?string {
        if ($value === null || $value === '') return null;
        try {
            return (new DateTimeImmutable($value))->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
        } catch (Throwable $e) {
            Response::error("Invalid {$field}", 'VALIDATION_ERROR', 422, [['path' => $field, 'message' => "Invalid {$field}"]]);
        }
    }

    private static function adminProperty(int $id): ?array {
        $row = DB::queryOne("
            SELECT p.id, p.title, p.reference, p.slug, p.price, p.currency, p.price_period,
                   p.purpose, p.district, p.city, p.neighborhood, p.bedrooms, p.bathrooms,
                   p.publication_status, p.availability_status,
                   (SELECT file_path FROM property_images pi WHERE pi.property_id = p.id ORDER BY pi.sort_order, pi.id LIMIT 1) AS main_image
            FROM properties p WHERE p.id = ?
        ", [$id]);
        if (!$row) return null;
        return [
            'id' => (int)$row['id'], 'title' => $row['title'], 'reference' => $row['reference'],
            'slug' => $row['slug'], 'price' => (float)$row['price'], 'currency' => $row['currency'],
            'pricePeriod' => $row['price_period'], 'purpose' => $row['purpose'],
            'district' => $row['district'], 'city' => $row['city'], 'neighborhood' => $row['neighborhood'],
            'bedrooms' => $row['bedrooms'] === null ? null : (int)$row['bedrooms'],
            'bathrooms' => $row['bathrooms'] === null ? null : (float)$row['bathrooms'],
            'publicationStatus' => $row['publication_status'], 'availabilityStatus' => $row['availability_status'],
            'mainImage' => self::imageUrl($row['main_image']),
        ];
    }

    private static function adminAdvertisement(array $r): array {
        return [
            'id' => (int)$r['id'], 'internalName' => $r['internal_name'], 'headline' => $r['headline'],
            'description' => $r['description'], 'desktopImage' => self::imageUrl($r['desktop_image']),
            'mobileImage' => self::imageUrl($r['mobile_image']), 'desktopImagePath' => $r['desktop_image'],
            'mobileImagePath' => $r['mobile_image'], 'destinationUrl' => $r['destination_url'],
            'property' => $r['property_id'] ? self::adminProperty((int)$r['property_id']) : null,
            'placement' => ['id' => (int)$r['placement_id'], 'slug' => $r['placement_slug'], 'name' => $r['placement_name']],
            'startAt' => $r['start_at'] ? date('c', strtotime($r['start_at'])) : null,
            'endAt' => $r['end_at'] ? date('c', strtotime($r['end_at'])) : null,
            'displayOrder' => (int)$r['display_order'], 'status' => $r['status'],
            'createdAt' => $r['created_at'] ? date('c', strtotime($r['created_at'])) : null,
            'updatedAt' => $r['updated_at'] ? date('c', strtotime($r['updated_at'])) : null,
        ];
    }

    private static function adminPromotion(array $r, bool $includeProperties = false): array {
        $data = [
            'id' => (int)$r['id'], 'name' => $r['name'], 'slug' => $r['slug'], 'description' => $r['description'],
            'bannerImage' => self::imageUrl($r['banner_image']), 'bannerImagePath' => $r['banner_image'],
            'campaignType' => $r['campaign_type'],
            'category' => $r['category_id'] ? ['id' => (int)$r['category_id'], 'name' => $r['category_name'], 'slug' => $r['category_slug']] : null,
            'placement' => $r['placement'], 'destinationUrl' => $r['destination_url'],
            'startAt' => $r['start_at'] ? date('c', strtotime($r['start_at'])) : null,
            'endAt' => $r['end_at'] ? date('c', strtotime($r['end_at'])) : null,
            'status' => $r['status'], 'displayOrder' => (int)$r['display_order'],
            'propertyCount' => isset($r['property_count']) ? (int)$r['property_count'] : 0,
            'createdAt' => $r['created_at'] ? date('c', strtotime($r['created_at'])) : null,
            'updatedAt' => $r['updated_at'] ? date('c', strtotime($r['updated_at'])) : null,
        ];
        if ($includeProperties) {
            $ids = DB::query("SELECT property_id FROM promotion_properties WHERE promotion_id = ? ORDER BY sort_order", [(int)$r['id']]);
            $data['properties'] = array_values(array_filter(array_map(fn($item) => self::adminProperty((int)$item['property_id']), $ids)));
        }
        return $data;
    }

    public static function advertisementPlacements(): void {
        Auth::requirePermission('advertisements.view');
        $rows = DB::query("SELECT id, slug, name, description, max_items FROM advertisement_placements WHERE is_active = 1 ORDER BY name");
        Response::json(array_map(fn($r) => [
            'id' => (int)$r['id'], 'slug' => $r['slug'], 'name' => $r['name'],
            'description' => $r['description'], 'maxItems' => (int)$r['max_items'],
        ], $rows));
    }

    public static function advertisements(): void {
        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            Auth::requirePermission('advertisements.view');
            $page = max(1, (int)($_GET['page'] ?? 1));
            $limit = max(1, min(100, (int)($_GET['limit'] ?? 20)));
            $where = ['1=1']; $params = [];
            foreach (['status' => 'a.status', 'placementId' => 'a.placement_id'] as $key => $column) {
                if (isset($_GET[$key]) && $_GET[$key] !== '') { $where[] = "{$column} = ?"; $params[] = $_GET[$key]; }
            }
            if (!empty($_GET['search'])) {
                $where[] = '(a.internal_name LIKE ? OR a.headline LIKE ?)';
                $term = '%' . trim($_GET['search']) . '%'; array_push($params, $term, $term);
            }
            $filter = implode(' AND ', $where);
            $total = (int)(DB::queryOne("SELECT COUNT(*) AS total FROM advertisements a WHERE {$filter}", $params)['total'] ?? 0);
            $rows = DB::query("
                SELECT a.*, pl.slug AS placement_slug, pl.name AS placement_name
                FROM advertisements a JOIN advertisement_placements pl ON pl.id = a.placement_id
                WHERE {$filter} ORDER BY a.updated_at DESC, a.id DESC LIMIT {$limit} OFFSET " . (($page - 1) * $limit), $params);
            Response::json(array_map([self::class, 'adminAdvertisement'], $rows), 200, self::pageMeta($total, $page, $limit));
        }
        $user = Auth::requirePermission('advertisements.create');
        Auth::verifyCsrf();
        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        if (isset($input['propertyIds']) && !is_array($input['propertyIds'])) Response::error('propertyIds must be an array', 'VALIDATION_ERROR', 422);
        foreach (['internalName', 'headline', 'placementId', 'startAt'] as $key) {
            if (empty($input[$key])) Response::error("{$key} is required", 'VALIDATION_ERROR', 422);
        }
        DB::execute(
            "INSERT INTO advertisements (internal_name, headline, description, desktop_image, mobile_image, destination_url, property_id, placement_id, start_at, end_at, display_order, status, created_by, updated_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)",
            [$input['internalName'], $input['headline'], $input['description'] ?? null, $input['desktopImage'] ?? null,
                $input['mobileImage'] ?? null, $input['destinationUrl'] ?? null, $input['propertyId'] ?: null,
                (int)$input['placementId'], self::sqlDateTime($input['startAt'], 'startAt'), self::sqlDateTime($input['endAt'] ?? null, 'endAt'), (int)($input['displayOrder'] ?? 0), $user['id'], $user['id']]
        );
        Response::json(['id' => DB::lastInsertId()], 201);
    }

    public static function advertisementGet(int $id): void {
        Auth::requirePermission('advertisements.view');
        $row = DB::queryOne("SELECT a.*, pl.slug AS placement_slug, pl.name AS placement_name FROM advertisements a JOIN advertisement_placements pl ON pl.id = a.placement_id WHERE a.id = ?", [$id]);
        if (!$row) Response::error('Advertisement not found', 'NOT_FOUND', 404);
        Response::json(self::adminAdvertisement($row));
    }

    public static function advertisementUpdate(int $id): void {
        $user = Auth::requirePermission('advertisements.create');
        Auth::verifyCsrf();
        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        $fields = [
            'internalName' => 'internal_name', 'headline' => 'headline', 'description' => 'description',
            'desktopImage' => 'desktop_image', 'mobileImage' => 'mobile_image', 'destinationUrl' => 'destination_url',
            'propertyId' => 'property_id', 'placementId' => 'placement_id', 'startAt' => 'start_at', 'endAt' => 'end_at',
            'displayOrder' => 'display_order',
        ];
        $sets = []; $values = [];
        foreach ($fields as $key => $column) if (array_key_exists($key, $input)) {
            $sets[] = "{$column} = ?"; $value = $input[$key];
            if (in_array($key, ['propertyId', 'placementId', 'displayOrder'], true)) $value = $value === '' ? null : (int)$value;
            if ($key === 'propertyId' && !$value) $value = null;
            if ($key === 'startAt' || $key === 'endAt') $value = self::sqlDateTime($value, $key);
            $values[] = $value;
        }
        if ($sets) { $values[] = $user['id']; $values[] = $id; DB::execute("UPDATE advertisements SET " . implode(', ', $sets) . ", updated_by = ?, updated_at = NOW() WHERE id = ?", $values); }
        self::advertisementGet($id);
    }

    public static function advertisementAction(int $id, string $action): void {
        $permission = in_array($action, ['archive', 'restore'], true) ? 'advertisements.archive' : 'advertisements.publish';
        $user = Auth::requirePermission($permission);
        Auth::verifyCsrf();
        $statuses = ['publish' => 'active', 'pause' => 'paused', 'archive' => 'archived', 'restore' => 'draft'];
        if (!isset($statuses[$action])) Response::error('Unsupported advertisement action', 'NOT_FOUND', 404);
        $status = $statuses[$action];
        if ($action === 'publish') {
            $row = DB::queryOne("SELECT start_at FROM advertisements WHERE id = ?", [$id]);
            if (!$row) Response::error('Advertisement not found', 'NOT_FOUND', 404);
            $status = strtotime($row['start_at']) > time() ? 'scheduled' : 'active';
        }
        DB::execute("UPDATE advertisements SET status = ?, updated_by = ?, updated_at = NOW() WHERE id = ?", [$status, $user['id'], $id]);
        Response::json(['id' => $id, 'status' => $status]);
    }

    public static function promotions(): void {
        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            Auth::requirePermission('promotions.view');
            $page = max(1, (int)($_GET['page'] ?? 1)); $limit = max(1, min(100, (int)($_GET['limit'] ?? 20)));
            $where = ['1=1']; $params = [];
            foreach (['status' => 'pr.status', 'campaignType' => 'pr.campaign_type'] as $key => $column) {
                if (!empty($_GET[$key])) { $where[] = "{$column} = ?"; $params[] = $_GET[$key]; }
            }
            if (!empty($_GET['search'])) { $where[] = 'pr.name LIKE ?'; $params[] = '%' . trim($_GET['search']) . '%'; }
            $filter = implode(' AND ', $where);
            $total = (int)(DB::queryOne("SELECT COUNT(*) AS total FROM promotions pr WHERE {$filter}", $params)['total'] ?? 0);
            $rows = DB::query("
                SELECT pr.*, c.name AS category_name, c.slug AS category_slug,
                    (SELECT COUNT(*) FROM promotion_properties pp WHERE pp.promotion_id = pr.id) AS property_count
                FROM promotions pr LEFT JOIN property_categories c ON c.id = pr.category_id
                WHERE {$filter} ORDER BY pr.updated_at DESC, pr.id DESC LIMIT {$limit} OFFSET " . (($page - 1) * $limit), $params);
            Response::json(array_map([self::class, 'adminPromotion'], $rows), 200, self::pageMeta($total, $page, $limit));
        }
        $user = Auth::requirePermission('promotions.create'); Auth::verifyCsrf();
        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        $name = trim($input['name'] ?? '');
        if ($name === '' || empty($input['startAt'])) Response::error('Name and startAt are required', 'VALIDATION_ERROR', 422);
        $slug = strtolower(trim(preg_replace('/[^A-Za-z0-9-]+/', '-', $name), '-')) . '-' . bin2hex(random_bytes(3));
        DB::execute(
            "INSERT INTO promotions (name, slug, description, banner_image, campaign_type, category_id, placement, destination_url, start_at, end_at, display_order, status, created_by, updated_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)",
            [$name, $slug, $input['description'] ?? null, $input['bannerImage'] ?? null, $input['campaignType'] ?? 'general',
                !empty($input['categoryId']) ? (int)$input['categoryId'] : null, $input['placement'] ?? 'promotions_page',
                $input['destinationUrl'] ?? null, self::sqlDateTime($input['startAt'], 'startAt'), self::sqlDateTime($input['endAt'] ?? null, 'endAt'), (int)($input['displayOrder'] ?? 0), $user['id'], $user['id']]
        );
        $id = DB::lastInsertId();
        self::replacePromotionProperties($id, $input['propertyIds'] ?? []);
        Response::json(['id' => $id], 201);
    }

    private static function replacePromotionProperties(int $id, array $propertyIds): void {
        DB::execute("DELETE FROM promotion_properties WHERE promotion_id = ?", [$id]);
        foreach (array_values(array_unique(array_map('intval', $propertyIds))) as $order => $propertyId) {
            if ($propertyId > 0) DB::execute("INSERT INTO promotion_properties (promotion_id, property_id, sort_order) VALUES (?, ?, ?)", [$id, $propertyId, $order]);
        }
    }

    public static function promotionGet(int $id): void {
        Auth::requirePermission('promotions.view');
        $row = DB::queryOne("
            SELECT pr.*, c.name AS category_name, c.slug AS category_slug,
                (SELECT COUNT(*) FROM promotion_properties pp WHERE pp.promotion_id = pr.id) AS property_count
            FROM promotions pr LEFT JOIN property_categories c ON c.id = pr.category_id WHERE pr.id = ?
        ", [$id]);
        if (!$row) Response::error('Promotion not found', 'NOT_FOUND', 404);
        Response::json(self::adminPromotion($row, true));
    }

    public static function promotionUpdate(int $id): void {
        $user = Auth::requirePermission('promotions.create'); Auth::verifyCsrf();
        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        $fields = [
            'name' => 'name', 'description' => 'description', 'bannerImage' => 'banner_image',
            'campaignType' => 'campaign_type', 'categoryId' => 'category_id', 'placement' => 'placement',
            'destinationUrl' => 'destination_url', 'startAt' => 'start_at', 'endAt' => 'end_at', 'displayOrder' => 'display_order',
        ];
        $sets = []; $values = [];
        foreach ($fields as $key => $column) if (array_key_exists($key, $input)) {
            $sets[] = "{$column} = ?"; $value = $input[$key];
            if ($key === 'categoryId') $value = $value ? (int)$value : null;
            if ($key === 'displayOrder') $value = (int)$value;
            if ($key === 'startAt' || $key === 'endAt') $value = self::sqlDateTime($value, $key);
            $values[] = $value;
        }
        if (isset($input['name'])) {
            $sets[] = 'slug = ?';
            $values[] = strtolower(trim(preg_replace('/[^A-Za-z0-9-]+/', '-', $input['name']), '-')) . '-' . bin2hex(random_bytes(3));
        }
        if ($sets) { $values[] = $user['id']; $values[] = $id; DB::execute("UPDATE promotions SET " . implode(', ', $sets) . ", updated_by = ?, updated_at = NOW() WHERE id = ?", $values); }
        if (isset($input['propertyIds']) && is_array($input['propertyIds'])) self::replacePromotionProperties($id, $input['propertyIds']);
        self::promotionGet($id);
    }

    public static function promotionAction(int $id, string $action): void {
        $permission = in_array($action, ['archive', 'restore'], true) ? 'promotions.archive' : 'promotions.publish';
        $user = Auth::requirePermission($permission); Auth::verifyCsrf();
        $statuses = ['publish' => 'active', 'pause' => 'paused', 'archive' => 'archived', 'restore' => 'draft'];
        if (!isset($statuses[$action])) Response::error('Unsupported promotion action', 'NOT_FOUND', 404);
        $status = $statuses[$action];
        if ($action === 'publish') {
            $row = DB::queryOne("SELECT start_at FROM promotions WHERE id = ?", [$id]);
            if (!$row) Response::error('Promotion not found', 'NOT_FOUND', 404);
            $status = strtotime($row['start_at']) > time() ? 'scheduled' : 'active';
        }
        DB::execute("UPDATE promotions SET status = ?, updated_by = ?, updated_at = NOW() WHERE id = ?", [$status, $user['id'], $id]);
        Response::json(['id' => $id, 'status' => $status]);
    }

    public static function featured(): void {
        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            Auth::requirePermission('featured.view');
            $page = max(1, (int)($_GET['page'] ?? 1)); $limit = max(1, min(100, (int)($_GET['limit'] ?? 20)));
            $where = ['1=1']; $params = [];
            switch ($_GET['state'] ?? '') {
                case 'live': $where[] = "f.is_active = 1 AND f.start_at <= NOW() AND (f.end_at IS NULL OR f.end_at > NOW()) AND p.publication_status = 'published' AND p.availability_status = 'available'"; break;
                case 'scheduled': $where[] = 'f.is_active = 1 AND f.start_at > NOW()'; break;
                case 'inactive': $where[] = 'f.is_active = 0'; break;
                case 'expired': $where[] = 'f.end_at IS NOT NULL AND f.end_at <= NOW()'; break;
            }
            $filter = implode(' AND ', $where);
            $total = (int)(DB::queryOne("SELECT COUNT(*) AS total FROM featured_property_campaigns f JOIN properties p ON p.id = f.property_id WHERE {$filter}")['total'] ?? 0);
            $rows = DB::query("
                SELECT f.*, p.title AS property_title, p.reference AS property_reference, p.slug AS property_slug,
                    p.publication_status, p.availability_status,
                    (f.is_active = 1 AND f.start_at <= NOW() AND (f.end_at IS NULL OR f.end_at > NOW()) AND p.publication_status = 'published' AND p.availability_status = 'available') AS is_live
                FROM featured_property_campaigns f JOIN properties p ON p.id = f.property_id
                WHERE {$filter} ORDER BY is_live DESC, f.display_order, f.id DESC
                LIMIT {$limit} OFFSET " . (($page - 1) * $limit));
            $data = array_map(fn($r) => [
                'id' => (int)$r['id'], 'propertyId' => (int)$r['property_id'],
                'property' => ['id' => (int)$r['property_id'], 'title' => $r['property_title'], 'reference' => $r['property_reference'],
                    'slug' => $r['property_slug'], 'publicationStatus' => $r['publication_status'], 'availabilityStatus' => $r['availability_status']],
                'label' => $r['label'], 'displayOrder' => (int)$r['display_order'],
                'startAt' => date('c', strtotime($r['start_at'])), 'endAt' => $r['end_at'] ? date('c', strtotime($r['end_at'])) : null,
                'isActive' => (bool)$r['is_active'], 'priorityInSearch' => (bool)$r['priority_in_search'], 'isLive' => (bool)$r['is_live'],
            ], $rows);
            Response::json($data, 200, self::pageMeta($total, $page, $limit));
        }
        $user = Auth::requirePermission('featured.manage'); Auth::verifyCsrf();
        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        if (empty($input['propertyId']) || empty($input['startAt'])) Response::error('propertyId and startAt are required', 'VALIDATION_ERROR', 422);
        DB::execute(
            "INSERT INTO featured_property_campaigns (property_id, label, display_order, start_at, end_at, is_active, priority_in_search, created_by, updated_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [(int)$input['propertyId'], $input['label'] ?? null, (int)($input['displayOrder'] ?? 0), self::sqlDateTime($input['startAt'], 'startAt'), self::sqlDateTime($input['endAt'] ?? null, 'endAt'),
                empty($input['isActive']) ? 0 : 1, empty($input['priorityInSearch']) ? 0 : 1, $user['id'], $user['id']]
        );
        Response::json(['id' => DB::lastInsertId()], 201);
    }

    public static function featuredUpdate(int $id): void {
        $user = Auth::requirePermission('featured.manage'); Auth::verifyCsrf();
        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        $fields = ['propertyId' => 'property_id', 'label' => 'label', 'displayOrder' => 'display_order', 'startAt' => 'start_at', 'endAt' => 'end_at', 'isActive' => 'is_active', 'priorityInSearch' => 'priority_in_search'];
        $sets = []; $values = [];
        foreach ($fields as $key => $column) if (array_key_exists($key, $input)) {
            $sets[] = "{$column} = ?";
            $value = $input[$key];
            if ($key === 'propertyId' || $key === 'displayOrder') $value = (int)$value;
            if ($key === 'isActive' || $key === 'priorityInSearch') $value = $value ? 1 : 0;
            if ($key === 'startAt' || $key === 'endAt') $value = self::sqlDateTime($value, $key);
            $values[] = $value;
        }
        if ($sets) { $values[] = $user['id']; $values[] = $id; DB::execute("UPDATE featured_property_campaigns SET " . implode(', ', $sets) . ", updated_by = ?, updated_at = NOW() WHERE id = ?", $values); }
        Response::json(['message' => 'Featured placement updated']);
    }

    public static function featuredAction(int $id, string $action): void {
        Auth::requirePermission('featured.manage'); Auth::verifyCsrf();
        if ($action === 'delete') {
            DB::execute("DELETE FROM featured_property_campaigns WHERE id = ?", [$id]);
        } elseif (in_array($action, ['activate', 'deactivate'], true)) {
            DB::execute("UPDATE featured_property_campaigns SET is_active = ?, updated_at = NOW() WHERE id = ?", [$action === 'activate' ? 1 : 0, $id]);
        } else {
            Response::error('Unsupported featured placement action', 'NOT_FOUND', 404);
        }
        Response::json(['message' => 'Featured placement updated']);
    }

    private static function hotDealRow(int $id): ?array {
        return DB::queryOne("
            SELECT d.*, p.reference AS property_reference, p.title AS property_title, p.slug AS property_slug,
                p.price AS property_price, p.currency AS property_currency, p.price_period AS property_price_period,
                p.purpose AS property_purpose, p.district, p.city, p.neighborhood, p.bedrooms, p.bathrooms,
                p.publication_status, p.availability_status,
                (SELECT pi.file_path FROM property_images pi WHERE pi.property_id = p.id ORDER BY pi.sort_order, pi.id LIMIT 1) AS main_image,
                (d.status IN ('scheduled','active') AND d.start_at <= NOW() AND d.end_at > NOW()
                    AND p.publication_status = 'published' AND p.availability_status = 'available') AS is_live
            FROM hot_deals d JOIN properties p ON p.id = d.property_id WHERE d.id = ?
        ", [$id]);
    }

    private static function formatHotDeal(array $r): array {
        return [
            'id' => (int)$r['id'], 'title' => $r['title'], 'description' => $r['description'],
            'property' => [
                'id' => (int)$r['property_id'], 'reference' => $r['property_reference'], 'title' => $r['property_title'],
                'slug' => $r['property_slug'], 'price' => (float)$r['property_price'], 'currency' => $r['property_currency'],
                'pricePeriod' => $r['property_price_period'], 'purpose' => $r['property_purpose'],
                'district' => $r['district'], 'city' => $r['city'], 'neighborhood' => $r['neighborhood'],
                'bedrooms' => $r['bedrooms'] === null ? null : (int)$r['bedrooms'],
                'bathrooms' => $r['bathrooms'] === null ? null : (float)$r['bathrooms'],
                'mainImage' => self::imageUrl($r['main_image']),
                'publicationStatus' => $r['publication_status'], 'availabilityStatus' => $r['availability_status'],
            ],
            'basePrice' => (float)$r['base_price'],
            'originalPrice' => $r['original_price'] === null ? null : (float)$r['original_price'],
            'originalPriceVerified' => (bool)$r['original_price_verified'],
            'originalPriceVerifiedAt' => $r['original_price_verified_at'] ? date('c', strtotime($r['original_price_verified_at'])) : null,
            'discountType' => $r['discount_type'], 'discountValue' => (float)$r['discount_value'],
            'promotionalPrice' => (float)$r['promotional_price'], 'discountAmount' => (float)$r['discount_amount'],
            'discountPercentage' => (float)$r['discount_percentage'], 'currency' => $r['currency'],
            'startAt' => date('c', strtotime($r['start_at'])), 'endAt' => date('c', strtotime($r['end_at'])),
            'status' => $r['status'], 'displayOrder' => (int)$r['display_order'], 'isLive' => (bool)$r['is_live'],
            'createdAt' => $r['created_at'] ? date('c', strtotime($r['created_at'])) : null,
            'updatedAt' => $r['updated_at'] ? date('c', strtotime($r['updated_at'])) : null,
        ];
    }

    private static function calculateHotDeal(float $basePrice, string $discountType, float $discountValue): array {
        if ($basePrice <= 0) Response::error('The base price must be greater than zero', 'VALIDATION_ERROR', 422, [['path' => 'originalPrice', 'message' => 'The base price must be greater than zero']]);
        if ($discountValue <= 0) Response::error('The discount must be greater than zero', 'VALIDATION_ERROR', 422, [['path' => 'discountValue', 'message' => 'The discount must be greater than zero']]);
        if ($discountType === 'percentage') {
            if ($discountValue >= 100) Response::error('A percentage discount must be below 100%', 'VALIDATION_ERROR', 422, [['path' => 'discountValue', 'message' => 'A percentage discount must be below 100%']]);
            $promotionalPrice = round($basePrice * (100 - $discountValue) / 100, 2);
        } elseif ($discountType === 'amount') {
            if ($discountValue >= $basePrice) Response::error('The discount amount must be smaller than the price', 'VALIDATION_ERROR', 422, [['path' => 'discountValue', 'message' => 'The discount amount must be smaller than the price']]);
            $promotionalPrice = round($basePrice - $discountValue, 2);
        } elseif ($discountType === 'fixed_price') {
            if ($discountValue >= $basePrice) Response::error('The promotional price must be lower than the base price', 'VALIDATION_ERROR', 422, [['path' => 'discountValue', 'message' => 'The promotional price must be lower than the base price']]);
            $promotionalPrice = round($discountValue, 2);
        } else {
            Response::error('Unknown discount type', 'VALIDATION_ERROR', 422, [['path' => 'discountType', 'message' => 'Unknown discount type']]);
        }
        if ($promotionalPrice <= 0) Response::error('The promotional price must be greater than zero', 'VALIDATION_ERROR', 422);
        $discountAmount = round($basePrice - $promotionalPrice, 2);
        return [
            'basePrice' => round($basePrice, 2), 'promotionalPrice' => $promotionalPrice,
            'discountAmount' => $discountAmount, 'discountPercentage' => round($discountAmount / $basePrice * 100, 2),
        ];
    }

    public static function hotDeals(): void {
        Auth::requirePermission('hot_deals.view');
        $page = max(1, (int)($_GET['page'] ?? 1)); $limit = max(1, min(100, (int)($_GET['limit'] ?? 20)));
        $where = ['1=1']; $params = [];
        if (!empty($_GET['status'])) {
            if ($_GET['status'] === 'live') {
                $where[] = "d.status IN ('scheduled','active') AND d.start_at <= NOW() AND d.end_at > NOW() AND p.publication_status = 'published' AND p.availability_status = 'available'";
            } else { $where[] = 'd.status = ?'; $params[] = $_GET['status']; }
        }
        if (!empty($_GET['propertyId'])) { $where[] = 'd.property_id = ?'; $params[] = (int)$_GET['propertyId']; }
        if (!empty($_GET['search'])) {
            $where[] = '(d.title LIKE ? OR p.title LIKE ? OR p.reference LIKE ?)';
            $term = '%' . trim($_GET['search']) . '%'; array_push($params, $term, $term, $term);
        }
        $filter = implode(' AND ', $where);
        $total = (int)(DB::queryOne("SELECT COUNT(*) AS total FROM hot_deals d JOIN properties p ON p.id = d.property_id WHERE {$filter}", $params)['total'] ?? 0);
        $rows = DB::query("
            SELECT d.id FROM hot_deals d JOIN properties p ON p.id = d.property_id
            WHERE {$filter} ORDER BY d.updated_at DESC, d.id DESC LIMIT {$limit} OFFSET " . (($page - 1) * $limit), $params);
        $items = array_map(function($r) { return self::formatHotDeal(self::hotDealRow((int)$r['id'])); }, $rows);
        Response::json($items, 200, self::pageMeta($total, $page, $limit));
    }

    public static function hotDealGet(int $id): void {
        Auth::requirePermission('hot_deals.view');
        $row = self::hotDealRow($id);
        if (!$row) Response::error('Hot deal not found', 'NOT_FOUND', 404);
        Response::json(self::formatHotDeal($row));
    }

    public static function hotDealCalculate(): void {
        Auth::requirePermission('hot_deals.create'); Auth::verifyCsrf();
        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        $property = DB::queryOne("SELECT price, currency FROM properties WHERE id = ?", [(int)($input['propertyId'] ?? 0)]);
        if (!$property) Response::error('Property does not exist', 'VALIDATION_ERROR', 422);
        $base = isset($input['originalPrice']) && $input['originalPrice'] !== '' && $input['originalPrice'] !== null
            ? (float)$input['originalPrice'] : (float)$property['price'];
        Response::json(self::calculateHotDeal($base, $input['discountType'] ?? '', (float)($input['discountValue'] ?? 0)) + [
            'currency' => $property['currency'], 'propertyPrice' => (float)$property['price'],
        ]);
    }

    private static function saveHotDeal(array $input, int $userId, ?int $id = null): int {
        $propertyId = (int)($input['propertyId'] ?? 0);
        $property = DB::queryOne("SELECT price, currency, publication_status FROM properties WHERE id = ?", [$propertyId]);
        if (!$property) Response::error('Property does not exist', 'VALIDATION_ERROR', 422, [['path' => 'propertyId', 'message' => 'Property does not exist']]);
        if ($property['publication_status'] === 'archived') Response::error('Archived properties cannot have deals', 'VALIDATION_ERROR', 422);
        $originalPrice = isset($input['originalPrice']) && $input['originalPrice'] !== '' ? (float)$input['originalPrice'] : null;
        $basePrice = $originalPrice ?? (float)$property['price'];
        $discountType = $input['discountType'] ?? '';
        $discountValue = (float)($input['discountValue'] ?? 0);
        $pricing = self::calculateHotDeal($basePrice, $discountType, $discountValue);
        $startAt = self::sqlDateTime($input['startAt'] ?? null, 'startAt');
        $endAt = self::sqlDateTime($input['endAt'] ?? null, 'endAt');
        if (!$startAt || !$endAt || strtotime($endAt) <= strtotime($startAt)) Response::error('End date must be after the start date', 'VALIDATION_ERROR', 422, [['path' => 'endAt', 'message' => 'End date must be after the start date']]);
        $existing = $id === null ? null : DB::queryOne("SELECT original_price, original_price_verified, original_price_verified_by, original_price_verified_at FROM hot_deals WHERE id = ?", [$id]);
        $originalPriceChanged = $existing && (
            ($existing['original_price'] === null) !== ($originalPrice === null)
            || ($existing['original_price'] !== null && $originalPrice !== null && (float)$existing['original_price'] !== $originalPrice)
        );
        $explicitVerification = array_key_exists('originalPriceVerified', $input);
        $verified = $originalPrice !== null && (
            ($explicitVerification && !empty($input['originalPriceVerified']))
            || (!$explicitVerification && $existing && (bool)$existing['original_price_verified'] && !$originalPriceChanged)
        );
        $verifiedBy = null; $verifiedAt = null;
        if ($verified) {
            if ($explicitVerification && !empty($input['originalPriceVerified']) && (!$existing || empty($existing['original_price_verified']) || $originalPriceChanged)) {
                $actor = Auth::requirePermission('hot_deals.verify_price');
                $verifiedBy = $actor['id'];
                $verifiedAt = date('Y-m-d H:i:s');
            } else {
                $verifiedBy = $existing ? ($existing['original_price_verified_by'] ?? null) : null;
                $verifiedAt = $existing ? ($existing['original_price_verified_at'] ?? null) : null;
            }
        }
        $values = [
            $propertyId, trim($input['title'] ?? ''), $input['description'] ?? null, $pricing['basePrice'], $originalPrice,
            $verified ? 1 : 0, $verifiedBy, $verifiedAt, $discountType, $discountValue, $pricing['promotionalPrice'],
            $pricing['discountAmount'], $pricing['discountPercentage'], $property['currency'], $startAt, $endAt,
            (int)($input['displayOrder'] ?? 0), $userId,
        ];
        if ($values[1] === '') Response::error('Deal title is required', 'VALIDATION_ERROR', 422);
        if ($id === null) {
            DB::execute(
                "INSERT INTO hot_deals (property_id, title, description, base_price, original_price, original_price_verified, original_price_verified_by, original_price_verified_at, discount_type, discount_value, promotional_price, discount_amount, discount_percentage, currency, start_at, end_at, display_order, status, created_by, updated_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)",
                array_merge($values, [$userId])
            );
            return DB::lastInsertId();
        }
        DB::execute(
            "UPDATE hot_deals SET property_id = ?, title = ?, description = ?, base_price = ?, original_price = ?, original_price_verified = ?, original_price_verified_by = ?, original_price_verified_at = ?, discount_type = ?, discount_value = ?, promotional_price = ?, discount_amount = ?, discount_percentage = ?, currency = ?, start_at = ?, end_at = ?, display_order = ?, updated_by = ?, updated_at = NOW() WHERE id = ?",
            array_merge($values, [$id])
        );
        return $id;
    }

    public static function hotDealCreate(): void {
        $user = Auth::requirePermission('hot_deals.create'); Auth::verifyCsrf();
        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        $id = self::saveHotDeal($input, $user['id']);
        Response::json(self::formatHotDeal(self::hotDealRow($id)), 201);
    }

    public static function hotDealUpdate(int $id): void {
        $user = Auth::requirePermission('hot_deals.create'); Auth::verifyCsrf();
        $existing = self::hotDealRow($id);
        if (!$existing) Response::error('Hot deal not found', 'NOT_FOUND', 404);
        if (in_array($existing['status'], ['ended', 'expired'], true)) Response::error('Ended or expired deals cannot be edited', 'CONFLICT', 409);
        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        $input['propertyId'] = $input['propertyId'] ?? $existing['property_id'];
        $input['title'] = $input['title'] ?? $existing['title'];
        $input['description'] = $input['description'] ?? $existing['description'];
        $input['discountType'] = $input['discountType'] ?? $existing['discount_type'];
        $input['discountValue'] = $input['discountValue'] ?? $existing['discount_value'];
        $input['displayOrder'] = $input['displayOrder'] ?? $existing['display_order'];
        $input['originalPrice'] = $input['originalPrice'] ?? $existing['original_price'];
        $input['startAt'] = $input['startAt'] ?? $existing['start_at'];
        $input['endAt'] = $input['endAt'] ?? $existing['end_at'];
        if (in_array($existing['status'], ['scheduled', 'active'], true)) {
            if (strtotime(self::sqlDateTime($input['endAt'], 'endAt')) <= time()) {
                Response::error('The end date has already passed. Extend the schedule before saving.', 'VALIDATION_ERROR', 422, [['path' => 'endAt', 'message' => 'The end date has already passed']]);
            }
        }
        $id = self::saveHotDeal($input, $user['id'], $id);
        if (in_array($existing['status'], ['scheduled', 'active'], true)) {
            $status = strtotime(self::sqlDateTime($input['startAt'], 'startAt')) > time() ? 'scheduled' : 'active';
            DB::execute("UPDATE hot_deals SET status = ?, updated_at = NOW() WHERE id = ?", [$status, $id]);
        }
        Response::json(self::formatHotDeal(self::hotDealRow($id)));
    }

    public static function hotDealAction(int $id, string $action): void {
        $user = Auth::requirePermission('hot_deals.publish'); Auth::verifyCsrf();
        $row = self::hotDealRow($id);
        if (!$row) Response::error('Hot deal not found', 'NOT_FOUND', 404);
        if ($action === 'activate') {
            if (!in_array($row['status'], ['draft', 'paused', 'scheduled', 'active'], true)) Response::error('This deal cannot be activated', 'CONFLICT', 409);
            if ($row['publication_status'] !== 'published' || $row['availability_status'] !== 'available') Response::error('Deals can only run on published and available properties', 'CONFLICT', 409);
            if (strtotime($row['end_at']) <= time()) Response::error('The end date has already passed. Extend the schedule before activating.', 'VALIDATION_ERROR', 422);
            $status = strtotime($row['start_at']) > time() ? 'scheduled' : 'active';
        } elseif ($action === 'pause') {
            if (!in_array($row['status'], ['scheduled', 'active'], true)) Response::error('Only scheduled or active deals can be paused', 'CONFLICT', 409);
            $status = 'paused';
        } elseif ($action === 'end') {
            if (in_array($row['status'], ['ended', 'expired'], true)) Response::error('This deal has already finished', 'CONFLICT', 409);
            $status = 'ended';
        } else {
            Response::error('Unsupported hot deal action', 'NOT_FOUND', 404);
        }
        DB::execute("UPDATE hot_deals SET status = ?, updated_by = ?, updated_at = NOW() WHERE id = ?", [$status, $user['id'], $id]);
        Response::json(self::formatHotDeal(self::hotDealRow($id)));
    }

    public static function settings(): void {
        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            Auth::requirePermission('settings.view');
            $rows = DB::query("SELECT setting_key, setting_value, setting_group, label, is_public FROM business_settings ORDER BY setting_group, setting_key");
            $out = array_map(function($r) {
                return [
                    'key' => $r['setting_key'],
                    'value' => $r['setting_value'],
                    'group' => $r['setting_group'],
                    'label' => $r['label'] ?: $r['setting_key'],
                    'isPublic' => (bool)$r['is_public'],
                ];
            }, $rows);
            Response::json($out);
        } else {
            $user = Auth::requirePermission('settings.manage');
            Auth::verifyCsrf();
            $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
            $values = $input['values'] ?? $input;
            if (!is_array($values)) {
                Response::error('Settings values must be an object', 'VALIDATION_ERROR', 422);
            }
            foreach ($values as $key => $value) {
                DB::execute(
                    "UPDATE business_settings SET setting_value = ?, updated_by = ?, updated_at = NOW() WHERE setting_key = ?",
                    [(string)$value, $user['id'], $key]
                );
            }
            Response::json(['message' => 'Settings saved successfully']);
        }
    }

    public static function categories(): void {
        Auth::requirePermission('properties.view');
        $rows = DB::query("
            SELECT c.*, COUNT(p.id) as property_count
            FROM property_categories c
            LEFT JOIN properties p ON p.category_id = c.id
            GROUP BY c.id
            ORDER BY c.sort_order ASC, c.name ASC
        ");
        $data = array_map(function($c) {
            return [
                'id' => (int)$c['id'],
                'name' => $c['name'],
                'slug' => $c['slug'],
                'typeGroup' => $c['type_group'],
                'description' => $c['description'],
                'isActive' => (bool)$c['is_active'],
                'sortOrder' => (int)$c['sort_order'],
                'propertyCount' => (int)$c['property_count'],
                'createdAt' => $c['created_at'] ? date('c', strtotime($c['created_at'])) : null,
                'updatedAt' => $c['updated_at'] ? date('c', strtotime($c['updated_at'])) : null,
            ];
        }, $rows);
        Response::json($data);
    }

    public static function categoryCreate(): void {
        Auth::requirePermission('properties.create');
        Auth::verifyCsrf();
        $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        $name = trim($input['name'] ?? '');
        if ($name === '') Response::error('Name is required', 'VALIDATION_ERROR', 422);
        $slug = strtolower(trim(preg_replace('/[^A-Za-z0-9-]+/', '-', $name), '-'));
        $typeGroup = $input['typeGroup'] ?? 'residential';
        $desc = $input['description'] ?? null;
        $sortOrder = (int)($input['sortOrder'] ?? 0);
        $isActive = (int)(($input['isActive'] ?? true) ? 1 : 0);

        DB::execute("INSERT INTO property_categories (name, slug, type_group, description, is_active, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())",
            [$name, $slug, $typeGroup, $desc, $isActive, $sortOrder]);
        Response::json(['id' => DB::lastInsertId()], 201);
    }

    public static function categoryUpdate(int $id): void {
        Auth::requirePermission('properties.edit');
        Auth::verifyCsrf();
        $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        $fields = [];
        $params = [];
        if (isset($input['name'])) { $fields[] = "name = ?"; $params[] = $input['name']; }
        if (isset($input['typeGroup'])) { $fields[] = "type_group = ?"; $params[] = $input['typeGroup']; }
        if (isset($input['description'])) { $fields[] = "description = ?"; $params[] = $input['description']; }
        if (isset($input['isActive'])) { $fields[] = "is_active = ?"; $params[] = $input['isActive'] ? 1 : 0; }
        if (isset($input['sortOrder'])) { $fields[] = "sort_order = ?"; $params[] = (int)$input['sortOrder']; }
        if (!empty($fields)) {
            $params[] = $id;
            DB::execute("UPDATE property_categories SET " . implode(', ', $fields) . ", updated_at = NOW() WHERE id = ?", $params);
        }
        Response::json(['message' => 'Category updated']);
    }

    public static function categoryDelete(int $id): void {
        Auth::requirePermission('properties.edit');
        Auth::verifyCsrf();
        $check = DB::queryOne("SELECT COUNT(*) as count FROM properties WHERE category_id = ?", [$id]);
        if ((int)($check['count'] ?? 0) > 0) {
            Response::error('Cannot delete category with properties assigned to it', 'CATEGORY_IN_USE', 400);
        }
        DB::execute("DELETE FROM property_categories WHERE id = ?", [$id]);
        Response::json(['message' => 'Category deleted']);
    }

    public static function users(): void {
        Auth::requirePermission('users.view');
        $page = max(1, (int)($_GET['page'] ?? 1));
        $limit = max(1, min(100, (int)($_GET['limit'] ?? 20)));
        $where = ['1=1']; $params = [];
        foreach (['roleId' => 'u.role_id', 'status' => 'u.status'] as $key => $column) {
            if (isset($_GET[$key]) && $_GET[$key] !== '') { $where[] = "{$column} = ?"; $params[] = $_GET[$key]; }
        }
        if (!empty($_GET['search'])) {
            $where[] = '(u.full_name LIKE ? OR u.email LIKE ?)';
            $term = '%' . trim($_GET['search']) . '%'; array_push($params, $term, $term);
        }
        $filter = implode(' AND ', $where);
        $total = (int)(DB::queryOne("SELECT COUNT(*) AS total FROM users u WHERE {$filter}", $params)['total'] ?? 0);
        $rows = DB::query("
            SELECT u.id, u.role_id, u.full_name, u.email, u.phone, u.status, u.last_login_at, u.created_at, u.updated_at,
                   u.locked_until, r.name as role_name, r.slug as role_slug
            FROM users u
            LEFT JOIN roles r ON u.role_id = r.id
            WHERE {$filter} ORDER BY u.id ASC
            LIMIT {$limit} OFFSET " . (($page - 1) * $limit), $params);
        $data = array_map(function($u) {
            return [
                'id' => (int)$u['id'],
                'fullName' => $u['full_name'],
                'email' => $u['email'],
                'phone' => $u['phone'],
                'status' => $u['status'],
                'role' => ['id' => (int)$u['role_id'], 'name' => $u['role_name'], 'slug' => $u['role_slug']],
                'lockedUntil' => $u['locked_until'] ? date('c', strtotime($u['locked_until'])) : null,
                'lastLoginAt' => $u['last_login_at'] ? date('c', strtotime($u['last_login_at'])) : null,
                'createdAt' => $u['created_at'] ? date('c', strtotime($u['created_at'])) : null,
                'updatedAt' => $u['updated_at'] ? date('c', strtotime($u['updated_at'])) : null,
            ];
        }, $rows);
        Response::json($data, 200, self::pageMeta($total, $page, $limit));
    }

    public static function userCreate(): void {
        Auth::requirePermission('users.manage');
        Auth::verifyCsrf();
        $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        $name = trim($input['fullName'] ?? '');
        $email = trim($input['email'] ?? '');
        $password = $input['password'] ?? '';
        $roleId = (int)($input['roleId'] ?? 6);
        if ($name === '' || $email === '' || $password === '') {
            Response::error('Name, email, and password are required', 'VALIDATION_ERROR', 422);
        }
        $dup = DB::queryOne("SELECT id FROM users WHERE email = ?", [$email]);
        if ($dup) Response::error('Email already exists', 'DUPLICATE_EMAIL', 400);
        $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
        DB::execute("INSERT INTO users (full_name, email, phone, role_id, password_hash, status, password_changed_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'active', NOW(), NOW(), NOW())",
            [$name, $email, $input['phone'] ?? null, $roleId, $hash]);
        Response::json(['id' => DB::lastInsertId()], 201);
    }

    public static function userUpdate(int $id): void {
        Auth::requirePermission('users.manage');
        Auth::verifyCsrf();
        $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        $fields = [];
        $params = [];
        if (isset($input['fullName'])) { $fields[] = "full_name = ?"; $params[] = $input['fullName']; }
        if (isset($input['email'])) { $fields[] = "email = ?"; $params[] = $input['email']; }
        if (isset($input['phone'])) { $fields[] = "phone = ?"; $params[] = $input['phone']; }
        if (isset($input['roleId'])) { $fields[] = "role_id = ?"; $params[] = (int)$input['roleId']; }
        if (isset($input['status'])) { $fields[] = "status = ?"; $params[] = $input['status']; }
        if (!empty($input['password'])) {
            $fields[] = "password_hash = ?";
            $params[] = password_hash($input['password'], PASSWORD_BCRYPT, ['cost' => 12]);
        }
        if (!empty($fields)) {
            $params[] = $id;
            DB::execute("UPDATE users SET " . implode(', ', $fields) . ", updated_at = NOW() WHERE id = ?", $params);
        }
        Response::json(['message' => 'User updated']);
    }

    public static function roles(): void {
        Auth::requireAnyPermission(['roles.view', 'users.view']);
        $roles = DB::query("SELECT * FROM roles ORDER BY id ASC");
        $allPerms = DB::query("SELECT slug, name, module FROM permissions ORDER BY slug ASC");
        $data = array_map(function($r) {
            $permissions = DB::query("
                SELECT p.slug FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id
                WHERE rp.role_id = ? ORDER BY p.slug
            ", [(int)$r['id']]);
            $userCount = DB::queryOne("SELECT COUNT(*) AS count FROM users WHERE role_id = ?", [(int)$r['id']]);
            return [
                'id' => (int)$r['id'],
                'name' => $r['name'],
                'slug' => $r['slug'],
                'description' => $r['description'],
                'isSystem' => (bool)$r['is_system'],
                'userCount' => (int)($userCount['count'] ?? 0),
                'permissions' => array_column($permissions, 'slug'),
            ];
        }, $roles);
        Response::json(['roles' => $data, 'permissions' => $allPerms]);
    }

    public static function roleCreate(): void {
        Auth::requirePermission('roles.manage');
        Auth::verifyCsrf();
        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        $name = trim($input['name'] ?? '');
        $slug = strtolower(trim(preg_replace('/[^A-Za-z0-9_]+/', '_', $name), '_'));
        if (strlen($name) < 2) Response::error('Role name must contain at least two characters', 'VALIDATION_ERROR', 422);
        $permissions = $input['permissions'] ?? [];
        if (!is_array($permissions)) Response::error('permissions must be an array', 'VALIDATION_ERROR', 422);
        if (DB::queryOne("SELECT id FROM roles WHERE name = ? OR slug = ?", [$name, $slug])) {
            Response::error('A role with this name already exists', 'DUPLICATE_ROLE', 422);
        }
        DB::execute("INSERT INTO roles (name, slug, description, is_system) VALUES (?, ?, ?, 0)", [$name, $slug, $input['description'] ?? null]);
        $id = DB::lastInsertId();
        self::setRolePermissions($id, $permissions);
        Response::json(['id' => $id], 201);
    }

    private static function setRolePermissions(int $roleId, array $slugs): void {
        $slugs = array_values(array_unique($slugs));
        $known = $slugs
            ? DB::query("SELECT id, slug FROM permissions WHERE slug IN (" . implode(',', array_fill(0, count($slugs), '?')) . ")", $slugs)
            : [];
        if (count($known) !== count($slugs)) Response::error('One or more permission values are invalid', 'VALIDATION_ERROR', 422);
        DB::execute("DELETE FROM role_permissions WHERE role_id = ?", [$roleId]);
        foreach ($known as $permission) {
            DB::execute("INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)", [$roleId, (int)$permission['id']]);
        }
    }

    public static function roleUpdate(int $id): void {
        Auth::requirePermission('roles.manage');
        Auth::verifyCsrf();
        $role = DB::queryOne("SELECT slug FROM roles WHERE id = ?", [$id]);
        if (!$role) Response::error('Role not found', 'NOT_FOUND', 404);
        if ($role['slug'] === 'super_admin') Response::error('The Super Admin role cannot be edited', 'CONFLICT', 409);
        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        $fields = []; $params = [];
        if (isset($input['name'])) {
            $name = trim($input['name']);
            if (strlen($name) < 2) Response::error('Role name must contain at least two characters', 'VALIDATION_ERROR', 422);
            $fields[] = 'name = ?'; $params[] = $name;
            $fields[] = 'slug = ?'; $params[] = strtolower(trim(preg_replace('/[^A-Za-z0-9_]+/', '_', $name), '_'));
        }
        if (array_key_exists('description', $input)) { $fields[] = 'description = ?'; $params[] = $input['description']; }
        if ($fields) { $params[] = $id; DB::execute("UPDATE roles SET " . implode(', ', $fields) . " WHERE id = ?", $params); }
        if (isset($input['permissions'])) {
            if (!is_array($input['permissions'])) Response::error('permissions must be an array', 'VALIDATION_ERROR', 422);
            self::setRolePermissions($id, $input['permissions']);
        }
        Response::json(['message' => 'Role updated']);
    }

    public static function roleDelete(int $id): void {
        Auth::requirePermission('roles.manage');
        Auth::verifyCsrf();
        $role = DB::queryOne("SELECT slug, is_system FROM roles WHERE id = ?", [$id]);
        if (!$role) Response::error('Role not found', 'NOT_FOUND', 404);
        if ((bool)$role['is_system']) Response::error('System roles cannot be deleted', 'CONFLICT', 409);
        $users = DB::queryOne("SELECT COUNT(*) AS count FROM users WHERE role_id = ?", [$id]);
        if ((int)($users['count'] ?? 0) > 0) Response::error('Reassign the users of this role before deleting it', 'CONFLICT', 409);
        DB::execute("DELETE FROM roles WHERE id = ?", [$id]);
        Response::json(['message' => 'Role deleted']);
    }

    public static function content(): void {
        Auth::requireAuth();
        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            $rows = DB::query("SELECT content_key, title, body, description, updated_at FROM website_content ORDER BY content_key ASC");
            $data = array_map(function($r) {
                return [
                    'key' => $r['content_key'],
                    'title' => $r['title'],
                    'bodyHtml' => $r['body'],
                    'description' => $r['description'],
                    'updatedAt' => $r['updated_at'] ? date('c', strtotime($r['updated_at'])) : null,
                ];
            }, $rows);
            Response::json($data);
        }
    }

    public static function contentUpdate(string $key): void {
        $user = Auth::requirePermission('content.edit');
        Auth::verifyCsrf();
        $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        $fields = [];
        $params = [];
        if (isset($input['title'])) { $fields[] = "title = ?"; $params[] = $input['title']; }
        if (isset($input['bodyHtml'])) { $fields[] = "body = ?"; $params[] = $input['bodyHtml']; }
        if (isset($input['body'])) { $fields[] = "body = ?"; $params[] = $input['body']; }
        if (isset($input['description'])) { $fields[] = "description = ?"; $params[] = $input['description']; }
        if (!empty($fields)) {
            $fields[] = "updated_by = ?";
            $params[] = $user['id'];
            $params[] = $key;
            DB::execute("UPDATE website_content SET " . implode(', ', $fields) . ", updated_at = NOW() WHERE content_key = ?", $params);
        }
        Response::json(['message' => 'Content updated']);
    }

    public static function heroSlides(): void {
        Auth::requirePermission('content.view');
        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            $slides = DB::query("SELECT * FROM hero_slides ORDER BY display_order ASC, id ASC");
            $data = array_map([self::class, 'formatHeroSlide'], $slides);
            $animation = DB::queryOne("SELECT setting_value FROM business_settings WHERE setting_key = 'hero_animation'");
            $interval = DB::queryOne("SELECT setting_value FROM business_settings WHERE setting_key = 'hero_interval_seconds'");
            Response::json([
                'settings' => [
                    'animation' => $animation['setting_value'] ?? 'fade',
                    'intervalSeconds' => (int)($interval['setting_value'] ?? 6),
                ],
                'slides' => $data,
            ]);
        }
    }

    private static function formatHeroSlide(array $s): array {
        $img = $s['background_image'];
        if ($img && !str_starts_with($img, 'http') && !str_starts_with($img, '/')) $img = '/uploads/' . $img;
        return [
            'id' => (int)$s['id'],
            'title' => $s['title'],
            'subtitle' => $s['subtitle'],
            'backgroundImage' => $img,
            'backgroundImagePath' => $s['background_image'],
            'buttonLabel' => $s['button_label'],
            'buttonUrl' => $s['button_url'],
            'overlayOpacity' => (int)($s['overlay_opacity'] ?? 55),
            'textAlign' => $s['text_align'] ?? 'left',
            'displayOrder' => (int)$s['display_order'],
            'isActive' => (bool)$s['is_active'],
            'createdAt' => $s['created_at'] ? date('c', strtotime($s['created_at'])) : null,
            'updatedAt' => $s['updated_at'] ? date('c', strtotime($s['updated_at'])) : null,
        ];
    }

    public static function heroSlideCreate(): void {
        $user = Auth::requirePermission('content.manage');
        Auth::verifyCsrf();
        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        $title = trim($input['title'] ?? '');
        if ($title === '') Response::error('Slide title is required', 'VALIDATION_ERROR', 422);
        $count = DB::queryOne("SELECT COUNT(*) AS count FROM hero_slides");
        if ((int)($count['count'] ?? 0) >= 10) Response::error('A maximum of 10 hero slides is allowed', 'VALIDATION_ERROR', 422);
        DB::execute(
            "INSERT INTO hero_slides (title, subtitle, background_image, button_label, button_url, overlay_opacity, text_align, display_order, is_active, created_by, updated_by, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())",
            [$title, $input['subtitle'] ?? null, $input['backgroundImage'] ?? null, $input['buttonLabel'] ?? null, $input['buttonUrl'] ?? null,
                max(0, min(90, (int)($input['overlayOpacity'] ?? 55))), $input['textAlign'] ?? 'left', (int)($input['displayOrder'] ?? 0),
                empty($input['isActive']) ? 0 : 1, $user['id'], $user['id']]
        );
        Response::json(['id' => DB::lastInsertId()], 201);
    }

    public static function heroSlideUpdate(int $id): void {
        $user = Auth::requirePermission('content.manage');
        Auth::verifyCsrf();
        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        $columns = [
            'title' => 'title', 'subtitle' => 'subtitle', 'backgroundImage' => 'background_image',
            'buttonLabel' => 'button_label', 'buttonUrl' => 'button_url', 'overlayOpacity' => 'overlay_opacity',
            'textAlign' => 'text_align', 'displayOrder' => 'display_order', 'isActive' => 'is_active',
        ];
        $sets = [];
        $values = [];
        foreach ($columns as $key => $column) {
            if (array_key_exists($key, $input)) {
                $sets[] = "{$column} = ?";
                $value = $input[$key];
                if ($key === 'overlayOpacity') $value = max(0, min(90, (int)$value));
                if ($key === 'displayOrder') $value = (int)$value;
                if ($key === 'isActive') $value = $value ? 1 : 0;
                $values[] = $value;
            }
        }
        if ($sets) {
            $values[] = $user['id'];
            $values[] = $id;
            DB::execute("UPDATE hero_slides SET " . implode(', ', $sets) . ", updated_by = ?, updated_at = NOW() WHERE id = ?", $values);
        }
        $slide = DB::queryOne("SELECT * FROM hero_slides WHERE id = ?", [$id]);
        if (!$slide) Response::error('Hero slide not found', 'NOT_FOUND', 404);
        Response::json(self::formatHeroSlide($slide));
    }

    public static function heroSlideDelete(int $id): void {
        Auth::requirePermission('content.manage');
        Auth::verifyCsrf();
        DB::execute("DELETE FROM hero_slides WHERE id = ?", [$id]);
        Response::json(['message' => 'Hero slide deleted']);
    }

    public static function heroSettingsUpdate(): void {
        $user = Auth::requirePermission('content.manage');
        Auth::verifyCsrf();
        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        $animation = $input['animation'] ?? 'fade';
        if (!in_array($animation, ['slide', 'fade', 'flip'], true)) Response::error('Invalid hero animation', 'VALIDATION_ERROR', 422);
        $interval = max(3, min(30, (int)($input['intervalSeconds'] ?? 6)));
        foreach (['hero_animation' => $animation, 'hero_interval_seconds' => (string)$interval] as $key => $value) {
            DB::execute(
                "INSERT INTO business_settings (setting_key, setting_value, setting_group, label, is_public, updated_by, updated_at)
                 VALUES (?, ?, 'hero', ?, 0, ?, NOW())
                 ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by), updated_at = NOW()",
                [$key, $value, $key === 'hero_animation' ? 'Hero animation' : 'Hero interval (seconds)', $user['id']]
            );
        }
        Response::json(['animation' => $animation, 'intervalSeconds' => $interval]);
    }

    public static function heroSlidesReorder(): void {
        Auth::requirePermission('content.manage');
        Auth::verifyCsrf();
        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        $ids = $input['slideIds'] ?? [];
        if (!is_array($ids)) Response::error('slideIds must be an array', 'VALIDATION_ERROR', 422);
        foreach ($ids as $order => $id) {
            DB::execute("UPDATE hero_slides SET display_order = ?, updated_at = NOW() WHERE id = ?", [(int)$order, (int)$id]);
        }
        Response::json(['message' => 'Hero slides reordered']);
    }

    public static function auditLogFilters(): void {
        Auth::requirePermission('audit_logs.view');
        $actions = DB::query("SELECT DISTINCT action FROM audit_logs ORDER BY action");
        $entities = DB::query("SELECT DISTINCT entity_type FROM audit_logs WHERE entity_type IS NOT NULL ORDER BY entity_type");
        Response::json([
            'actions' => array_column($actions, 'action'),
            'entityTypes' => array_column($entities, 'entity_type'),
        ]);
    }

    public static function auditLogs(): void {
        Auth::requirePermission('audit_logs.view');
        $page = max(1, (int)($_GET['page'] ?? 1));
        $limit = max(1, min(100, (int)($_GET['limit'] ?? 25)));
        $offset = ($page - 1) * $limit;
        $where = ['1=1']; $params = [];
        foreach (['action' => 'l.action', 'entityType' => 'l.entity_type'] as $key => $column) {
            if (!empty($_GET[$key])) { $where[] = "{$column} = ?"; $params[] = $_GET[$key]; }
        }
        foreach (['from' => '>=', 'to' => '<'] as $key => $operator) {
            if (!empty($_GET[$key])) { $where[] = "l.created_at {$operator} ?"; $params[] = self::sqlDateTime($_GET[$key], $key); }
        }
        if (!empty($_GET['search'])) {
            $where[] = '(l.action LIKE ? OR l.details LIKE ? OR u.email LIKE ? OR u.full_name LIKE ?)';
            $term = '%' . trim($_GET['search']) . '%'; array_push($params, $term, $term, $term, $term);
        }
        $filter = implode(' AND ', $where);
        $total = (int)(DB::queryOne("SELECT COUNT(*) AS total FROM audit_logs l LEFT JOIN users u ON u.id = l.user_id WHERE {$filter}", $params)['total'] ?? 0);

        $rows = DB::query("
            SELECT l.*, u.full_name AS user_name, u.email AS user_email
            FROM audit_logs l
            LEFT JOIN users u ON l.user_id = u.id
            WHERE {$filter} ORDER BY l.created_at DESC, l.id DESC
            LIMIT {$limit} OFFSET {$offset}
        ", $params);
        $data = array_map(function($row) {
            $details = null;
            if ($row['details'] !== null && $row['details'] !== '') {
                $decoded = json_decode($row['details'], true);
                $details = json_last_error() === JSON_ERROR_NONE ? $decoded : $row['details'];
            }
            return [
                'id' => (int)$row['id'],
                'user' => $row['user_id'] ? ['id' => (int)$row['user_id'], 'fullName' => $row['user_name'], 'email' => $row['user_email']] : null,
                'action' => $row['action'], 'entityType' => $row['entity_type'], 'entityId' => $row['entity_id'],
                'details' => $details, 'ipAddress' => $row['ip_address'], 'userAgent' => $row['user_agent'],
                'createdAt' => date('c', strtotime($row['created_at'])),
            ];
        }, $rows);
        Response::json($data, 200, self::pageMeta($total, $page, $limit));
    }

    public static function analytics(): void {
        Auth::requirePermission('analytics.view');
        $to = $_GET['to'] ?? gmdate('Y-m-d');
        $from = $_GET['from'] ?? gmdate('Y-m-d', strtotime($to . ' -29 days'));
        $fromDate = DateTimeImmutable::createFromFormat('!Y-m-d', $from, new DateTimeZone('UTC'));
        $toDate = DateTimeImmutable::createFromFormat('!Y-m-d', $to, new DateTimeZone('UTC'));
        if (!$fromDate || !$toDate || $fromDate->format('Y-m-d') !== $from || $toDate->format('Y-m-d') !== $to || $fromDate > $toDate) {
            Response::error('Invalid analytics date range', 'VALIDATION_ERROR', 422);
        }

        $ads = DB::query("
            SELECT a.id, a.internal_name AS name, a.headline, a.status, pl.name AS placement,
                COALESCE(SUM(e.event_type = 'impression'), 0) AS impressions,
                COALESCE(SUM(e.event_type = 'click'), 0) AS clicks
            FROM advertisements a JOIN advertisement_placements pl ON pl.id = a.placement_id
            LEFT JOIN advertisement_events e ON e.advertisement_id = a.id AND e.event_date BETWEEN ? AND ?
            WHERE a.status <> 'draft' GROUP BY a.id ORDER BY impressions DESC, a.id DESC
        ", [$from, $to]);
        $placements = DB::query("
            SELECT pl.id, pl.name, pl.slug,
                COALESCE(SUM(e.event_type = 'impression'), 0) AS impressions,
                COALESCE(SUM(e.event_type = 'click'), 0) AS clicks
            FROM advertisement_placements pl
            LEFT JOIN advertisement_events e ON e.placement_id = pl.id AND e.event_date BETWEEN ? AND ?
            GROUP BY pl.id ORDER BY pl.id
        ", [$from, $to]);
        $daily = DB::query("
            SELECT DATE_FORMAT(event_date, '%Y-%m-%d') AS day,
                SUM(event_type = 'impression') AS impressions, SUM(event_type = 'click') AS clicks
            FROM advertisement_events WHERE event_date BETWEEN ? AND ?
            GROUP BY event_date ORDER BY event_date
        ", [$from, $to]);
        $promotions = DB::query("
            SELECT pr.id, pr.name, pr.status, pr.campaign_type,
                COALESCE(SUM(e.event_type = 'view'), 0) AS views, COALESCE(SUM(e.event_type = 'click'), 0) AS clicks
            FROM promotions pr LEFT JOIN campaign_events e ON e.entity_type = 'promotion' AND e.entity_id = pr.id AND e.event_date BETWEEN ? AND ?
            WHERE pr.status <> 'draft' GROUP BY pr.id ORDER BY views DESC, pr.id DESC
        ", [$from, $to]);
        $hotDeals = DB::query("
            SELECT d.id, d.title AS name, d.status,
                COALESCE(SUM(e.event_type = 'view'), 0) AS views, COALESCE(SUM(e.event_type = 'click'), 0) AS clicks
            FROM hot_deals d LEFT JOIN campaign_events e ON e.entity_type = 'hot_deal' AND e.entity_id = d.id AND e.event_date BETWEEN ? AND ?
            WHERE d.status <> 'draft' GROUP BY d.id ORDER BY views DESC, d.id DESC
        ", [$from, $to]);
        $featured = DB::query("
            SELECT f.id, p.title AS name, f.is_active AS isActive,
                COALESCE(SUM(e.event_type = 'view'), 0) AS views, COALESCE(SUM(e.event_type = 'click'), 0) AS clicks
            FROM featured_property_campaigns f JOIN properties p ON p.id = f.property_id
            LEFT JOIN campaign_events e ON e.entity_type = 'featured' AND e.entity_id = f.id AND e.event_date BETWEEN ? AND ?
            GROUP BY f.id ORDER BY views DESC, f.id DESC
        ", [$from, $to]);
        $adAttributed = DB::query("SELECT advertisement_id AS id, COUNT(*) AS count FROM inquiries WHERE advertisement_id IS NOT NULL AND created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY) GROUP BY advertisement_id", [$from, $to]);
        $promotionAttributed = DB::query("SELECT promotion_id AS id, COUNT(*) AS count FROM inquiries WHERE promotion_id IS NOT NULL AND created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY) GROUP BY promotion_id", [$from, $to]);
        $dealAttributed = DB::query("SELECT hot_deal_id AS id, COUNT(*) AS count FROM inquiries WHERE hot_deal_id IS NOT NULL AND created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY) GROUP BY hot_deal_id", [$from, $to]);
        $adMap = []; foreach ($adAttributed as $r) $adMap[(int)$r['id']] = (int)$r['count'];
        $promotionMap = []; foreach ($promotionAttributed as $r) $promotionMap[(int)$r['id']] = (int)$r['count'];
        $dealMap = []; foreach ($dealAttributed as $r) $dealMap[(int)$r['id']] = (int)$r['count'];

        $formatCounts = static function(array $rows, string $viewKey): array {
            return array_map(static function($r) use ($viewKey) {
                $views = (int)$r[$viewKey]; $clicks = (int)$r['clicks'];
                $r[$viewKey] = $views; $r['clicks'] = $clicks;
                $r['ctr'] = $views > 0 ? round($clicks / $views * 100, 2) : 0;
                if (isset($r['impressions'])) $r['impressions'] = $views;
                return $r;
            }, $rows);
        };
        $ads = $formatCounts($ads, 'impressions');
        foreach ($ads as &$row) $row['attributedInquiries'] = $adMap[(int)$row['id']] ?? 0;
        unset($row);
        $placements = $formatCounts($placements, 'impressions');
        $promotions = $formatCounts($promotions, 'views');
        foreach ($promotions as &$row) $row['attributedInquiries'] = $promotionMap[(int)$row['id']] ?? 0;
        unset($row);
        $hotDeals = $formatCounts($hotDeals, 'views');
        foreach ($hotDeals as &$row) $row['attributedInquiries'] = $dealMap[(int)$row['id']] ?? 0;
        unset($row);
        $featured = $formatCounts($featured, 'views');
        foreach ($daily as &$row) { $row['impressions'] = (int)$row['impressions']; $row['clicks'] = (int)$row['clicks']; }
        unset($row);
        $impressions = array_sum(array_column($ads, 'impressions'));
        $clicks = array_sum(array_column($ads, 'clicks'));
        Response::json([
            'range' => ['from' => $from, 'to' => $to],
            'definitions' => [
                'impression' => 'An advertisement was displayed in a visitor’s viewport (counted once per visitor, advert and day).',
                'click' => 'A visitor followed an advertisement or campaign link (counted once per visitor, item and day).',
                'view' => 'A promotion or hot deal was displayed to a visitor (counted once per visitor, item and day).',
                'attributedInquiry' => 'An inquiry submitted after the visitor clicked through that campaign in the same browser session. Attribution does not imply a sale.',
            ],
            'totals' => [
                'impressions' => $impressions, 'clicks' => $clicks,
                'ctr' => $impressions > 0 ? round($clicks / $impressions * 100, 2) : 0,
                'attributedInquiries' => array_sum($adMap) + array_sum($promotionMap) + array_sum($dealMap),
            ],
            'daily' => $daily, 'advertisements' => $ads, 'placements' => $placements,
            'promotions' => $promotions, 'hotDeals' => $hotDeals, 'featured' => $featured,
        ]);
    }
}

<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/response.php';
require_once __DIR__ . '/formatter.php';
require_once __DIR__ . '/auth.php';

class PublicController {
    public static function site(): void {
        // Business settings
        $settingsRows = DB::query("SELECT setting_key, setting_value FROM business_settings WHERE is_public = 1");
        $settings = [];
        foreach ($settingsRows as $row) {
            $settings[$row['setting_key']] = $row['setting_value'];
        }

        // Website content
        $contentRows = DB::query("SELECT content_key, title, body FROM website_content");
        $content = [];
        foreach ($contentRows as $row) {
            $content[$row['content_key']] = [
                'title' => $row['title'],
                'body' => $row['body'],
                'bodyHtml' => $row['body']
            ];
        }

        Response::json([
            'settings' => $settings,
            'content' => $content
        ]);
    }

    public static function hero(): void {
        $animRow = DB::queryOne("SELECT setting_value FROM business_settings WHERE setting_key = 'hero_animation'");
        $intRow  = DB::queryOne("SELECT setting_value FROM business_settings WHERE setting_key = 'hero_interval_seconds'");

        $slides = DB::query("
            SELECT id, title, subtitle, background_image, button_label, button_url, display_order, overlay_opacity, text_align
            FROM hero_slides
            WHERE is_active = 1
            ORDER BY display_order ASC, id ASC
        ");

        $formattedSlides = array_map(function($s) {
            $img = $s['background_image'];
            if ($img && !str_starts_with($img, 'http') && !str_starts_with($img, '/')) {
                $img = '/uploads/' . $img;
            }
            return [
                'id' => (int) $s['id'],
                'title' => $s['title'],
                'subtitle' => $s['subtitle'],
                'backgroundImage' => $img,
                'buttonLabel' => $s['button_label'],
                'buttonUrl' => $s['button_url'],
                'overlayOpacity' => (float)($s['overlay_opacity'] ?? 55),
                'textAlign' => $s['text_align'] ?? 'left',
                'displayOrder' => (int) $s['display_order'],
            ];
        }, $slides);

        Response::json([
            'animation' => $animRow ? $animRow['setting_value'] : 'fade',
            'intervalSeconds' => $intRow ? (int)$intRow['setting_value'] : 6,
            'slides' => $formattedSlides
        ]);
    }

    public static function categories(): void {
        $cats = DB::query("
            SELECT c.*, COUNT(p.id) as property_count
            FROM property_categories c
            LEFT JOIN properties p ON p.category_id = c.id AND p.publication_status = 'published' AND p.availability_status = 'available'
            WHERE c.is_active = 1
            GROUP BY c.id
            ORDER BY c.sort_order ASC, c.name ASC
        ");

        $data = array_map(function($c) {
            return [
                'id' => (int) $c['id'],
                'name' => $c['name'],
                'slug' => $c['slug'],
                'typeGroup' => $c['type_group'],
                'description' => $c['description'],
                'isActive' => (bool) $c['is_active'],
                'sortOrder' => (int) $c['sort_order'],
                'propertyCount' => (int) $c['property_count'],
                'createdAt' => $c['created_at'] ? date('c', strtotime($c['created_at'])) : null,
                'updatedAt' => $c['updated_at'] ? date('c', strtotime($c['updated_at'])) : null,
            ];
        }, $cats);

        Response::json($data);
    }

    public static function locations(): void {
        $rows = DB::query("
            SELECT district, city, COUNT(*) as count
            FROM properties
            WHERE publication_status = 'published' AND district IS NOT NULL AND district != ''
            GROUP BY district, city
            ORDER BY count DESC, district ASC
        ");

        $data = array_map(function($r) {
            return [
                'district' => $r['district'],
                'city' => $r['city'],
                'count' => (int) $r['count']
            ];
        }, $rows);

        Response::json($data);
    }

    public static function content(string $key): void {
        $row = DB::queryOne("SELECT content_key, title, body FROM website_content WHERE content_key = ?", [$key]);
        if (!$row) {
            Response::error('Content not found', 'NOT_FOUND', 404);
        }
        Response::json([
            'key' => $row['content_key'],
            'title' => $row['title'],
            'body' => $row['body'],
            'bodyHtml' => $row['body']
        ]);
    }

    public static function properties(): void {
        $page = max(1, (int)($_GET['page'] ?? 1));
        $limit = max(1, min(100, (int)($_GET['limit'] ?? 12)));
        $offset = ($page - 1) * $limit;

        $where = ["p.publication_status = 'published'"];
        $params = [];

        if (!empty($_GET['purpose'])) {
            $where[] = "p.purpose = ?";
            $params[] = $_GET['purpose'];
        }
        if (!empty($_GET['category'])) {
            $where[] = "c.slug = ?";
            $params[] = $_GET['category'];
        }
        if (!empty($_GET['district'])) {
            $where[] = "p.district = ?";
            $params[] = $_GET['district'];
        }
        if (!empty($_GET['city'])) {
            $where[] = "p.city = ?";
            $params[] = $_GET['city'];
        }
        if (!empty($_GET['minPrice'])) {
            $where[] = "p.price >= ?";
            $params[] = (float)$_GET['minPrice'];
        }
        if (!empty($_GET['maxPrice'])) {
            $where[] = "p.price <= ?";
            $params[] = (float)$_GET['maxPrice'];
        }
        if (!empty($_GET['bedrooms'])) {
            $where[] = "p.bedrooms >= ?";
            $params[] = (int)$_GET['bedrooms'];
        }
        if (!empty($_GET['search'])) {
            $term = '%' . trim($_GET['search']) . '%';
            $where[] = "(p.title LIKE ? OR p.description LIKE ? OR p.reference LIKE ? OR p.neighborhood LIKE ?)";
            $params[] = $term;
            $params[] = $term;
            $params[] = $term;
            $params[] = $term;
        }

        $whereClause = implode(' AND ', $where);

        $countRow = DB::queryOne("
            SELECT COUNT(*) as total
            FROM properties p
            LEFT JOIN property_categories c ON p.category_id = c.id
            WHERE {$whereClause}
        ", $params);
        $total = (int) ($countRow['total'] ?? 0);

        $sortOrder = "p.published_at DESC, p.id DESC";
        if (isset($_GET['sort'])) {
            switch ($_GET['sort']) {
                case 'price_asc':  $sortOrder = "p.price ASC"; break;
                case 'price_desc': $sortOrder = "p.price DESC"; break;
                case 'oldest':     $sortOrder = "p.published_at ASC"; break;
            }
        }

        $sql = "
            SELECT p.*,
                   c.name as category_name, c.slug as category_slug, c.type_group as category_type_group,
                   (SELECT file_path FROM property_images pi WHERE pi.property_id = p.id ORDER BY pi.sort_order ASC, pi.id ASC LIMIT 1) as main_image,
                   (SELECT COUNT(*) FROM property_images pi WHERE pi.property_id = p.id) as image_count
            FROM properties p
            LEFT JOIN property_categories c ON p.category_id = c.id
            WHERE {$whereClause}
            ORDER BY {$sortOrder}
            LIMIT {$limit} OFFSET {$offset}
        ";

        $rows = DB::query($sql, $params);
        $items = array_map(function($r) {
            return Formatter::formatProperty($r);
        }, $rows);

        Response::json($items, 200, [
            'total' => $total,
            'page' => $page,
            'limit' => $limit,
            'totalPages' => (int) ceil($total / $limit),
        ]);
    }

    public static function propertyDetails(string $slug): void {
        $row = DB::queryOne("
            SELECT p.*,
                   c.name as category_name, c.slug as category_slug, c.type_group as category_type_group
            FROM properties p
            LEFT JOIN property_categories c ON p.category_id = c.id
            WHERE p.slug = ? AND p.publication_status = 'published'
        ", [$slug]);

        if (!$row) {
            Response::error('Property not found', 'NOT_FOUND', 404);
        }

        $propId = (int) $row['id'];
        $images = DB::query("SELECT * FROM property_images WHERE property_id = ? ORDER BY sort_order ASC, id ASC", [$propId]);
        $amenities = DB::query("
            SELECT a.* FROM amenities a
            JOIN property_amenities pa ON a.id = pa.amenity_id
            WHERE pa.property_id = ?
            ORDER BY a.name ASC
        ", [$propId]);

        $details = Formatter::formatProperty($row, $images, $amenities);

        // Related properties
        $relatedRows = DB::query("
            SELECT p.*,
                   c.name as category_name, c.slug as category_slug, c.type_group as category_type_group,
                   (SELECT file_path FROM property_images pi WHERE pi.property_id = p.id ORDER BY pi.sort_order ASC LIMIT 1) as main_image,
                   (SELECT COUNT(*) FROM property_images pi WHERE pi.property_id = p.id) as image_count
            FROM properties p
            LEFT JOIN property_categories c ON p.category_id = c.id
            WHERE p.id != ? AND p.publication_status = 'published' AND (p.category_id = ? OR p.district = ?)
            ORDER BY p.published_at DESC
            LIMIT 4
        ", [$propId, (int)$row['category_id'], $row['district']]);

        $details['related'] = array_map(function($r) { return Formatter::formatProperty($r); }, $relatedRows);
        $details['hotDeal'] = null;

        // WhatsApp Click to Chat URL
        $phoneRow = DB::queryOne("SELECT setting_value FROM business_settings WHERE setting_key = 'whatsapp_number'");
        $phone = $phoneRow ? preg_replace('/\D/', '', $phoneRow['setting_value']) : '250788000000';
        $siteUrlRow = DB::queryOne("SELECT setting_value FROM business_settings WHERE setting_key = 'site_url'");
        $siteUrl = $siteUrlRow ? rtrim($siteUrlRow['setting_value'], '/') : 'https://keypropertyrwanda.com';

        $msg = "Hello Key Property Rwanda, I am interested in \"{$details['title']}\"\n"
             . "Reference: {$details['reference']}\n"
             . "{$siteUrl}/property/{$details['slug']}\n"
             . "Please share more details.";
        $details['whatsappUrl'] = "https://wa.me/{$phone}?text=" . rawurlencode($msg);

        // JSON-LD Structured Data
        $details['structuredData'] = [
            '@context' => 'https://schema.org',
            '@type' => 'RealEstateListing',
            'name' => $details['title'],
            'description' => $details['description'],
            'url' => "{$siteUrl}/property/{$details['slug']}",
            'price' => (string) $details['price'],
            'priceCurrency' => $details['currency'],
        ];

        Response::json($details);
    }

    public static function featured(): void {
        $limit = max(1, min(50, (int)($_GET['limit'] ?? 12)));

        $sql = "
            SELECT p.*,
                   c.name as category_name, c.slug as category_slug, c.type_group as category_type_group,
                   (SELECT file_path FROM property_images pi WHERE pi.property_id = p.id ORDER BY pi.sort_order ASC, pi.id ASC LIMIT 1) as main_image,
                   (SELECT COUNT(*) FROM property_images pi WHERE pi.property_id = p.id) as image_count,
                   1 as is_featured,
                   fpc.id as featured_id,
                   fpc.label as featured_label
            FROM featured_property_campaigns fpc
            JOIN properties p ON fpc.property_id = p.id
            LEFT JOIN property_categories c ON p.category_id = c.id
            WHERE p.publication_status = 'published' AND p.availability_status = 'available'
              AND fpc.is_active = 1
              AND fpc.start_at <= NOW() AND (fpc.end_at IS NULL OR fpc.end_at > NOW())
            ORDER BY fpc.priority_in_search DESC, fpc.display_order ASC, fpc.id DESC
            LIMIT {$limit}
        ";

        $rows = DB::query($sql);
        $items = array_map(function($r) {
            $formatted = Formatter::formatProperty($r);
            $formatted['featuredId'] = (int) $r['featured_id'];
            $formatted['featuredLabel'] = $r['featured_label'];
            return $formatted;
        }, $rows);
        Response::json($items);
    }

    public static function hotDeals(): void {
        $page = max(1, (int)($_GET['page'] ?? 1));
        $limit = max(1, min(50, (int)($_GET['limit'] ?? 12)));
        $offset = ($page - 1) * $limit;

        $countRow = DB::queryOne("
            SELECT COUNT(*) as total
            FROM hot_deals hd
            JOIN properties p ON hd.property_id = p.id
            WHERE p.publication_status = 'published' AND p.availability_status = 'available'
              AND hd.status = 'active'
              AND hd.start_at <= NOW() AND (hd.end_at IS NULL OR hd.end_at > NOW())
        ");
        $total = (int) ($countRow['total'] ?? 0);

        $sql = "
            SELECT hd.*,
                   p.reference AS property_reference, p.title AS property_title, p.slug AS property_slug,
                   p.price AS property_price, p.currency AS property_currency, p.price_period AS property_price_period,
                   p.purpose AS property_purpose, p.district, p.city, p.neighborhood, p.bedrooms, p.bathrooms,
                   p.publication_status, p.availability_status,
                   (SELECT pi.file_path FROM property_images pi WHERE pi.property_id = p.id ORDER BY pi.sort_order ASC, pi.id ASC LIMIT 1) AS main_image
            FROM hot_deals hd
            JOIN properties p ON hd.property_id = p.id
            WHERE p.publication_status = 'published' AND p.availability_status = 'available'
              AND hd.status = 'active'
              AND hd.start_at <= NOW() AND (hd.end_at IS NULL OR hd.end_at > NOW())
            ORDER BY hd.display_order ASC, hd.id DESC
            LIMIT {$limit} OFFSET {$offset}
        ";

        $phoneRow = DB::queryOne("SELECT setting_value FROM business_settings WHERE setting_key = 'whatsapp_number'");
        $phone = $phoneRow ? preg_replace('/\D/', '', $phoneRow['setting_value']) : '250788000000';

        $rows = DB::query($sql);
        $items = array_map(function($r) use ($phone) {
            $verified = !empty($r['original_price_verified']) && $r['original_price'] !== null;
            $mainImg = $r['main_image'];
            if ($mainImg && !str_starts_with($mainImg, 'http') && !str_starts_with($mainImg, '/')) {
                $mainImg = '/uploads/' . $mainImg;
            }

            $waMsg = "Hello Key Property Rwanda, I am interested in the Hot Deal \"{$r['title']}\" for {$r['property_title']} (Ref: {$r['property_reference']}).";

            return [
                'id' => (int) $r['id'],
                'title' => $r['title'],
                'description' => $r['description'],
                'promotionalPrice' => (float) $r['promotional_price'],
                'currency' => $r['currency'] ?? 'RWF',
                'originalPrice' => $verified ? (float)$r['original_price'] : null,
                'discountAmount' => $verified && $r['discount_amount'] !== null ? (float)$r['discount_amount'] : null,
                'discountPercentage' => $verified && $r['discount_percentage'] !== null ? (float)$r['discount_percentage'] : null,
                'startAt' => $r['start_at'] ? date('c', strtotime($r['start_at'])) : null,
                'endAt' => $r['end_at'] ? date('c', strtotime($r['end_at'])) : null,
                'property' => [
                    'id' => (int) $r['property_id'],
                    'reference' => $r['property_reference'],
                    'title' => $r['property_title'],
                    'slug' => $r['property_slug'],
                    'purpose' => $r['property_purpose'],
                    'pricePeriod' => $r['property_price_period'] ?? 'total',
                    'district' => $r['district'],
                    'city' => $r['city'],
                    'neighborhood' => $r['neighborhood'],
                    'bedrooms' => $r['bedrooms'] !== null ? (int)$r['bedrooms'] : null,
                    'bathrooms' => $r['bathrooms'] !== null ? (float)$r['bathrooms'] : null,
                    'mainImage' => $mainImg,
                ],
                'whatsappUrl' => "https://wa.me/{$phone}?text=" . rawurlencode($waMsg),
            ];
        }, $rows);

        Response::json($items, 200, [
            'total' => $total,
            'page' => $page,
            'limit' => $limit,
            'totalPages' => (int) ceil($total / $limit)
        ]);
    }

    public static function promotions(): void {
        $where = ["p.status IN ('scheduled', 'active')", "p.start_at <= NOW()", "(p.end_at IS NULL OR p.end_at > NOW())"];
        $params = [];

        if (!empty($_GET['placement'])) {
            $where[] = "p.placement = ?";
            $params[] = $_GET['placement'];
        }

        $whereClause = implode(' AND ', $where);
        $rows = DB::query("
            SELECT p.*, c.name as category_name, c.slug as category_slug
            FROM promotions p
            LEFT JOIN property_categories c ON p.category_id = c.id
            WHERE {$whereClause}
            ORDER BY p.display_order ASC, p.id DESC
        ", $params);

        $items = array_map(function($p) {
            $banner = $p['banner_image'];
            if ($banner && !str_starts_with($banner, 'http') && !str_starts_with($banner, '/')) {
                $banner = '/uploads/' . $banner;
            }
            return [
                'id' => (int) $p['id'],
                'name' => $p['name'],
                'title' => $p['name'],
                'slug' => $p['slug'],
                'description' => $p['description'],
                'bannerImage' => $banner,
                'campaignType' => $p['campaign_type'],
                'category' => $p['category_id'] ? [
                    'id' => (int)$p['category_id'],
                    'name' => $p['category_name'],
                    'slug' => $p['category_slug']
                ] : null,
                'placement' => $p['placement'],
                'destinationUrl' => $p['destination_url'],
                'startAt' => $p['start_at'] ? date('c', strtotime($p['start_at'])) : null,
                'endAt' => $p['end_at'] ? date('c', strtotime($p['end_at'])) : null,
            ];
        }, $rows);

        Response::json($items);
    }

    public static function advertisements(): void {
        $where = [
            "a.status IN ('scheduled', 'active')",
            "a.start_at <= NOW()",
            "(a.end_at IS NULL OR a.end_at > NOW())",
            "p.is_active = 1",
            "(a.property_id IS NULL OR (listing.publication_status = 'published' AND listing.availability_status = 'available'))",
        ];
        $params = [];

        if (!empty($_GET['placement'])) {
            $where[] = "p.slug = ?";
            $params[] = $_GET['placement'];
        }

        $whereClause = implode(' AND ', $where);
        $rows = DB::query("
            SELECT a.*, p.slug as placement_slug
            FROM advertisements a
            JOIN advertisement_placements p ON a.placement_id = p.id
            LEFT JOIN properties listing ON listing.id = a.property_id
            WHERE {$whereClause}
            ORDER BY a.display_order ASC, a.id DESC
        ", $params);

        $items = array_map(function($a) {
            $desk = $a['desktop_image'];
            if ($desk && !str_starts_with($desk, 'http') && !str_starts_with($desk, '/')) $desk = '/uploads/' . $desk;
            $mob = $a['mobile_image'];
            if ($mob && !str_starts_with($mob, 'http') && !str_starts_with($mob, '/')) $mob = '/uploads/' . $mob;

            return [
                'id' => (int) $a['id'],
                'headline' => $a['headline'],
                'title' => $a['headline'],
                'description' => $a['description'],
                'desktopImage' => $desk,
                'imageDesktop' => $desk,
                'mobileImage' => $mob,
                'imageMobile' => $mob,
                'destinationUrl' => $a['destination_url'],
                'targetUrl' => $a['destination_url'],
                'placement' => $a['placement_slug'],
            ];
        }, $rows);

        Response::json($items);
    }

    public static function submitInquiry(): void {
        $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;

        $fullName = trim($input['fullName'] ?? $input['customerName'] ?? '');
        $email = trim($input['email'] ?? '');
        $phone = trim($input['phone'] ?? '');
        $message = trim($input['message'] ?? '');
        $propertyId = !empty($input['propertyId']) ? (int)$input['propertyId'] : null;

        if ($fullName === '' || ($email === '' && $phone === '')) {
            Response::error('Name and contact method are required.', 'VALIDATION_ERROR', 422);
        }

        $pref = !empty($phone) ? 'phone' : 'email';

        DB::execute("
            INSERT INTO inquiries (
                property_id, customer_name, email, phone, message, preferred_contact, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, 'new', NOW(), NOW())
        ", [$propertyId, $fullName, $email ?: null, $phone ?: null, $message ?: null, $pref]);

        $id = DB::lastInsertId();
        Response::json(['id' => $id, 'message' => 'Thank you for your inquiry. Our agent will contact you shortly!'], 201);
    }
}

<?php
declare(strict_types=1);

error_reporting(E_ALL);
ini_set('display_errors', '0');
ini_set('log_errors', '1');

// CORS Headers
$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
header("Access-Control-Allow-Origin: {$origin}");
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-CSRF-Token, X-Requested-With');
header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/response.php';
require_once __DIR__ . '/formatter.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/public_controller.php';
require_once __DIR__ . '/auth_controller.php';
require_once __DIR__ . '/admin_controller.php';

// Parse request
$uri = $_SERVER['REQUEST_URI'] ?? '/';
$path = parse_url($uri, PHP_URL_PATH) ?: '/';
$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

// Strip /api/v1 prefix
if (str_starts_with($path, '/api/v1/')) {
    $sub = substr($path, strlen('/api/v1'));
} elseif (str_starts_with($path, '/api/')) {
    $sub = substr($path, strlen('/api'));
} else {
    $sub = $path;
}
$sub = rtrim($sub, '/') ?: '/';

// ====================== ROUTING ======================
try {

// Health
if ($sub === '/health' && $method === 'GET') {
    try { DB::query("SELECT 1"); Response::json(['status' => 'ok', 'database' => ['status' => 'up']]); }
    catch (Throwable $e) { Response::error('Database unreachable', 'SERVICE_UNAVAILABLE', 503); }
}

// ---- Auth ----
if ($sub === '/auth/csrf' && $method === 'GET') AuthController::csrf();
if ($sub === '/auth/login' && $method === 'POST') AuthController::login();
if ($sub === '/auth/logout' && $method === 'POST') AuthController::logout();
if ($sub === '/auth/me' && $method === 'GET') AuthController::me();
if ($sub === '/auth/change-password' && $method === 'POST') AuthController::changePassword();

// ---- Public ----
if ($sub === '/site' && $method === 'GET') PublicController::site();
if ($sub === '/hero' && $method === 'GET') PublicController::hero();
if ($sub === '/categories' && $method === 'GET') PublicController::categories();
if ($sub === '/locations' && $method === 'GET') PublicController::locations();
if ($sub === '/featured' && $method === 'GET') PublicController::featured();
if ($sub === '/hot-deals' && $method === 'GET') PublicController::hotDeals();
if ($sub === '/promotions' && $method === 'GET') PublicController::promotions();
if ($sub === '/advertisements' && $method === 'GET') PublicController::advertisements();
if ($sub === '/properties' && $method === 'GET') PublicController::properties();
if ($sub === '/inquiries' && $method === 'POST') PublicController::submitInquiry();
if (preg_match('#^/properties/([a-z0-9_-]+)$#i', $sub, $m) && $method === 'GET') PublicController::propertyDetails($m[1]);
if (preg_match('#^/content/([a-z0-9_-]+)$#i', $sub, $m) && $method === 'GET') PublicController::content($m[1]);
if (preg_match('#^/promotions/([a-z0-9_-]+)$#i', $sub, $m) && $method === 'GET') {
    $row = DB::queryOne("SELECT * FROM promotions WHERE slug = ? AND status = 'active'", [$m[1]]);
    if (!$row) Response::error('Promotion not found', 'NOT_FOUND', 404);
    $banner = $row['banner_image'];
    if ($banner && !str_starts_with($banner, 'http') && !str_starts_with($banner, '/')) $banner = '/uploads/' . $banner;
    $propRows = DB::query("SELECT p.*, c.name as category_name, c.slug as category_slug, c.type_group as category_type_group,
        (SELECT file_path FROM property_images pi WHERE pi.property_id = p.id ORDER BY pi.sort_order ASC LIMIT 1) as main_image,
        (SELECT COUNT(*) FROM property_images pi WHERE pi.property_id = p.id) as image_count
        FROM promotion_properties pp
        JOIN properties p ON pp.property_id = p.id
        LEFT JOIN property_categories c ON p.category_id = c.id
        WHERE pp.promotion_id = ? AND p.publication_status = 'published'", [(int)$row['id']]);
    Response::json([
        'id' => (int)$row['id'], 'title' => $row['name'], 'slug' => $row['slug'],
        'description' => $row['description'], 'bannerImage' => $banner,
        'targetUrl' => $row['destination_url'],
        'startsAt' => $row['start_at'] ? date('c', strtotime($row['start_at'])) : null,
        'endsAt' => $row['end_at'] ? date('c', strtotime($row['end_at'])) : null,
        'properties' => array_map(function($r) { return Formatter::formatProperty($r); }, $propRows),
    ]);
}

// Event tracking (ad clicks, campaign clicks)
if ($sub === '/events/ad' && $method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
    $adId = (int)($input['advertisementId'] ?? 0);
    $event = $input['eventType'] ?? 'click';
    if ($adId <= 0 || !in_array($event, ['impression', 'click'], true)) Response::error('Invalid advertisement event', 'VALIDATION_ERROR', 422);
    $ad = DB::queryOne("
        SELECT a.placement_id FROM advertisements a JOIN advertisement_placements pl ON pl.id = a.placement_id
        LEFT JOIN properties p ON p.id = a.property_id
        WHERE a.id = ? AND a.status IN ('scheduled','active') AND a.start_at <= NOW()
          AND (a.end_at IS NULL OR a.end_at > NOW()) AND pl.is_active = 1
          AND (a.property_id IS NULL OR (p.publication_status = 'published' AND p.availability_status = 'available'))
    ", [$adId]);
    if ($ad) {
        $visitor = hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . '|' . ($_SERVER['HTTP_USER_AGENT'] ?? ''));
        DB::execute(
            "INSERT IGNORE INTO advertisement_events (advertisement_id, placement_id, event_type, visitor_hash, event_date, created_at) VALUES (?, ?, ?, ?, UTC_DATE(), NOW())",
            [$adId, $ad['placement_id'], $event, $visitor]
        );
    }
    Response::json(['message' => 'ok']);
}
if ($sub === '/events/campaign' && $method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
    $type = $input['entityType'] ?? '';
    $entityId = (int)($input['entityId'] ?? 0);
    $event = $input['eventType'] ?? 'click';
    if (!in_array($type, ['promotion', 'hot_deal', 'featured'], true) || $entityId <= 0 || !in_array($event, ['view', 'click'], true)) {
        Response::error('Invalid campaign event', 'VALIDATION_ERROR', 422);
    }
    $visitor = hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . '|' . ($_SERVER['HTTP_USER_AGENT'] ?? ''));
    DB::execute(
        "INSERT IGNORE INTO campaign_events (entity_type, entity_id, event_type, visitor_hash, event_date, created_at) VALUES (?, ?, ?, ?, UTC_DATE(), NOW())",
        [$type, $entityId, $event, $visitor]
    );
    Response::json(['message' => 'ok']);
}

// ---- Admin ----
if ($sub === '/admin/dashboard' && $method === 'GET') AdminController::dashboard();
if ($sub === '/admin/properties' && $method === 'GET') AdminController::properties();
if ($sub === '/admin/properties' && $method === 'POST') AdminController::propertyCreate();
if ($sub === '/admin/properties/options' && $method === 'GET') AdminController::propertyOptions();
if ($sub === '/admin/amenities' && $method === 'GET') AdminController::amenities();
if ($sub === '/admin/properties/export' && $method === 'GET') {
    Auth::requirePermission('properties.export');
    // Simple CSV export
    $rows = DB::query("SELECT p.*, c.name as category_name FROM properties p LEFT JOIN property_categories c ON p.category_id = c.id ORDER BY p.id ASC");
    header('Content-Type: text/csv; charset=UTF-8');
    header('Content-Disposition: attachment; filename="properties_export.csv"');
    $fp = fopen('php://output', 'w');
    if (!empty($rows)) {
        fputcsv($fp, array_keys($rows[0]));
        foreach ($rows as $row) fputcsv($fp, $row);
    }
    fclose($fp);
    exit;
}

if (preg_match('#^/admin/properties/(\d+)$#', $sub, $m)) {
    $id = (int)$m[1];
    if ($method === 'GET') AdminController::propertyGet($id);
    if ($method === 'PUT') AdminController::propertyUpdate($id);
}
if (preg_match('#^/admin/properties/(\d+)/publish$#', $sub, $m) && $method === 'POST') AdminController::propertyPublish((int)$m[1]);
if (preg_match('#^/admin/properties/(\d+)/unpublish$#', $sub, $m) && $method === 'POST') AdminController::propertyUnpublish((int)$m[1]);
if (preg_match('#^/admin/properties/(\d+)/archive$#', $sub, $m) && $method === 'POST') AdminController::propertyArchive((int)$m[1]);
if (preg_match('#^/admin/properties/(\d+)/restore$#', $sub, $m) && $method === 'POST') AdminController::propertyRestore((int)$m[1]);
if (preg_match('#^/admin/properties/(\d+)/images$#', $sub, $m) && $method === 'POST') AdminController::uploadImages((int)$m[1]);
if (preg_match('#^/admin/properties/(\d+)/images/reorder$#', $sub, $m) && ($method === 'POST' || $method === 'PUT')) AdminController::reorderImages((int)$m[1]);
if (preg_match('#^/admin/properties/(\d+)/images/(\d+)$#', $sub, $m)) {
    if ($method === 'DELETE') AdminController::deleteImage((int)$m[1], (int)$m[2]);
    if ($method === 'PATCH' || $method === 'PUT') AdminController::updateImage((int)$m[1], (int)$m[2]);
}

// Inquiries
if ($sub === '/admin/inquiries' && $method === 'GET') AdminController::inquiries();
if ($sub === '/admin/inquiries/staff' && $method === 'GET') AdminController::inquiryStaff();
if (preg_match('#^/admin/inquiries/(\d+)$#', $sub, $m)) {
    $id = (int)$m[1];
    if ($method === 'GET') AdminController::inquiryGet($id);
    if ($method === 'PATCH' || $method === 'PUT') AdminController::inquiryUpdate($id);
}
if (preg_match('#^/admin/inquiries/(\d+)/notes$#', $sub, $m) && $method === 'POST') AdminController::inquiryAddNote((int)$m[1]);

// Featured properties, advertisements, and promotions
if ($sub === '/admin/uploads' && $method === 'POST') AdminController::uploadCampaignImage();
if ($sub === '/admin/featured' && ($method === 'GET' || $method === 'POST')) AdminController::featured();
if (preg_match('#^/admin/featured/(\d+)$#', $sub, $m) && $method === 'PUT') AdminController::featuredUpdate((int)$m[1]);
if (preg_match('#^/admin/featured/(\d+)/(activate|deactivate)$#', $sub, $m) && $method === 'POST') AdminController::featuredAction((int)$m[1], $m[2]);
if (preg_match('#^/admin/featured/(\d+)$#', $sub, $m) && $method === 'DELETE') AdminController::featuredAction((int)$m[1], 'delete');

if ($sub === '/admin/hot-deals' && ($method === 'GET' || $method === 'POST')) {
    if ($method === 'GET') AdminController::hotDeals();
    if ($method === 'POST') AdminController::hotDealCreate();
}
if ($sub === '/admin/hot-deals/calculate' && $method === 'POST') AdminController::hotDealCalculate();
if (preg_match('#^/admin/hot-deals/(\d+)$#', $sub, $m)) {
    if ($method === 'GET') AdminController::hotDealGet((int)$m[1]);
    if ($method === 'PUT') AdminController::hotDealUpdate((int)$m[1]);
}
if (preg_match('#^/admin/hot-deals/(\d+)/(activate|pause|end)$#', $sub, $m) && $method === 'POST') AdminController::hotDealAction((int)$m[1], $m[2]);

if ($sub === '/admin/advertisement-placements' && $method === 'GET') AdminController::advertisementPlacements();
if ($sub === '/admin/advertisements' && ($method === 'GET' || $method === 'POST')) AdminController::advertisements();
if (preg_match('#^/admin/advertisements/(\d+)$#', $sub, $m)) {
    if ($method === 'GET') AdminController::advertisementGet((int)$m[1]);
    if ($method === 'PUT') AdminController::advertisementUpdate((int)$m[1]);
}
if (preg_match('#^/admin/advertisements/(\d+)/(publish|pause|archive|restore)$#', $sub, $m) && $method === 'POST') AdminController::advertisementAction((int)$m[1], $m[2]);

if ($sub === '/admin/promotions' && ($method === 'GET' || $method === 'POST')) AdminController::promotions();
if (preg_match('#^/admin/promotions/(\d+)$#', $sub, $m)) {
    if ($method === 'GET') AdminController::promotionGet((int)$m[1]);
    if ($method === 'PUT') AdminController::promotionUpdate((int)$m[1]);
}
if (preg_match('#^/admin/promotions/(\d+)/(publish|pause|archive|restore)$#', $sub, $m) && $method === 'POST') AdminController::promotionAction((int)$m[1], $m[2]);

// Settings
if ($sub === '/admin/settings' && ($method === 'GET' || $method === 'PUT' || $method === 'POST')) AdminController::settings();

// Categories
if ($sub === '/admin/categories' && $method === 'GET') AdminController::categories();
if ($sub === '/admin/categories' && $method === 'POST') AdminController::categoryCreate();
if (preg_match('#^/admin/categories/(\d+)$#', $sub, $m)) {
    $id = (int)$m[1];
    if ($method === 'PUT' || $method === 'PATCH') AdminController::categoryUpdate($id);
    if ($method === 'DELETE') AdminController::categoryDelete($id);
}

// Users
if ($sub === '/admin/users' && $method === 'GET') AdminController::users();
if ($sub === '/admin/users' && $method === 'POST') AdminController::userCreate();
if (preg_match('#^/admin/users/(\d+)$#', $sub, $m) && ($method === 'PUT' || $method === 'PATCH')) AdminController::userUpdate((int)$m[1]);

// Roles
if ($sub === '/admin/roles' && $method === 'GET') AdminController::roles();
if ($sub === '/admin/roles' && $method === 'POST') AdminController::roleCreate();
if (preg_match('#^/admin/roles/(\d+)$#', $sub, $m)) {
    if ($method === 'PUT' || $method === 'PATCH') AdminController::roleUpdate((int)$m[1]);
    if ($method === 'DELETE') AdminController::roleDelete((int)$m[1]);
}

// Content
if ($sub === '/admin/content' && $method === 'GET') AdminController::content();
if (preg_match('#^/admin/content/([a-z0-9_-]+)$#i', $sub, $m) && ($method === 'PUT' || $method === 'PATCH')) AdminController::contentUpdate($m[1]);

// Hero slides
if ($sub === '/admin/hero' && $method === 'GET') AdminController::heroSlides();
if ($sub === '/admin/hero/slides' && $method === 'POST') AdminController::heroSlideCreate();
if ($sub === '/admin/hero/slides/order' && ($method === 'PUT' || $method === 'POST')) AdminController::heroSlidesReorder();
if (preg_match('#^/admin/hero/slides/(\d+)$#', $sub, $m)) {
    if ($method === 'PUT') AdminController::heroSlideUpdate((int)$m[1]);
    if ($method === 'DELETE') AdminController::heroSlideDelete((int)$m[1]);
}
if ($sub === '/admin/hero/settings' && ($method === 'PUT' || $method === 'POST')) AdminController::heroSettingsUpdate();

// Audit logs
if ($sub === '/admin/analytics' && $method === 'GET') AdminController::analytics();
if ($sub === '/admin/audit-logs/filters' && $method === 'GET') AdminController::auditLogFilters();
if ($sub === '/admin/audit-logs' && $method === 'GET') AdminController::auditLogs();

// 404 fallback
Response::error("API endpoint not found: {$method} {$sub}", 'NOT_FOUND', 404);

} catch (Throwable $e) {
    error_log("PHP API Error: " . $e->getMessage() . " in " . $e->getFile() . ":" . $e->getLine());
    Response::error("Internal server error: " . $e->getMessage(), 'SERVER_ERROR', 500);
}

<?php
declare(strict_types=1);

class Auth {
    public static function startSession(): void {
        if (session_status() === PHP_SESSION_NONE) {
            // Set session cookie parameters
            $isSecure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (isset($_SERVER['SERVER_PORT']) && $_SERVER['SERVER_PORT'] == 443);
            session_set_cookie_params([
                'lifetime' => 8 * 3600, // 8 hours
                'path' => '/',
                'domain' => '',
                'secure' => $isSecure,
                'httponly' => true,
                'samesite' => 'Lax'
            ]);
            session_start();
        }

        if (empty($_SESSION['csrf_token'])) {
            $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        }
    }

    public static function getCsrfToken(): string {
        self::startSession();
        return $_SESSION['csrf_token'];
    }

    public static function verifyCsrf(): void {
        self::startSession();
        $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
        if (in_array($method, ['GET', 'HEAD', 'OPTIONS'])) {
            return;
        }

        $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? $_POST['_csrf'] ?? null;
        if (!$token || !hash_equals($_SESSION['csrf_token'] ?? '', $token)) {
            // In API context, check if we have a valid session anyway or reject
            Response::error('Invalid or missing CSRF token', 'CSRF_INVALID', 403);
        }
    }

    public static function getUser(): ?array {
        self::startSession();
        $userId = $_SESSION['user_id'] ?? null;
        if (!$userId) {
            return null;
        }

        $user = DB::queryOne(
            "SELECT u.id, u.role_id, u.full_name, u.email, u.phone, u.status, u.locked_until,
                    u.last_login_at, u.password_changed_at, u.created_at, u.updated_at,
                    r.id as r_id, r.name as r_name, r.slug as r_slug
             FROM users u
             LEFT JOIN roles r ON u.role_id = r.id
             WHERE u.id = ? AND u.status = 'active'",
            [$userId]
        );

        if (!$user) {
            return null;
        }

        // Fetch permissions for this role
        $perms = DB::query(
            "SELECT p.slug
             FROM role_permissions rp
             JOIN permissions p ON rp.permission_id = p.id
             WHERE rp.role_id = ?",
            [$user['role_id']]
        );

        return [
            'id' => (int) $user['id'],
            'fullName' => $user['full_name'],
            'email' => $user['email'],
            'phone' => $user['phone'],
            'status' => $user['status'],
            'role' => [
                'id' => (int) $user['r_id'],
                'name' => $user['r_name'],
                'slug' => $user['r_slug'],
            ],
            'lockedUntil' => $user['locked_until'] ? date('c', strtotime($user['locked_until'])) : null,
            'lastLoginAt' => $user['last_login_at'] ? date('c', strtotime($user['last_login_at'])) : null,
            'passwordChangedAt' => $user['password_changed_at'] ? date('c', strtotime($user['password_changed_at'])) : null,
            'createdAt' => $user['created_at'] ? date('c', strtotime($user['created_at'])) : null,
            'updatedAt' => $user['updated_at'] ? date('c', strtotime($user['updated_at'])) : null,
            'permissions' => array_column($perms, 'slug'),
        ];
    }

    public static function requireAuth(): array {
        $user = self::getUser();
        if (!$user) {
            Response::error('Authentication required', 'UNAUTHORIZED', 401);
        }
        return $user;
    }

    public static function requirePermission(string $permission): array {
        $user = self::requireAuth();
        if (!in_array($permission, $user['permissions'], true) && ($user['role']['slug'] ?? '') !== 'super_admin') {
            Response::error("Forbidden: requires permission {$permission}", 'FORBIDDEN', 403);
        }
        return $user;
    }

    public static function requireAnyPermission(array $permissions): array {
        $user = self::requireAuth();
        if (($user['role']['slug'] ?? '') === 'super_admin') {
            return $user;
        }
        foreach ($permissions as $p) {
            if (in_array($p, $user['permissions'], true)) {
                return $user;
            }
        }
        Response::error("Forbidden: missing required permission", 'FORBIDDEN', 403);
        return $user;
    }
}

<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/response.php';
require_once __DIR__ . '/auth.php';

class AuthController {
    public static function csrf(): void {
        $token = Auth::getCsrfToken();
        Response::json(['csrfToken' => $token]);
    }

    public static function login(): void {
        Auth::verifyCsrf();
        $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;

        $email = trim($input['email'] ?? '');
        $password = $input['password'] ?? '';

        if ($email === '' || $password === '') {
            Response::error('Email and password are required', 'VALIDATION_ERROR', 422);
        }

        $user = DB::queryOne("SELECT * FROM users WHERE email = ?", [$email]);
        if (!$user) {
            Response::error('Invalid email or password', 'INVALID_CREDENTIALS', 401);
        }

        if ($user['status'] !== 'active') {
            Response::error('Account is inactive or disabled', 'ACCOUNT_DISABLED', 403);
        }

        // Verify password using native bcrypt or converted $2y$ format
        $storedHash = $user['password_hash'];
        $hashForPhp = str_starts_with($storedHash, '$2b$') ? '$2y$' . substr($storedHash, 4) : $storedHash;

        if (!password_verify($password, $hashForPhp) && !password_verify($password, $storedHash)) {
            Response::error('Invalid email or password', 'INVALID_CREDENTIALS', 401);
        }

        // Session authentication
        $_SESSION['user_id'] = (int) $user['id'];
        DB::execute("UPDATE users SET last_login_at = NOW(), failed_login_attempts = 0 WHERE id = ?", [$user['id']]);

        $userData = Auth::getUser();
        Response::json([
            'user' => $userData,
            'csrfToken' => Auth::getCsrfToken(),
        ]);
    }

    public static function logout(): void {
        Auth::startSession();
        $_SESSION = [];
        if (ini_get("session.use_cookies")) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000,
                $params["path"], $params["domain"],
                $params["secure"], $params["httponly"]
            );
        }
        session_destroy();
        Response::json(['message' => 'Logged out successfully']);
    }

    public static function me(): void {
        $user = Auth::getUser();
        if (!$user) {
            Response::error('Not authenticated', 'UNAUTHORIZED', 401);
        }
        Response::json(['user' => $user]);
    }

    public static function changePassword(): void {
        $user = Auth::requireAuth();
        Auth::verifyCsrf();
        $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;

        $currentPass = $input['currentPassword'] ?? '';
        $newPass     = $input['newPassword'] ?? '';

        if (strlen($newPass) < 8) {
            Response::error('New password must be at least 8 characters long', 'VALIDATION_ERROR', 422);
        }

        $row = DB::queryOne("SELECT password_hash FROM users WHERE id = ?", [$user['id']]);
        $storedHash = $row['password_hash'];
        $hashForPhp = str_starts_with($storedHash, '$2b$') ? '$2y$' . substr($storedHash, 4) : $storedHash;

        if (!password_verify($currentPass, $hashForPhp)) {
            Response::error('Current password does not match', 'INVALID_CREDENTIALS', 400);
        }

        $newHash = password_hash($newPass, PASSWORD_BCRYPT, ['cost' => 12]);
        DB::execute("UPDATE users SET password_hash = ?, password_changed_at = NOW() WHERE id = ?", [$newHash, $user['id']]);

        Response::json(['message' => 'Password updated successfully']);
    }
}

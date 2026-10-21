<?php
declare(strict_types=1);

/**
 * Key Property Rwanda — Database Connection & Helper Functions
 */

class DB {
    private static ?PDO $pdo = null;

    public static function getConnection(): PDO {
        if (self::$pdo !== null) {
            return self::$pdo;
        }

        // Allow overriding via environment variables or default to local/standard settings
        $host = getenv('DB_HOST') ?: 'localhost';
        $port = getenv('DB_PORT') ?: '3306';
        $db   = getenv('DB_NAME') ?: 'key_property_rwanda';
        $user = getenv('DB_USER') ?: 'root';
        $pass = getenv('DB_PASSWORD') !== false ? getenv('DB_PASSWORD') : '';

        // Also check if .env file exists in root or parent
        $envFile = dirname(__DIR__) . '/.env';
        if (file_exists($envFile)) {
            $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            foreach ($lines as $line) {
                $line = trim($line);
                if ($line === '' || str_starts_with($line, '#')) continue;
                if (str_contains($line, '=')) {
                    [$k, $v] = explode('=', $line, 2);
                    $k = trim($k);
                    $v = trim($v, " \t\n\r\0\x0B\"'");
                    if ($k === 'DB_HOST' && empty(getenv('DB_HOST'))) $host = $v;
                    if ($k === 'DB_PORT' && empty(getenv('DB_PORT'))) $port = $v;
                    if ($k === 'DB_NAME' && empty(getenv('DB_NAME'))) $db = $v;
                    if ($k === 'DB_USER' && empty(getenv('DB_USER'))) $user = $v;
                    if ($k === 'DB_PASSWORD' && getenv('DB_PASSWORD') === false) $pass = $v;
                }
            }
        }

        $dsn = "mysql:host={$host};port={$port};dbname={$db};charset=utf8mb4";
        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ];

        try {
            self::$pdo = new PDO($dsn, $user, $pass, $options);
            self::$pdo->exec("SET time_zone = '+00:00'");
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'error' => [
                    'code' => 'DB_CONNECTION_ERROR',
                    'message' => 'Database connection failed: ' . $e->getMessage()
                ]
            ]);
            exit;
        }

        return self::$pdo;
    }

    public static function query(string $sql, array $params = []): array {
        $stmt = self::getConnection()->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public static function queryOne(string $sql, array $params = []): ?array {
        $stmt = self::getConnection()->prepare($sql);
        $stmt->execute($params);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public static function execute(string $sql, array $params = []): int {
        $stmt = self::getConnection()->prepare($sql);
        $stmt->execute($params);
        return $stmt->rowCount();
    }

    public static function lastInsertId(): int {
        return (int) self::getConnection()->lastInsertId();
    }
}

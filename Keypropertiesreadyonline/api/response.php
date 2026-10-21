<?php
declare(strict_types=1);

class Response {
    public static function json($data, int $status = 200, array $meta = null): void {
        http_response_code($status);
        $payload = ['success' => $status >= 200 && $status < 300];
        if ($data !== null) {
            $payload['data'] = $data;
        }
        if ($meta !== null) {
            $payload['meta'] = $meta;
        }
        echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        exit;
    }

    public static function error(string $message, string $code = 'BAD_REQUEST', int $status = 400, $details = null): void {
        http_response_code($status);
        $res = [
            'success' => false,
            'error' => [
                'code' => $code,
                'message' => $message,
            ]
        ];
        if ($details !== null) {
            $res['error']['details'] = $details;
        }
        echo json_encode($res, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        exit;
    }
}

<?php
declare(strict_types=1);

class Formatter {
    public static function uploadUrl(?string $path): ?string {
        if (!$path) return null;
        if (preg_match('#^https?://#i', $path) || str_starts_with($path, '/')) {
            return $path;
        }
        return '/uploads/' . $path;
    }

    public static function formatProperty(array $row, ?array $images = null, ?array $amenities = null): array {
        $specs = $row['specifications'] ?? [];
        if (is_string($specs) && $specs !== '') {
            $decoded = json_decode($specs, true);
            $specs = is_array($decoded) ? $decoded : [];
        } elseif (!is_array($specs)) {
            $specs = [];
        }

        $mainImage = !empty($row['main_image']) ? self::uploadUrl($row['main_image']) : null;

        $formatted = [
            'id' => (int) $row['id'],
            'reference' => $row['reference'] ?? ('KPR-' . str_pad((string)$row['id'], 5, '0', STR_PAD_LEFT)),
            'title' => $row['title'],
            'slug' => $row['slug'],
            'description' => $row['description'],
            'category' => [
                'id' => isset($row['category_id']) ? (int) $row['category_id'] : null,
                'name' => $row['category_name'] ?? null,
                'slug' => $row['category_slug'] ?? null,
                'typeGroup' => $row['category_type_group'] ?? null,
            ],
            'purpose' => $row['purpose'],
            'price' => (float) $row['price'],
            'currency' => $row['currency'] ?? 'RWF',
            'pricePeriod' => $row['price_period'] ?? 'total',
            'address' => $row['address'] ?? null,
            'neighborhood' => $row['neighborhood'] ?? null,
            'district' => $row['district'] ?? null,
            'city' => $row['city'] ?? null,
            'latitude' => $row['latitude'] !== null ? (float) $row['latitude'] : null,
            'longitude' => $row['longitude'] !== null ? (float) $row['longitude'] : null,
            'bedrooms' => $row['bedrooms'] !== null ? (int) $row['bedrooms'] : null,
            'bathrooms' => $row['bathrooms'] !== null ? (float) $row['bathrooms'] : null,
            'propertySize' => $row['property_size'] !== null ? (float) $row['property_size'] : null,
            'landSize' => $row['land_size'] !== null ? (float) $row['land_size'] : null,
            'specifications' => $specs,
            'videoUrl' => $row['video_url'] ?? null,
            'virtualTourUrl' => $row['virtual_tour_url'] ?? null,
            'availabilityStatus' => $row['availability_status'] ?? 'available',
            'publicationStatus' => $row['publication_status'] ?? 'draft',
            'publishedAt' => $row['published_at'] ? date('c', strtotime($row['published_at'])) : null,
            'archivedAt' => $row['archived_at'] ? date('c', strtotime($row['archived_at'])) : null,
            'createdAt' => $row['created_at'] ? date('c', strtotime($row['created_at'])) : null,
            'updatedAt' => $row['updated_at'] ? date('c', strtotime($row['updated_at'])) : null,
            'mainImage' => $mainImage,
            'imageCount' => (int) ($row['image_count'] ?? ($images ? count($images) : 0)),
            'isFeatured' => (bool) ($row['is_featured'] ?? false),
            'hasHotDeal' => (bool) ($row['has_hot_deal'] ?? false),
        ];

        // Ensure category object isn't completely empty if joined columns were missing
        if ($formatted['category']['id'] === null && isset($row['category_id'])) {
            $cat = DB::queryOne("SELECT id, name, slug, type_group FROM property_categories WHERE id = ?", [(int)$row['category_id']]);
            if ($cat) {
                $formatted['category'] = [
                    'id' => (int) $cat['id'],
                    'name' => $cat['name'],
                    'slug' => $cat['slug'],
                    'typeGroup' => $cat['type_group'],
                ];
            }
        }

        if ($images !== null) {
            $formatted['images'] = array_map(function($img) {
                return [
                    'id' => (int) $img['id'],
                    'url' => self::uploadUrl($img['file_path']),
                    'filePath' => $img['file_path'],
                    'originalName' => $img['original_name'] ?? null,
                    'mimeType' => $img['mime_type'] ?? null,
                    'sizeBytes' => isset($img['size_bytes']) ? (int) $img['size_bytes'] : null,
                    'altText' => $img['alt_text'] ?? null,
                    'sortOrder' => isset($img['sort_order']) ? (int) $img['sort_order'] : 0,
                    'createdAt' => !empty($img['created_at']) ? date('c', strtotime($img['created_at'])) : null,
                ];
            }, $images);

            if (!empty($images) && empty($formatted['mainImage'])) {
                $formatted['mainImage'] = self::uploadUrl($images[0]['file_path']);
            }
        }

        // Amenities: Frontend expects array of strings (names) like ["Garden", "Parking"]
        if ($amenities !== null) {
            $formatted['amenities'] = array_values(array_filter(array_map(function($a) {
                if (is_array($a)) {
                    return $a['name'] ?? null;
                }
                return is_string($a) ? $a : null;
            }, $amenities)));
        }

        return $formatted;
    }
}

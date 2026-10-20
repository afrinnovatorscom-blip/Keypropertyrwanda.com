// Homepage hero slides (text + background image), managed from Admin → Home Hero.
// The animation style and autoplay speed are stored in business_settings.

export const description = 'Homepage hero slides';

export const up = [
  `CREATE TABLE hero_slides (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    title VARCHAR(200) NOT NULL,
    subtitle VARCHAR(500) NULL,
    background_image VARCHAR(255) NULL,
    button_label VARCHAR(60) NULL,
    button_url VARCHAR(500) NULL,
    overlay_opacity TINYINT UNSIGNED NOT NULL DEFAULT 55,
    text_align ENUM('left','center') NOT NULL DEFAULT 'left',
    display_order INT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_by INT UNSIGNED NULL,
    updated_by INT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_hero_slides_active (is_active, display_order),
    CONSTRAINT fk_hero_slides_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT fk_hero_slides_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT chk_hero_slides_overlay CHECK (overlay_opacity <= 90)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];

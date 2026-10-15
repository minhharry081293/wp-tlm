<?php

if (!defined('ABSPATH')) {
    exit;
}

class WPCF_Render {
    public static function init() {
        add_action('wp_enqueue_scripts', array(__CLASS__, 'assets'));
        add_action('wp_footer', array(__CLASS__, 'output'), 99);
    }

    public static function get_items() {
        $banners = WPCF_Admin::get_banners();
        $items = array();
        foreach ($banners as $row) {
            $src = wp_get_attachment_image_url((int) $row['image_id'], 'full');
            if (!$src) {
                continue;
            }
            $items[] = array(
                'src' => $src,
                'url' => $row['url'],
                'alt' => get_the_title((int) $row['image_id']) ?: 'Banner',
            );
        }
        return $items;
    }

    public static function assets() {
        if (is_admin()) {
            return;
        }
        $items = self::get_items();
        if (empty($items)) {
            return;
        }
        wp_enqueue_style(
            'wpcf-catfish',
            WPCF_PLUGIN_URL . 'assets/catfish.css',
            array(),
            WPCF_VERSION
        );
        wp_enqueue_script(
            'wpcf-catfish',
            WPCF_PLUGIN_URL . 'assets/catfish.js',
            array(),
            WPCF_VERSION,
            true
        );
    }

    public static function output() {
        if (is_admin()) {
            return;
        }
        $items = self::get_items();
        if (empty($items)) {
            return;
        }
        $single = count($items) === 1;
        ?>
        <div id="wpcf-catfish" class="wpcf-catfish<?php echo $single ? ' wpcf-catfish--single' : ''; ?>">
            <div class="wpcf-inner">
                <button type="button" class="wpcf-close" id="wpcf-close" aria-label="Đóng">X [ĐÓNG]</button>
                <div class="wpcf-grid">
                    <?php foreach ($items as $item) : ?>
                        <?php if ($item['url'] !== '') : ?>
                            <a class="wpcf-item" href="<?php echo esc_attr($item['url']); ?>" target="_blank" rel="noopener noreferrer nofollow">
                                <img src="<?php echo esc_url($item['src']); ?>" alt="<?php echo esc_attr($item['alt']); ?>" loading="lazy" />
                            </a>
                        <?php else : ?>
                            <span class="wpcf-item">
                                <img src="<?php echo esc_url($item['src']); ?>" alt="<?php echo esc_attr($item['alt']); ?>" loading="lazy" />
                            </span>
                        <?php endif; ?>
                    <?php endforeach; ?>
                </div>
            </div>
        </div>
        <?php
    }
}

<?php

if (!defined('ABSPATH')) {
    exit;
}

class WPCF_Admin {
    public static function init() {
        add_action('admin_menu', array(__CLASS__, 'menu'));
        add_action('admin_enqueue_scripts', array(__CLASS__, 'enqueue'));
        add_action('admin_post_wpcf_save', array(__CLASS__, 'save'));
    }

    public static function menu() {
        add_options_page(
            'Catfish Banner',
            'Catfish Banner',
            'manage_options',
            'wp-catfish',
            array(__CLASS__, 'render_page')
        );
    }

    public static function enqueue($hook) {
        if ($hook !== 'settings_page_wp-catfish') {
            return;
        }
        wp_enqueue_media();
        wp_enqueue_script(
            'wpcf-admin',
            WPCF_PLUGIN_URL . 'assets/admin.js',
            array('jquery'),
            WPCF_VERSION,
            true
        );
        wp_localize_script('wpcf-admin', 'wpcfAdmin', array(
            'max' => WPCF_MAX_BANNERS,
            'i18n' => array(
                'select' => 'Chọn ảnh / GIF',
                'change' => 'Đổi ảnh',
                'title' => 'Chọn banner (GIF/PNG/JPG)',
            ),
        ));
        wp_enqueue_style(
            'wpcf-admin',
            WPCF_PLUGIN_URL . 'assets/admin.css',
            array(),
            WPCF_VERSION
        );
    }

    public static function sanitize_link($url) {
        $url = trim((string) $url);
        if ($url === '') {
            return '';
        }
        // Keep {keyword} placeholders used in affiliate UTMs.
        $url = preg_replace('/[\r\n\t\0]/', '', $url);
        if (!preg_match('#^https?://#i', $url)) {
            $url = 'http://' . $url;
        }
        return $url;
    }

    public static function get_banners() {
        $raw = get_option(WPCF_OPTION, array());
        if (!is_array($raw)) {
            return array();
        }
        $out = array();
        foreach ($raw as $row) {
            if (!is_array($row)) {
                continue;
            }
            $image_id = isset($row['image_id']) ? (int) $row['image_id'] : 0;
            $url = isset($row['url']) ? self::sanitize_link(wp_unslash((string) $row['url'])) : '';
            if ($image_id <= 0) {
                continue;
            }
            $out[] = array(
                'image_id' => $image_id,
                'url' => $url,
            );
        }
        return array_slice($out, 0, WPCF_MAX_BANNERS);
    }

    public static function save() {
        if (!current_user_can('manage_options')) {
            wp_die('Forbidden');
        }
        check_admin_referer('wpcf_save');

        $ids = isset($_POST['image_id']) && is_array($_POST['image_id']) ? $_POST['image_id'] : array();
        $urls = isset($_POST['url']) && is_array($_POST['url']) ? $_POST['url'] : array();

        $banners = array();
        $count = max(count($ids), count($urls));
        for ($i = 0; $i < $count && count($banners) < WPCF_MAX_BANNERS; $i++) {
            $image_id = isset($ids[$i]) ? (int) $ids[$i] : 0;
            $url = isset($urls[$i]) ? self::sanitize_link(wp_unslash((string) $urls[$i])) : '';
            if ($image_id <= 0) {
                continue;
            }
            $banners[] = array(
                'image_id' => $image_id,
                'url' => $url,
            );
        }

        update_option(WPCF_OPTION, $banners, false);
        wp_safe_redirect(admin_url('options-general.php?page=wp-catfish&saved=1'));
        exit;
    }

    public static function render_page() {
        if (!current_user_can('manage_options')) {
            return;
        }
        $banners = self::get_banners();
        if (empty($banners)) {
            $banners = array(array('image_id' => 0, 'url' => ''));
        }
        ?>
        <div class="wrap wpcf-admin">
            <h1>Catfish Banner</h1>
            <p>Upload GIF/ảnh + gắn link affiliate. Desktop tối đa 2 ngang, mobile 1 cột. Sticky đáy trang.</p>
            <?php if (!empty($_GET['saved'])) : ?>
                <div class="notice notice-success is-dismissible"><p>Đã lưu.</p></div>
            <?php endif; ?>

            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                <input type="hidden" name="action" value="wpcf_save" />
                <?php wp_nonce_field('wpcf_save'); ?>

                <table class="widefat striped wpcf-table" id="wpcf-rows">
                    <thead>
                        <tr>
                            <th style="width:40%">Ảnh / GIF</th>
                            <th>URL (affiliate + UTM)</th>
                            <th style="width:80px"></th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($banners as $row) : ?>
                            <?php self::render_row($row); ?>
                        <?php endforeach; ?>
                    </tbody>
                </table>

                <p style="margin-top:12px;">
                    <button type="button" class="button" id="wpcf-add-row">+ Thêm banner</button>
                    <span class="description">Tối đa <?php echo (int) WPCF_MAX_BANNERS; ?> banner.</span>
                </p>

                <?php submit_button('Lưu catfish'); ?>
            </form>

            <template id="wpcf-row-template">
                <?php self::render_row(array('image_id' => 0, 'url' => '')); ?>
            </template>
        </div>
        <?php
    }

    private static function render_row(array $row) {
        $image_id = (int) ($row['image_id'] ?? 0);
        $url = (string) ($row['url'] ?? '');
        $thumb = '';
        if ($image_id > 0) {
            $src = wp_get_attachment_image_url($image_id, 'medium');
            if ($src) {
                $thumb = $src;
            }
        }
        ?>
        <tr class="wpcf-row">
            <td>
                <div class="wpcf-media">
                    <div class="wpcf-preview">
                        <?php if ($thumb) : ?>
                            <img src="<?php echo esc_url($thumb); ?>" alt="" />
                        <?php else : ?>
                            <span class="wpcf-placeholder">Chưa chọn ảnh</span>
                        <?php endif; ?>
                    </div>
                    <input type="hidden" name="image_id[]" class="wpcf-image-id" value="<?php echo esc_attr((string) $image_id); ?>" />
                    <button type="button" class="button wpcf-pick"><?php echo $thumb ? 'Đổi ảnh' : 'Chọn ảnh / GIF'; ?></button>
                    <button type="button" class="button-link-delete wpcf-clear" <?php echo $thumb ? '' : 'style="display:none"'; ?>>Xóa ảnh</button>
                </div>
            </td>
            <td>
                <input type="url" name="url[]" class="widefat" value="<?php echo esc_attr($url); ?>"
                    placeholder="http://vicclub.at/?a=...&utm_campaign=seo&utm_term={keyword}&..." />
            </td>
            <td>
                <button type="button" class="button-link-delete wpcf-remove-row">Xóa</button>
            </td>
        </tr>
        <?php
    }
}

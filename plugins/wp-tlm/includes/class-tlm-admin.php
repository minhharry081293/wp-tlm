<?php

if (!defined('ABSPATH')) {
    exit;
}

class TLM_Admin {
    public static function init() {
        add_action('admin_menu', array(__CLASS__, 'menu'));
    }

    public static function menu() {
        add_options_page(
            'TLM Textlinks',
            'TLM Textlinks',
            'manage_options',
            'tlm-textlinks',
            array(__CLASS__, 'render_page')
        );
    }

    public static function render_page() {
        if (!current_user_can('manage_options')) {
            return;
        }
        $count = TLM_DB::count_links();
        $endpoint = rest_url('tlm/v1/health');
        ?>
        <div class="wrap">
            <h1>TLM Textlink Manager</h1>
            <p>Plugin đã active. Thêm URL site này vào dashboard TLM — <strong>không cần API key</strong>.</p>
            <table class="form-table">
                <tr>
                    <th>Plugin version</th>
                    <td><?php echo esc_html(TLM_VERSION); ?></td>
                </tr>
                <tr>
                    <th>Links stored</th>
                    <td><?php echo esc_html((string) $count); ?></td>
                </tr>
                <tr>
                    <th>Health endpoint</th>
                    <td><code><?php echo esc_html($endpoint); ?></code></td>
                </tr>
            </table>
        </div>
        <?php
    }
}

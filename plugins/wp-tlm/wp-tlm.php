<?php
/**
 * Plugin Name: TLM Textlink Manager
 * Description: Manage homepage text links via REST API for central PBN dashboard.
 * Version: 1.1.0
 * Author: TLM
 * Text Domain: wp-tlm
 */

if (!defined('ABSPATH')) {
    exit;
}

define('TLM_VERSION', '1.1.0');
define('TLM_PLUGIN_FILE', __FILE__);
define('TLM_PLUGIN_DIR', plugin_dir_path(__FILE__));

require_once TLM_PLUGIN_DIR . 'includes/class-tlm-db.php';
require_once TLM_PLUGIN_DIR . 'includes/class-tlm-rest.php';
require_once TLM_PLUGIN_DIR . 'includes/class-tlm-render.php';
require_once TLM_PLUGIN_DIR . 'includes/class-tlm-admin.php';

register_activation_hook(__FILE__, array('TLM_DB', 'activate'));

function tlm_uninstall() {
    global $wpdb;
    $table = $wpdb->prefix . 'tlm_links';
    // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
    $wpdb->query("DROP TABLE IF EXISTS {$table}");
    delete_option('tlm_db_version');
    delete_option('tlm_api_key');
    delete_option('tlm_dashboard_url');
    delete_option('tlm_register_secret');
    delete_option('tlm_registered_at');
    delete_option('tlm_register_error');
}
register_uninstall_hook(__FILE__, 'tlm_uninstall');

add_action('plugins_loaded', function () {
    TLM_DB::maybe_upgrade();
    TLM_REST::init();
    TLM_Render::init();
    TLM_Admin::init();
});

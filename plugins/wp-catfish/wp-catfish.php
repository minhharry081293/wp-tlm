<?php
/**
 * Plugin Name: WP Catfish Banner
 * Description: Sticky bottom catfish banners — upload GIF/image and attach affiliate links. Desktop 2 columns, mobile 1 column.
 * Version: 1.0.0
 * Author: TLM
 * Text Domain: wp-catfish
 */

if (!defined('ABSPATH')) {
    exit;
}

define('WPCF_VERSION', '1.0.5');
define('WPCF_PLUGIN_FILE', __FILE__);
define('WPCF_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('WPCF_PLUGIN_URL', plugin_dir_url(__FILE__));
define('WPCF_OPTION', 'wpcf_banners');
define('WPCF_MAX_BANNERS', 8);

require_once WPCF_PLUGIN_DIR . 'includes/class-wpcf-admin.php';
require_once WPCF_PLUGIN_DIR . 'includes/class-wpcf-render.php';

add_action('plugins_loaded', function () {
    WPCF_Admin::init();
    WPCF_Render::init();
});

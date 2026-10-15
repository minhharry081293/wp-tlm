<?php

if (!defined('ABSPATH')) {
    exit;
}

class TLM_REST {
    const NS = 'tlm/v1';

    public static function init() {
        add_action('rest_api_init', array(__CLASS__, 'register_routes'));
    }

    public static function register_routes() {
        $public = array(
            'permission_callback' => '__return_true',
        );

        register_rest_route(self::NS, '/health', array_merge($public, array(
            'methods' => 'GET',
            'callback' => array(__CLASS__, 'health'),
        )));

        register_rest_route(self::NS, '/links', array(
            array_merge($public, array(
                'methods' => 'GET',
                'callback' => array(__CLASS__, 'list_links'),
            )),
            array_merge($public, array(
                'methods' => 'DELETE',
                'callback' => array(__CLASS__, 'delete_links'),
            )),
        ));

        register_rest_route(self::NS, '/links/batch', array_merge($public, array(
            'methods' => 'POST',
            'callback' => array(__CLASS__, 'batch_upsert'),
        )));
    }

    public static function health() {
        return rest_ensure_response(array(
            'ok' => true,
            'version' => TLM_VERSION,
            'link_count' => TLM_DB::count_links(),
            'site_url' => home_url('/'),
        ));
    }

    public static function list_links(WP_REST_Request $request) {
        $url = (string) $request->get_param('url');
        $q = (string) $request->get_param('q');
        $links = TLM_DB::list_links($url, $q);
        return rest_ensure_response(array(
            'links' => $links,
            'count' => count($links),
        ));
    }

    public static function batch_upsert(WP_REST_Request $request) {
        $items = $request->get_param('items');
        if (!is_array($items)) {
            $body = $request->get_json_params();
            $items = isset($body['items']) && is_array($body['items']) ? $body['items'] : null;
        }

        if (!is_array($items)) {
            return new WP_Error('tlm_invalid', 'items array required', array('status' => 400));
        }

        if (count($items) > 300) {
            return new WP_Error('tlm_too_many', 'Maximum 300 items per batch', array('status' => 400));
        }

        $result = TLM_DB::upsert_batch($items);
        return rest_ensure_response($result);
    }

    public static function delete_links(WP_REST_Request $request) {
        $body = $request->get_json_params();
        if (!is_array($body)) {
            $body = array();
        }

        $deleted = 0;
        if (!empty($body['ids']) && is_array($body['ids'])) {
            $deleted = TLM_DB::delete_by_ids($body['ids']);
        } elseif (!empty($body['target_url'])) {
            $deleted = TLM_DB::delete_by_target_url($body['target_url']);
        } else {
            return new WP_Error(
                'tlm_invalid',
                'Provide target_url or ids',
                array('status' => 400)
            );
        }

        return rest_ensure_response(array(
            'deleted' => $deleted,
            'total' => TLM_DB::count_links(),
        ));
    }
}

<?php

if (!defined('ABSPATH')) {
    exit;
}

class TLM_Render {
    public static function init() {
        add_action('template_redirect', array(__CLASS__, 'start_buffer'));
    }

    public static function start_buffer() {
        if (is_admin() || !is_front_page()) {
            return;
        }

        ob_start(array(__CLASS__, 'inject_into_main'));
    }

    public static function inject_into_main($html) {
        if (!is_string($html) || $html === '') {
            return $html;
        }

        $links = TLM_DB::list_links('', '', 5000);
        if (empty($links)) {
            return $html;
        }

        $block = self::markup($links);
        $updated = preg_replace_callback(
            '/<main\b[^>]*\bid=(["\'])main\1[^>]*>[\s\S]*?<\/main>/i',
            function ($matches) use ($block) {
                return preg_replace('/<\/main>\s*$/i', $block . '</main>', $matches[0], 1);
            },
            $html,
            1,
            $count
        );

        if (!is_string($updated) || $count < 1) {
            return $html;
        }

        return $updated;
    }

    private static function markup($links) {
        $parts = array();
        foreach ($links as $link) {
            $url = esc_url($link['target_url']);
            $text = esc_html($link['anchor_text']);
            $parts[] = '<a href="' . $url . '">' . $text . '</a>';
        }

        $html = "\n<!-- TLM Textlinks -->\n";
        $html .= '<div class="tlm-textlinks" style="padding:16px;text-align:center;">' . "\n";
        $html .= '<p style="margin:4px 0;">' . esc_html('Thương hiệu uy tín:') . ' ' . implode(', ', $parts) . "</p>\n";
        $html .= "</div>\n<!-- /TLM Textlinks -->\n";
        return $html;
    }
}

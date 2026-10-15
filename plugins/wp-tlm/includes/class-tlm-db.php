<?php

if (!defined('ABSPATH')) {
    exit;
}

class TLM_DB {
    const OPTION_DB_VERSION = 'tlm_db_version';
    const DB_VERSION = '1.1.0';

    public static function table_name() {
        global $wpdb;
        return $wpdb->prefix . 'tlm_links';
    }

    public static function activate() {
        self::create_table();
        update_option(self::OPTION_DB_VERSION, self::DB_VERSION);
    }

    public static function maybe_upgrade() {
        $current = get_option(self::OPTION_DB_VERSION);
        if ($current !== self::DB_VERSION) {
            self::create_table();
            update_option(self::OPTION_DB_VERSION, self::DB_VERSION);
        }
    }

    private static function create_table() {
        global $wpdb;
        $table = self::table_name();
        $charset = $wpdb->get_charset_collate();

        $sql = "CREATE TABLE {$table} (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            target_url text NOT NULL,
            anchor_text text NOT NULL,
            target_url_hash char(64) NOT NULL,
            anchor_hash char(64) NOT NULL,
            created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY  (id),
            UNIQUE KEY target_anchor (target_url_hash, anchor_hash),
            KEY target_url_hash (target_url_hash)
        ) {$charset};";

        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        dbDelta($sql);
    }

    public static function hash_value($value) {
        return hash('sha256', (string) $value);
    }

    public static function count_links() {
        global $wpdb;
        $table = self::table_name();
        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        return (int) $wpdb->get_var("SELECT COUNT(*) FROM {$table}");
    }

    public static function list_links($url = '', $q = '', $limit = 1000) {
        global $wpdb;
        $table = self::table_name();
        $limit = max(1, min(5000, (int) $limit));
        $where = array('1=1');
        $params = array();

        if ($url !== '') {
            $where[] = 'target_url_hash = %s';
            $params[] = self::hash_value($url);
        }

        if ($q !== '') {
            $where[] = '(target_url LIKE %s OR anchor_text LIKE %s)';
            $like = '%' . $wpdb->esc_like($q) . '%';
            $params[] = $like;
            $params[] = $like;
        }

        $sql = "SELECT id, target_url, anchor_text, created_at, updated_at FROM {$table} WHERE "
            . implode(' AND ', $where)
            . " ORDER BY id ASC LIMIT {$limit}";

        if (!empty($params)) {
            // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
            $sql = $wpdb->prepare($sql, $params);
        }

        // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
        $rows = $wpdb->get_results($sql, ARRAY_A);
        return is_array($rows) ? $rows : array();
    }

    public static function upsert_batch(array $items) {
        global $wpdb;
        $table = self::table_name();
        $inserted = 0;
        $updated = 0;
        $errors = array();

        foreach ($items as $index => $item) {
            $target_url = isset($item['target_url']) ? esc_url_raw(trim((string) $item['target_url'])) : '';
            $anchor_text = isset($item['anchor_text']) ? sanitize_text_field(trim((string) $item['anchor_text'])) : '';

            if ($target_url === '' || $anchor_text === '') {
                $errors[] = array(
                    'index' => $index,
                    'error' => 'target_url and anchor_text are required',
                );
                continue;
            }

            $url_hash = self::hash_value($target_url);
            $anchor_hash = self::hash_value($anchor_text);

            $existing_id = $wpdb->get_var(
                $wpdb->prepare(
                    // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                    "SELECT id FROM {$table} WHERE target_url_hash = %s AND anchor_hash = %s LIMIT 1",
                    $url_hash,
                    $anchor_hash
                )
            );

            if ($existing_id) {
                $ok = $wpdb->update(
                    $table,
                    array(
                        'target_url' => $target_url,
                        'anchor_text' => $anchor_text,
                    ),
                    array('id' => (int) $existing_id),
                    array('%s', '%s'),
                    array('%d')
                );
                if ($ok === false) {
                    $errors[] = array('index' => $index, 'error' => 'update failed');
                } else {
                    $updated++;
                }
            } else {
                $ok = $wpdb->insert(
                    $table,
                    array(
                        'target_url' => $target_url,
                        'anchor_text' => $anchor_text,
                        'target_url_hash' => $url_hash,
                        'anchor_hash' => $anchor_hash,
                    ),
                    array('%s', '%s', '%s', '%s')
                );
                if ($ok === false) {
                    $errors[] = array('index' => $index, 'error' => 'insert failed');
                } else {
                    $inserted++;
                }
            }
        }

        return array(
            'inserted' => $inserted,
            'updated' => $updated,
            'errors' => $errors,
            'total' => self::count_links(),
        );
    }

    public static function delete_by_target_url($target_url) {
        global $wpdb;
        $table = self::table_name();
        $hash = self::hash_value(esc_url_raw(trim((string) $target_url)));
        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $deleted = $wpdb->query(
            $wpdb->prepare("DELETE FROM {$table} WHERE target_url_hash = %s", $hash)
        );
        return (int) $deleted;
    }

    public static function delete_by_ids(array $ids) {
        global $wpdb;
        $table = self::table_name();
        $ids = array_values(array_filter(array_map('intval', $ids)));
        if (empty($ids)) {
            return 0;
        }
        $placeholders = implode(',', array_fill(0, count($ids), '%d'));
        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared,WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
        $sql = $wpdb->prepare("DELETE FROM {$table} WHERE id IN ({$placeholders})", $ids);
        // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
        $deleted = $wpdb->query($sql);
        return (int) $deleted;
    }
}

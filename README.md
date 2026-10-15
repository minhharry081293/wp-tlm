# PBN Textlink Management (TLM)

Quản lý textlink cuối trang Home WordPress PBN: cài plugin → Active → paste URL vào dashboard. **Không cần API key.**

## Chạy local (không Docker)

```bash
pnpm install
pnpm db:push
pnpm dev
```

Dashboard: http://localhost:3010

Job chạy trong process Next.js (không Redis). Worker poll SQLite là tùy chọn:

```bash
pnpm worker:dev
```

DB: file SQLite tại `data/tlm.db`.

## Quy trình dùng

1. Upload [`dist/wp-tlm.zip`](dist/wp-tlm.zip) lên PBN → **Activate**
2. Dashboard → Sites → paste list URL (mỗi dòng 1 URL)
3. Check all / Đặt CSV / Gỡ theo URL

## Kiến trúc

- `plugins/wp-tlm` — REST mở sau khi active, render link cuối Home
- `apps/web` — Next.js dashboard (port 3010)
- `apps/worker` — poll job pending từ SQLite (optional)
- `packages/db` — Prisma + SQLite
- `packages/jobs` — xử lý health / place / remove
- `packages/shared` — CSV + WP client

## Plugin Catfish (sticky bottom)

Zip: [`dist/wp-catfish.zip`](dist/wp-catfish.zip)

1. Cài + Active trên WP
2. Settings → **Catfish Banner** → upload GIF + paste link affiliate (giữ nguyên UTM/`{keyword}`)
3. Frontend: sticky đáy trang, desktop 2 cột, mobile 1 cột, nút **X [ĐÓNG]** (ẩn cả session)

## Plugin REST

| Method | Path | Mô tả |
|--------|------|--------|
| GET | `/wp-json/tlm/v1/health` | Ping + link count |
| GET | `/wp-json/tlm/v1/links?url=` | List |
| POST | `/wp-json/tlm/v1/links/batch` | Upsert ≤300 |
| DELETE | `/wp-json/tlm/v1/links` | Body `{ "target_url" }` |

Không auth. Chỉ dùng trên PBN private.

## CSV đặt link

Cột `anchor` = URL đích, cột `text` = chữ neo. Tối đa 50 PBN × 300 dòng.

```bash
pnpm plugin:zip   # đóng gói lại dist/wp-tlm.zip
```

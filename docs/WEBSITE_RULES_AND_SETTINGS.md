# Fulin Website Rules And Settings

Last verified: 2026-05-27 13:11 Asia/Taipei

## Live Site

- Public website: https://www.fulinfabric.com/
- Admin page: https://www.fulinfabric.com/admin.html
- Current live admin assets include the photo editor cache tag: `20260527-photo-editor`.
- Current public inventory API check: `368` inventory items.
- Current home featured fabrics: `6` items.

## GitHub And Deployment

- Local project folder: `C:\Users\user\Desktop\Fulin網頁\inventory-prototype`
- Main branch: `main`
- Latest checked commit: `0d52aa7 Add admin photo management controls`
- GitHub remote `origin`: `https://github.com/fulin8319-cmyk/FULING-.git`
- GitHub remote `fulinso`: `https://github.com/fulin8319-cmyk/fulinso.git`
- Railway has previously been observed using the `FULING-` service/repository path, so important production changes should be pushed to both remotes unless the Railway source is deliberately changed.
- Start command: `node server.js`
- Node app default port: `process.env.PORT` or `3000`.

## Railway Storage

Production backend data must use the Railway Volume.

- Expected data directory: `/app/data`
- Expected data source: `RAILWAY_VOLUME_MOUNT_PATH`
- Expected inventory file: `/app/data/inventory.json`
- Expected upload directory: `/app/data/uploads`
- The admin storage endpoint should show `volumeMounted: true` after login:
  - `https://www.fulinfabric.com/api/admin/storage`

If `volumeMounted` is false, or the data directory is not `/app/data`, do not deploy or restore data until the storage risk is resolved.

## Data Protection Rules

- Before backend, admin, deployment, or storage changes, check the current live storage state and current live inventory.
- Preserve or back up current production inventory and uploaded image references before risky work.
- Do not overwrite production `inventory.json` with local seed data, backup data, or an older file unless Ricky explicitly requests that exact restore.
- Do not replace uploaded images or admin-created image paths with old paths.
- Do not roll back to an older commit if it could erase newer backend edits or uploaded files.
- After deployment, verify that recent admin edits, featured fabrics, and uploaded images still appear on the live site.

## Backend Data Files

These are persistent in Railway Volume:

- `/app/data/inventory.json`
- `/app/data/analytics.json`
- `/app/data/social-posts.json`
- `/app/data/uploads/*`

Local seed or fallback files are only startup defaults. They must not be treated as the latest production data.

## Admin Editing Rules

- Admin inventory data is loaded from `/api/inventory`.
- Admin saves inventory through `PUT /api/admin/inventory`.
- Admin image uploads use `POST /api/admin/upload-image`.
- Uploaded fabric image URLs are returned as `/assets/uploads/<filename>`.
- Photos are stored in each item under `images`, with `featuredImage` and `image` used as the main image.
- Changing a photo, setting a main photo, deleting a photo from a fabric, or editing featured fabric content is not final until the matching save button is pressed.

Save buttons:

- Featured fabric edits: press `儲存主力布料變更`.
- Full inventory table edits: press `儲存全部變更`.
- Adding or updating a fabric in the add form still needs the full inventory save flow to persist.

## Current Featured Fabrics

Current live featured fabrics must be preserved on homepage and functional fabric page:

1. `A022439` - `單面PK布`
2. `A021844` - `細針鳥眼`
3. `A022877` - `75D 雙面布`
4. `A021542` - `大目鳥眼布`
5. `022169` - `PK健康布`
6. `A023811` - `NOP 單面涼感布`

## SEO And Public Pages

Current sitemap pages include:

- `/`
- `/inventory.html`
- `/printing.html`
- `/products.html`
- `/faq.html`
- `/blog/sustainable-fabric-trends-2026.html`

Google Search Console has been set up with `/sitemap.xml` successfully submitted.

## Coding Rules For Future Changes

- Make the smallest safe change that solves Ricky's request.
- Do not rewrite large files or refactor unrelated code.
- Do not edit `data/inventory.json` unless explicitly asked.
- Do not include secrets or admin passwords in documentation, commits, or chat.
- Before and after changing homepage featured fabrics, `functional-fabric.html`, product cards, or inventory rendering, run `npm test`. Do not deploy if the protected-content check fails.
- Use cache-busting query strings when changing admin CSS or JS so the live browser loads the newest files.
- Verify with `node --check admin.js` after admin JavaScript changes.
- Verify live deployment by checking the updated asset tag and then checking `/api/inventory`.

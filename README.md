# 福麟商行 Fulin

這是一個可部署到 Railway/Zeabur 的網站原型，包含：
- 公司首頁
- 現貨查詢頁
- 後台登入頁
- 後台庫存管理頁
- 獨立社群推播排程頁
- 簡單 Node 後端與 session 保護

## 啟動方式

在專案目錄執行：

```bash
node server.js
```

或：

```bash
npm start
```

預設會開在：

```text
http://localhost:3000
```

## 管理員帳密

專案不再內建預設帳密。請在部署平台設定環境變數：
- `ADMIN_USER`
- `ADMIN_PASS`

如果 Railway 目前已經使用 `ADMIN_PASSWORD`，後端也會相容讀取它；但建議之後統一改成 `ADMIN_PASS`。

## 目前結構

- `index.html`：公司首頁
- `inventory.html`：現貨查詢頁
- `login.html`：後台登入頁
- `admin.html`：後台管理頁
- `social-scheduler.html`：社群推播排程頁
- `server.js`：Node 後端
- `data/inventory.json`：庫存資料

## Zeabur 部署

這個版本已經不是單純靜態網站，部署時請用 Node 服務。

Zeabur 上建議設定：
- Start Command：`npm start`
- Environment Variables：
  - `ADMIN_USER`
  - `ADMIN_PASS`

## 社群 API 環境變數

Facebook 粉絲團：
- `FB_PAGE_ID`
- `FB_PAGE_ACCESS_TOKEN`
- `PUBLIC_BASE_URL`：你的公開網址，例如 `https://www.fulinfabric.com`。排程貼圖片/影片時平台需要讀得到檔案。

X：
- `X_API_KEY`
- `X_API_SECRET`
- `X_ACCESS_TOKEN`
- `X_ACCESS_SECRET`

TikTok：
- `TIKTOK_CLIENT_KEY`
- `TIKTOK_CLIENT_SECRET`
- `TIKTOK_ACCESS_TOKEN`
- `TIKTOK_OPEN_ID`

Instagram：
- `IG_USER_ID`
- `IG_ACCESS_TOKEN`

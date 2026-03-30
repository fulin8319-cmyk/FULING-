# 福麟商行 Fulin

這是一個可部署到 Zeabur 的第一版網站原型，包含：
- 公司首頁
- 現貨查詢頁
- 後台登入頁
- 後台庫存管理頁
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

## 預設管理員

- 帳號：`admin`
- 密碼：`fulin2026`

正式上線前請改成環境變數：
- `ADMIN_USER`
- `ADMIN_PASS`

## 目前結構

- `index.html`：公司首頁
- `inventory.html`：現貨查詢頁
- `login.html`：後台登入頁
- `admin.html`：後台管理頁
- `server.js`：Node 後端
- `data/inventory.json`：庫存資料

## Zeabur 部署

這個版本已經不是單純靜態網站，部署時請用 Node 服務。

Zeabur 上建議設定：
- Start Command：`npm start`
- Environment Variables：
  - `ADMIN_USER`
  - `ADMIN_PASS`

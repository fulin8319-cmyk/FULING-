# 福麟商行 n8n 串接說明

這個網站已經提供一個給 `n8n` 使用的安全 webhook：

- `POST /api/n8n/inventory`
- `GET /api/n8n/health`

正式網址範例：

- `https://fuling-production.up.railway.app/api/n8n/inventory`
- `https://fuling-production.up.railway.app/api/n8n/health`

## Railway 環境變數

請在 Railway `Variables` 新增：

- `N8N_API_KEY=你自己設定的一串密碼`

例如：

```text
N8N_API_KEY=fulin-n8n-2026-secret
```

## n8n HTTP Request 設定

Method:

```text
POST
```

URL:

```text
https://fuling-production.up.railway.app/api/n8n/inventory
```

Headers:

```text
Authorization: Bearer {{$env.N8N_API_KEY}}
Content-Type: application/json
```

也可以改用：

```text
x-api-key: {{$env.N8N_API_KEY}}
```

## 可送出的資料格式

單筆新增或更新：

```json
{
  "code": "A999001",
  "name": "萊卡布",
  "fabricType": "針織",
  "pattern": "黑色",
  "composition": "N+OP",
  "width": 60,
  "weightPerYard": 320,
  "kg": 12.5,
  "location": "A-12",
  "status": "confirmed",
  "image": "https://example.com/fabric.jpg",
  "note": "手機上傳測試"
}
```

多筆一次送：

```json
{
  "items": [
    {
      "code": "A999001",
      "name": "萊卡布",
      "width": 60,
      "weightPerYard": 320,
      "kg": 12.5,
      "location": "A-12"
    },
    {
      "code": "A999002",
      "name": "鳥眼布",
      "width": 62,
      "weightPerYard": 260,
      "kg": 18.2,
      "location": "B-03"
    }
  ]
}
```

## 自動換算規則

如果你只傳：

- `weightPerYard`
- `kg`

系統會自動算出：

- `yards = kg * 1000 / weightPerYard`

如果你只傳：

- `weightPerYard`
- `yards`

系統會自動反推：

- `kg = yards * weightPerYard / 1000`

## 適合的 n8n 流程

### 1. 手機表單上傳

- `Webhook`
- `Set`
- `HTTP Request -> /api/n8n/inventory`

### 2. LINE Bot 上傳

- `LINE Webhook`
- `IF` 檢查 userId 白名單
- `Code/Set` 整理欄位
- `HTTP Request -> /api/n8n/inventory`

### 3. Google Sheets 同步

- `Google Sheets Trigger`
- `Set`
- `HTTP Request -> /api/n8n/inventory`

## 驗證是否正常

可以先用：

```text
GET https://fuling-production.up.railway.app/api/n8n/health
```

如果成功，會回：

```json
{
  "ok": true,
  "n8nEnabled": true,
  "inventoryCount": 345
}
```

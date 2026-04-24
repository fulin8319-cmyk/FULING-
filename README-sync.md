# 福麟庫存同步（安全版）

這套流程會：
- 讀取官網庫存 API（預設 `https://www.fulinfabric.com/api/inventory`）
- 比對前次快照，找出新增/更新/下架
- 產生 `outbox.json` 給你確認貼文內容
- 只把「後台有勾選」的布料列入輪動發文
- 依 `posting_rules.json` 自動帶入布料特性、用途與 Hashtag

不會直接發文，預設是「先確認再發佈」。

## 1) 初始化

1. 複製設定檔：
   - `config.example.json` -> `config.json`
2. 依需求調整 `config.json` 的文案模板

## 2) 執行同步

```powershell
python .\sync_inventory.py
```

第一次執行通常會把現有資料視為基準或大量變動，之後才會穩定只出變化。

## 3) 查看結果

- 快照：`inventory_snapshot.json`
- 勾選白名單：`posting_selection.json`
- 布種規則庫：`posting_rules.json`
- 待發文清單：`outbox.json`

`outbox.json` 的 `items` 就是你要貼到 FB/IG 的候選內容。

## 規則模式（辨識布料特性）

系統會用 `posting_rules.json` 做規則比對：
- 先用 `name_contains` 比對布名關鍵字
- 再用 `any_contains` 比對任意欄位關鍵字
- 比對到後，套用該規則的 `traits / applications / hashtags`

目前已內建 v1：
- 單面PK布
- 細針鳥眼
- 75D雙面布

## 3.5) 後台勾選機制

先啟動後台：

```powershell
python .\inventory_admin_server.py
```

再開瀏覽器進入：

`http://127.0.0.1:8787`

在頁面勾選要輪動發文的布料後按「儲存勾選」。
之後 `sync_inventory.py` 只會把勾選項目輸出到 `outbox.json`。

## 4) 排程建議（Windows 工作排程器）

先用每小時跑一次：

```powershell
python .\sync_inventory.py
```

再接你現有的 browser-use 發文流程去讀 `outbox.json`，到「送出前」停住等你確認。

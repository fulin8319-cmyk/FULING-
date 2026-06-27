# Codex x Grok 協作文件

**版本**：v0.2  
**用途**：定義 Codex 與 Grok 在 Fulin AI 大腦中的分工、交接、Review 與發布前檢查流程  
**適用範圍**：`handoff/`、`specs/`、Repository 維護

---

## 1. 角色分工

### Codex 負責什麼

- Repository 維護
- 建立與更新檔案
- 更新 `VERSION`、`CHANGELOG.md`、`01_CURRENT_STATUS.md`、`TASK_QUEUE.md`、`02_NEXT_TASK.md`
- 依既有規格補齊文件與程式
- 修正明確的 repo 問題
- 保持變更最小，不重新設計架構
- 確保檔案命名、路徑與 handoff 格式一致

### Grok 負責什麼

- 內容生成
- 影片與短影音規格
- 腳本、金句、爆點、敘事節奏
- 依既有 handoff 與規格產出可執行內容
- 提供創意方向，但不直接改動 Repository 架構

---

## 2. 交接流程

1. 先讀 `handoff/AI_HANDOFF_PROMPT.md`
2. 再讀 `handoff/01_CURRENT_STATUS.md`
3. 接著讀 `handoff/02_NEXT_TASK.md`
4. 再看 `handoff/TASK_QUEUE.md`
5. 需要時補讀 `specs/adapters/`
6. 若要交給 Grok，先寫清楚：
   - 現況
   - 目標
   - 限制
   - 需要變更的檔案
   - 不可變更的檔案
7. Grok 回來的結果先做 Review，再決定是否合併

---

## 3. 檔案命名

- 一律使用既有 `handoff/` 命名習慣
- 新的交接或狀態文件，優先採用數字前綴
- 文件名稱要能直接看出用途
- 不要用同義詞亂改檔名
- 不要在同一用途上建立多份重複文件

建議格式：

- `01_CURRENT_STATUS.md`
- `02_NEXT_TASK.md`
- `TASK_QUEUE.md`
- `CODEX_GROK_COLLAB.md`

---

## 4. Review 流程

### Codex Review

- 檢查 Grok 交付內容是否符合需求
- 檢查是否有超出範圍的修改
- 檢查檔案路徑、命名、格式是否一致
- 檢查是否違反 handoff 規則

### Grok Review

- 針對內容品質、表達、節奏、腳本結構做回看
- 提供修改建議，但不主導 repo 架構決策

### 合併原則

- 先看是否符合需求，再看是否漂亮
- 能小修就不要重做
- 只接受能追溯到需求的變更

---

## 5. Release Manager

Release Manager 只做檢查，不修改內容。

### 檢查項目

- `git status`
- `CHANGELOG.md`
- `VERSION`
- `COMMIT_REVIEW.md`
- 是否可以發布

### 禁止事項

- 不修改檔案內容
- 不執行 `git add`
- 不執行 `git commit`
- 不執行 `git push`

---

## 6. 禁止事項

- 不要重新設計架構
- 不要未經需要就擴充功能
- 不要改動與任務無關的檔案
- 不要跳過 `handoff/` 既有流程
- 不要憑空補寫不存在的內容
- 不要把 Grok 的內容生成責任混成 Repository 維護責任
- 不要在未確認的情況下推進下一個 Sprint

---

## 7. 使用原則

- 先對齊需求，再動手
- 先保留現況，再做最小修改
- 先完成當前交接，再考慮下一步
- 任何變更都要能在 `TASK_QUEUE.md` 與 `01_CURRENT_STATUS.md` 找到對應


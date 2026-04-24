#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
簡易後台：
- 顯示庫存項目
- 勾選是否納入輪動發文
- 儲存到 posting_selection.json
"""

from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parent
CONFIG_PATH = ROOT / "config.json"


def read_json(path: Path, default):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except Exception:
        return default


def write_json(path: Path, data) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def pick_name(item_id: str, item: dict) -> str:
    for key in ("name", "title", "fabric_name", "product_name"):
        val = item.get(key)
        if val is not None and str(val).strip():
            return str(val).strip()
    return item_id


def load_config() -> dict:
    return read_json(CONFIG_PATH, {})


def load_snapshot_items() -> list:
    config = load_config()
    snapshot_path = ROOT / config.get("snapshot_file", "inventory_snapshot.json")
    snapshot = read_json(snapshot_path, {})
    rows = []
    for item_id, wrap in snapshot.items():
        if not isinstance(wrap, dict):
            continue
        item = wrap.get("item", {})
        if not isinstance(item, dict):
            item = {}
        rows.append(
            {
                "id": str(item_id),
                "name": pick_name(str(item_id), item),
                "stock": item.get("stock", item.get("qty", item.get("quantity", ""))),
                "width": item.get("width", item.get("幅寬", "")),
                "weight": item.get("weight", item.get("碼重", "")),
            }
        )
    rows.sort(key=lambda x: x["name"])
    return rows


def load_selection() -> dict:
    config = load_config()
    selection_path = ROOT / config.get("selection_file", "posting_selection.json")
    raw = read_json(selection_path, {})
    if not isinstance(raw, dict):
        return {}
    return {str(k): bool(v) for k, v in raw.items()}


def save_selection(data: dict) -> None:
    config = load_config()
    selection_path = ROOT / config.get("selection_file", "posting_selection.json")
    write_json(selection_path, data)


HTML = """<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>福麟發文白名單後台</title>
  <style>
    body { margin: 0; font-family: "Noto Sans TC", "Microsoft JhengHei", sans-serif; background: #0b1526; color: #ecf3ff; }
    .wrap { max-width: 1100px; margin: 24px auto; padding: 0 16px; }
    .head { display: flex; gap: 12px; align-items: center; justify-content: space-between; flex-wrap: wrap; }
    h1 { margin: 0; font-size: 24px; }
    .tools { display:flex; gap:8px; flex-wrap: wrap; }
    input, button { border-radius: 10px; border: 1px solid #2f4769; padding: 10px 12px; background: #13233b; color: #e9f2ff; }
    button { cursor: pointer; }
    .card { margin-top: 16px; background: rgba(255,255,255,.04); border: 1px solid #2d3f5d; border-radius: 14px; overflow: hidden; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 10px 12px; border-bottom: 1px solid #233651; text-align: left; font-size: 14px; }
    th { color: #9dc0e6; background: rgba(255,255,255,.03); position: sticky; top: 0; }
    tr:hover { background: rgba(120,160,220,.08); }
    .muted { color: #96abcd; font-size: 13px; margin-top: 8px; }
    .status { margin-left: 8px; font-size: 13px; color: #7fe3b5; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="head">
      <div>
        <h1>發文輪動白名單</h1>
        <div class="muted">有勾選的布料才會進入自動輪動發文。</div>
      </div>
      <div class="tools">
        <input id="kw" placeholder="搜尋布名或布號" />
        <button id="allOn">全選</button>
        <button id="allOff">全不選</button>
        <button id="save">儲存勾選</button>
        <span id="status" class="status"></span>
      </div>
    </div>
    <div class="card">
      <table>
        <thead>
          <tr>
            <th style="width:78px;">勾選</th>
            <th>布名</th>
            <th>布號</th>
            <th>庫存</th>
            <th>幅寬</th>
            <th>碼重</th>
          </tr>
        </thead>
        <tbody id="rows"></tbody>
      </table>
    </div>
  </div>
  <script>
    let items = [];
    let selection = {};

    const rows = document.getElementById('rows');
    const kw = document.getElementById('kw');
    const statusEl = document.getElementById('status');

    const render = () => {
      const q = kw.value.trim().toLowerCase();
      const html = items
        .filter(it => !q || it.name.toLowerCase().includes(q) || it.id.toLowerCase().includes(q))
        .map(it => `
          <tr>
            <td><input type="checkbox" data-id="${it.id}" ${selection[it.id] ? 'checked' : ''}></td>
            <td>${it.name || ''}</td>
            <td>${it.id || ''}</td>
            <td>${it.stock ?? ''}</td>
            <td>${it.width ?? ''}</td>
            <td>${it.weight ?? ''}</td>
          </tr>
        `).join('');
      rows.innerHTML = html || '<tr><td colspan="6">目前無資料，請先執行一次 sync_inventory.py</td></tr>';
      rows.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', () => { selection[cb.dataset.id] = cb.checked; });
      });
    };

    const load = async () => {
      const [itemsRes, selRes] = await Promise.all([
        fetch('/api/items'),
        fetch('/api/selection')
      ]);
      items = await itemsRes.json();
      selection = await selRes.json();
      for (const it of items) {
        if (!(it.id in selection)) selection[it.id] = false;
      }
      render();
    };

    kw.addEventListener('input', render);
    document.getElementById('allOn').addEventListener('click', () => {
      items.forEach(it => selection[it.id] = true);
      render();
    });
    document.getElementById('allOff').addEventListener('click', () => {
      items.forEach(it => selection[it.id] = false);
      render();
    });
    document.getElementById('save').addEventListener('click', async () => {
      const res = await fetch('/api/selection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selection),
      });
      if (res.ok) {
        statusEl.textContent = '已儲存';
        setTimeout(() => statusEl.textContent = '', 1500);
      } else {
        statusEl.textContent = '儲存失敗';
      }
    });

    load();
  </script>
</body>
</html>
"""


class Handler(BaseHTTPRequestHandler):
    def _json(self, code: int, data):
        payload = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def _text(self, code: int, text: str, content_type="text/html; charset=utf-8"):
        payload = text.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/":
            self._text(200, HTML)
            return
        if path == "/api/items":
            self._json(200, load_snapshot_items())
            return
        if path == "/api/selection":
            self._json(200, load_selection())
            return
        self._text(404, "Not Found", "text/plain; charset=utf-8")

    def do_POST(self):
        path = urlparse(self.path).path
        if path != "/api/selection":
            self._text(404, "Not Found", "text/plain; charset=utf-8")
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            body = self.rfile.read(length).decode("utf-8", errors="replace")
            data = json.loads(body)
            if not isinstance(data, dict):
                raise ValueError("selection payload must be object")
            cleaned = {str(k): bool(v) for k, v in data.items()}
            save_selection(cleaned)
            self._json(200, {"ok": True, "saved": len(cleaned)})
        except Exception as exc:
            self._json(400, {"ok": False, "error": str(exc)})


def main():
    host = "127.0.0.1"
    port = 8787
    server = ThreadingHTTPServer((host, port), Handler)
    print(f"[INFO] 管理後台啟動：http://{host}:{port}")
    print("[INFO] 停止請按 Ctrl+C")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()

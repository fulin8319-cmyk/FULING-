#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
讀取福麟官網庫存 API，偵測變動並產生待發文 outbox。
預設為安全模式：只產生內容，不直接發佈。
"""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Tuple
from urllib.error import URLError, HTTPError
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parent
DEFAULT_CONFIG = ROOT / "config.json"


def read_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except json.JSONDecodeError:
        return default


def write_json(path: Path, data: Any) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def first_nonempty(item: Dict[str, Any], keys: List[str], default: str = "") -> str:
    for key in keys:
        val = item.get(key)
        if val is not None and str(val).strip():
            return str(val).strip()
    return default


def fetch_inventory(api_url: str, timeout: int = 20) -> List[Dict[str, Any]]:
    req = Request(
        api_url,
        headers={
            "User-Agent": "FulinSyncBot/1.0",
            "Accept": "application/json",
        },
    )
    with urlopen(req, timeout=timeout) as resp:
        payload = resp.read().decode("utf-8", errors="replace")
        data = json.loads(payload)
    if isinstance(data, dict):
        for key in ("items", "data", "inventory", "result"):
            if isinstance(data.get(key), list):
                return data[key]
        return [data]
    if isinstance(data, list):
        return data
    return []


def pick_id(item: Dict[str, Any]) -> str:
    for key in ("id", "sku", "code", "fabric_code", "item_no", "name", "title"):
        val = item.get(key)
        if val is not None and str(val).strip():
            return str(val).strip()
    raw = json.dumps(item, ensure_ascii=False, sort_keys=True)
    return "hash:" + hashlib.sha1(raw.encode("utf-8")).hexdigest()[:16]


def stable_digest(item: Dict[str, Any]) -> str:
    raw = json.dumps(item, ensure_ascii=False, sort_keys=True)
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()


def index_items(items: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    idx: Dict[str, Dict[str, Any]] = {}
    for item in items:
        if not isinstance(item, dict):
            continue
        key = pick_id(item)
        idx[key] = item
    return idx


def to_name(item: Dict[str, Any], fallback: str) -> str:
    for key in ("name", "title", "fabric_name", "product_name"):
        val = item.get(key)
        if val is not None and str(val).strip():
            return str(val).strip()
    return fallback


def normalize_text(text: str) -> str:
    normalized = text.lower().strip()
    for token in (" ", "_", "-", "/", "\\", "\n", "\t"):
        normalized = normalized.replace(token, "")
    return normalized


def load_rules(path: Path) -> List[Dict[str, Any]]:
    raw = read_json(path, [])
    if isinstance(raw, list):
        return [r for r in raw if isinstance(r, dict)]
    return []


def rule_match(item_id: str, item: Dict[str, Any], rule: Dict[str, Any]) -> bool:
    match = rule.get("match", {})
    if not isinstance(match, dict):
        return False
    name = first_nonempty(item, ["name", "title", "fabric_name", "product_name"], "")
    bag = " ".join(
        [
            item_id,
            name,
            first_nonempty(item, ["type", "category", "fabric_type"], ""),
            first_nonempty(item, ["material", "composition"], ""),
            first_nonempty(item, ["desc", "description"], ""),
        ]
    )
    bag_n = normalize_text(bag)

    id_prefix = match.get("id_prefix", [])
    if isinstance(id_prefix, list):
        for prefix in id_prefix:
            if str(item_id).startswith(str(prefix)):
                return True

    name_contains = match.get("name_contains", [])
    if isinstance(name_contains, list):
        name_n = normalize_text(name)
        for kw in name_contains:
            if normalize_text(str(kw)) and normalize_text(str(kw)) in name_n:
                return True

    any_contains = match.get("any_contains", [])
    if isinstance(any_contains, list):
        for kw in any_contains:
            kw_n = normalize_text(str(kw))
            if kw_n and kw_n in bag_n:
                return True
    return False


def classify_item(item_id: str, item: Dict[str, Any], rules: List[Dict[str, Any]]) -> Dict[str, Any]:
    for rule in rules:
        if rule_match(item_id, item, rule):
            return {
                "rule_name": rule.get("rule_name", ""),
                "traits": rule.get("traits", []),
                "applications": rule.get("applications", []),
                "hashtags": rule.get("hashtags", []),
            }
    return {"rule_name": "", "traits": [], "applications": [], "hashtags": []}


def infer_printing_note(item: Dict[str, Any], classifier: Dict[str, Any]) -> str:
    composition = normalize_text(first_nonempty(item, ["composition", "成份", "material"], ""))
    color = normalize_text(first_nonempty(item, ["pattern", "color", "顏色"], ""))

    # 尼龍類一般不建議高溫熱昇華，避免誤導。
    if "n" in composition or "尼龍" in composition:
        return "印刷提醒：此布含尼龍成份，不建議高溫熱昇華，請改用適合尼龍的印刷工法。"

    # 深色布要先做可印性評估。
    dark_keywords = ["黑", "墨", "深", "navy", "dark"]
    if any(k in color for k in dark_keywords):
        return "印刷提醒：深色布建議先做打樣評估色彩表現。"

    tags = " ".join([str(x) for x in classifier.get("hashtags", [])]).lower()
    if "熱昇華" in tags or "sublimation" in tags:
        return "印刷提醒：可評估熱昇華印刷，建議先做打樣確認。"
    return "印刷提醒：可先提供用途與圖稿，我們協助建議對應印刷方式。"


def build_post(item_id: str, item: Dict[str, Any], event: str, template: str, rules: List[Dict[str, Any]]) -> Dict[str, Any]:
    name = to_name(item, item_id)
    stock = first_nonempty(item, ["stock", "qty", "quantity", "inventory"], "未提供")
    width = first_nonempty(item, ["width", "幅寬"], "未提供")
    weight = first_nonempty(item, ["weight", "碼重", "gram_weight", "gsm"], "未提供")
    classifier = classify_item(item_id, item, rules)
    traits = "、".join([str(t) for t in classifier.get("traits", [])]) or first_nonempty(item, ["features", "特性"], "待補充")
    applications = "、".join([str(t) for t in classifier.get("applications", [])]) or first_nonempty(item, ["usage", "用途", "application"], "待補充")
    hashtags = " ".join([str(t) for t in classifier.get("hashtags", [])]) or "#福麟商行 #機能布料 #庫存更新"
    image_url = first_nonempty(item, ["image", "featuredImage", "photo", "imageUrl"], "")
    printing_note = infer_printing_note(item, classifier)

    post_text = (
        template.replace("{event}", event)
        .replace("{name}", str(name))
        .replace("{stock}", str(stock))
        .replace("{width}", str(width))
        .replace("{weight}", str(weight))
        .replace("{traits}", str(traits))
        .replace("{applications}", str(applications))
        .replace("{hashtags}", str(hashtags))
        .replace("{printing_note}", str(printing_note))
        .replace("{image_url}", str(image_url))
        .replace("{id}", str(item_id))
    )
    return {
        "id": item_id,
        "name": name,
        "event": event,
        "post_text": post_text,
        "classifier": classifier,
        "image_url": image_url,
        "printing_note": printing_note,
        "source_item": item,
    }


def load_selection(path: Path) -> Dict[str, bool]:
    raw = read_json(path, {})
    if not isinstance(raw, dict):
        return {}
    result: Dict[str, bool] = {}
    for k, v in raw.items():
        result[str(k)] = bool(v)
    return result


def merge_selection_with_items(selection: Dict[str, bool], new_idx: Dict[str, Dict[str, Any]]) -> Dict[str, bool]:
    merged = dict(selection)
    for item_id in new_idx.keys():
        if item_id not in merged:
            merged[item_id] = False
    return merged


def diff_inventory(
    old_idx: Dict[str, Dict[str, Any]],
    new_idx: Dict[str, Dict[str, Any]],
    template: str,
    rules: List[Dict[str, Any]],
) -> Tuple[List[Dict[str, Any]], Dict[str, Dict[str, Any]]]:
    outbox: List[Dict[str, Any]] = []
    digest_map: Dict[str, Dict[str, Any]] = {}

    for item_id, item in new_idx.items():
        digest_map[item_id] = {"digest": stable_digest(item), "item": item}
        if item_id not in old_idx:
            outbox.append(build_post(item_id, item, "新品上架", template, rules))
            continue
        if stable_digest(old_idx[item_id]) != stable_digest(item):
            outbox.append(build_post(item_id, item, "庫存更新", template, rules))

    for item_id, old_item in old_idx.items():
        if item_id not in new_idx:
            outbox.append(build_post(item_id, old_item, "下架或售完", template, rules))

    return outbox, digest_map


def main() -> int:
    parser = argparse.ArgumentParser(description="Sync Fulin inventory and generate social outbox.")
    parser.add_argument("--config", default=str(DEFAULT_CONFIG), help="config.json path")
    parser.add_argument("--dry-run", action="store_true", help="do not write files")
    args = parser.parse_args()

    config_path = Path(args.config)
    config = read_json(config_path, {})
    if not config:
        print(f"[ERROR] 找不到設定檔：{config_path}")
        print("請先複製 config.example.json 為 config.json 再執行。")
        return 1

    api_url = config.get("inventory_api")
    if not api_url:
        print("[ERROR] config.json 缺少 inventory_api")
        return 1

    snapshot_path = ROOT / config.get("snapshot_file", "inventory_snapshot.json")
    outbox_path = ROOT / config.get("outbox_file", "outbox.json")
    selection_path = ROOT / config.get("selection_file", "posting_selection.json")
    rule_path = ROOT / config.get("rule_file", "posting_rules.json")
    template = config.get(
        "post_template",
        "【{event}】{name}\n布號：{id}\n庫存：{stock}\n幅寬：{width}\n碼重：{weight}\n特性：{traits}\n用途：{applications}\n{hashtags}",
    )

    try:
        items = fetch_inventory(api_url)
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
        print(f"[ERROR] 讀取 API 失敗：{exc}")
        return 1

    new_idx = index_items(items)
    old_snapshot = read_json(snapshot_path, {})
    old_idx = {k: v.get("item", {}) for k, v in old_snapshot.items() if isinstance(v, dict)}
    selection = load_selection(selection_path)
    merged_selection = merge_selection_with_items(selection, new_idx)
    selected_ids = {item_id for item_id, enabled in merged_selection.items() if enabled}
    rules = load_rules(rule_path)

    outbox, new_snapshot = diff_inventory(old_idx, new_idx, template, rules)
    filtered_outbox = [item for item in outbox if item["id"] in selected_ids]
    now = datetime.now().isoformat(timespec="seconds")
    payload = {
        "generated_at": now,
        "count": len(filtered_outbox),
        "raw_change_count": len(outbox),
        "selected_count": len(selected_ids),
        "publish_mode": config.get("publish_mode", "confirm_before_publish"),
        "items": filtered_outbox,
    }

    print(f"[INFO] 抓到 {len(items)} 筆庫存資料")
    print(f"[INFO] 偵測到 {len(outbox)} 筆變動")
    print(f"[INFO] 白名單勾選 {len(selected_ids)} 筆")
    print(f"[INFO] 輪動可發文 {len(filtered_outbox)} 筆")

    if not args.dry_run:
        write_json(snapshot_path, new_snapshot)
        write_json(selection_path, merged_selection)
        write_json(outbox_path, payload)
        print(f"[INFO] 已更新 snapshot: {snapshot_path}")
        print(f"[INFO] 已更新 selection: {selection_path}")
        print(f"[INFO] 已產生 outbox: {outbox_path}")
    else:
        print("[INFO] dry-run 模式：未寫入檔案")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

"""Check every quote in data/curated/applications.json against the NASA source it claims to come from.

A link is only kept if its quote appears word for word in the PSI record field it names, or in the
challenge resource text it names. This keeps hand-written links honest. Also writes the links as
knowledge-base passages so the Ask page can answer "which research helps smoke detectors?".

Usage:  python src/applications.py
"""
import os
import re
import sys
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import config


def norm(s):
    s = (s or "").replace("�", "'").replace("’", "'").replace("–", "-").replace("—", "-")
    return re.sub(r"\s+", " ", s).strip()


def load_checked():
    apps = json.load(open(os.path.join(config.CURATED, "applications.json"), encoding="utf-8"))
    res_index = {r["id"]: r for r in json.load(open(os.path.join(config.RAW, "resources", "index.json"), encoding="utf-8"))}
    errors = []

    def check(item, where):
        if "resource" in item:
            r = res_index[item["resource"]]
            text = open(os.path.join(config.RAW, "resources", r["id"] + ".txt"), encoding="utf-8").read()
            item.update({"source_title": r["title"], "url": r.get("page", r["url"]), "acc": None})
        else:
            d = json.load(open(os.path.join(config.RAW, "investigations", item["acc"] + ".json"), encoding="utf-8"))
            text = d[item["field"]]
            item.update({"source_title": f"PSI {item['acc']}", "url": d["psi_url"]})
        for q in item.get("quotes", [item.get("quote")]):
            if norm(q) not in norm(text):
                errors.append(f"{where}: quote not found in {item.get('acc') or item.get('resource')}: {q[:60]}...")

    check(apps["key_insight"], "key_insight")
    for c in apps["categories"]:
        for i, l in enumerate(c["links"]):
            check(l, f"{c['id']}.links[{i}]")
        for i, e in enumerate(c["earth"]):
            check(e, f"{c['id']}.earth[{i}]")
    for i, l in enumerate(apps["lessons"]):
        check(l, f"lessons[{i}]")
    if errors:
        raise SystemExit("Quotes not found in NASA sources:\n  " + "\n  ".join(errors))
    return apps


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    apps = load_checked()
    n = sum(len(c["links"]) + len(c["earth"]) for c in apps["categories"]) + len(apps["lessons"]) + len(apps["key_insight"]["quotes"])
    json.dump(apps, open(os.path.join(config.PROCESSED, "applications.json"), "w", encoding="utf-8"), ensure_ascii=False)
    print(f"OK: {n} quotes checked word for word against NASA sources ({len(apps['categories'])} equipment categories).")

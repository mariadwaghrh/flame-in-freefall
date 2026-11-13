"""Step 2b: search index + relevance of each investigation to each crew environment.

1) bge-m3 embeddings for every passage -> data/processed/embeddings.npy
   (re-uses vectors of passages whose text did not change, since embedding is slow on a CPU)
2) a transparent 100-point relevance score per investigation and environment, saved into catalog.json:
     40  directness   direct / related / indirect fire-safety relevance (challenge statement + PSI category)
     30  semantic     similarity between the investigation's text and the environment's needs
     20  conditions   do its tests cover the environment's oxygen window? does it have flow data?
     10  data         amount of test data and publications

Usage:  python src/index.py
"""
import os
import sys
import json
import math
import time
import hashlib
import numpy as np
import requests

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import config

TIER = {"direct": 1.0, "related": 0.6, "indirect": 0.25}


def embed(texts, batch=16):
    out = []
    for b in range(0, len(texts), batch):
        r = requests.post(f"{config.OLLAMA}/api/embed", json={"model": config.EMBED_MODEL, "input": texts[b:b + batch], "keep_alive": "30m"}, timeout=900)
        r.raise_for_status()
        out += r.json()["embeddings"]
    E = np.asarray(out, dtype=np.float32)
    return E / (np.linalg.norm(E, axis=1, keepdims=True) + 1e-9)


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    P = config.PROCESSED
    chunks = json.load(open(os.path.join(P, "chunks.json"), encoding="utf-8"))
    catalog = json.load(open(os.path.join(P, "catalog.json"), encoding="utf-8"))
    scenarios = json.load(open(os.path.join(config.CURATED, "scenarios.json"), encoding="utf-8"))["scenarios"]

    keys = [hashlib.sha1((config.EMBED_MODEL + "\n" + c["text"]).encode("utf-8")).hexdigest() for c in chunks]
    kp, ep = os.path.join(P, "embeddings_keys.json"), os.path.join(P, "embeddings.npy")
    old = {}
    if os.path.exists(kp) and os.path.exists(ep):
        oe = np.load(ep)
        old = {k: oe[i] for i, k in enumerate(json.load(open(kp)))}
    todo = [i for i, k in enumerate(keys) if k not in old]
    print(f"[1] {len(chunks)} passages: {len(chunks) - len(todo)} reused, {len(todo)} to embed with {config.EMBED_MODEL}", flush=True)
    t0, new = time.time(), {}
    for b in range(0, len(todo), 32):
        part = todo[b:b + 32]
        for i, v in zip(part, embed([chunks[i]["text"] for i in part])):
            new[keys[i]] = v
        print(f"    {min(b + 32, len(todo))}/{len(todo)}  ({time.time() - t0:.0f}s)", flush=True)
    E = np.vstack([old.get(k, new.get(k)) for k in keys]).astype(np.float32)
    np.save(ep, E)
    json.dump(keys, open(kp, "w"))

    print("[2] relevance scores")
    S = embed([s["need"] for s in scenarios])
    rows = {}
    for i, c in enumerate(chunks):
        if c["acc"] and c["source"] == "psi":
            rows.setdefault(c["acc"], []).append(i)
    max_data = max(math.log1p(i["n_tests"]) + math.log1p(len(i["publications"])) for i in catalog)
    for si, sc in enumerate(scenarios):
        raw = {i["acc"]: float(np.sort(E[rows[i["acc"]]] @ S[si])[::-1][:3].mean()) for i in catalog}  # best 3 passages
        lo, hi = min(raw.values()), max(raw.values())
        a, b = sc["o2"]
        for inv in catalog:
            vals = inv["o2_values"]
            inside = sum(1 for v in vals if a <= v <= b)
            o2 = (0.6 + 0.4 * min(1.0, inside / 20)) if inside else (0.2 if vals else 0.0)
            cond = 0.75 * o2 + 0.25 * (1.0 if inv["flow_range"] else 0.0)
            parts = {"directness": round(40 * TIER[inv["tier"]], 1),
                     "semantic": round(30 * (raw[inv["acc"]] - lo) / (hi - lo + 1e-9), 1),
                     "conditions": round(20 * cond, 1),
                     "data": round(10 * (math.log1p(inv["n_tests"]) + math.log1p(len(inv["publications"]))) / max_data, 1)}
            inv.setdefault("scores", {})[sc["id"]] = {"total": round(sum(parts.values()), 1), "parts": parts, "o2_inside": inside}
        top = sorted(catalog, key=lambda v: -v["scores"][sc["id"]]["total"])[:5]
        print(f"    {sc['en']['name']:20} " + ", ".join(f"{v['short']} {v['scores'][sc['id']]['total']:.0f}" for v in top))
    json.dump(catalog, open(os.path.join(P, "catalog.json"), "w", encoding="utf-8"), ensure_ascii=False)


if __name__ == "__main__":
    main()

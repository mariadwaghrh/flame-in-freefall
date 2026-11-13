"""Run the team's test questions through the Ask pipeline and grade the verified answers.

A question counts as correct when:
  - expect 'answer':  the pipeline does not decline, and the final (checked) answer contains every 'must_have' group
  - expect 'abstain': the pipeline declines
Also checks that each team quote is still word for word in its source text.

Usage (from the project folder, Ollama running):  python src/evaluate.py
Writes data/processed/eval_results.json, shown on the Ask page.
"""
import os
import re
import sys
import json
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import config
from rag import RAG


def norm(s):
    return re.sub(r"\s+", " ", (s or "").replace("’", "'")).strip()


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    qs = json.load(open(os.path.join(config.CURATED, "eval_questions.json"), encoding="utf-8"))["questions"]
    for q in qs:
        if q.get("quote"):
            src = open(os.path.join(config.RAW, "resources", q["resource"] + ".txt"), encoding="utf-8").read()
            if norm(q["quote"]) not in norm(src):
                raise SystemExit(f"{q['id']}: quote not found in {q['resource']}")
    rag, results = RAG(), []
    for q in qs:
        t0, final = time.perf_counter(), {}
        for attempt in range(3):                      # the pipeline gives no result if the local model is busy: wait and retry
            for ev in rag.ask(q["q"], lang="en"):
                if ev["stage"] == "final":
                    final = ev
            if final:
                break
            time.sleep(10)
        text = final.get("final", "")
        declined = final.get("decision") == "abstained"
        if q["expect"] == "abstain":
            ok, why = declined, "declined" if declined else "answered instead of declining"
        else:
            missing = [g for g in q["must_have"] if not any(t.lower() in text.lower() for t in g)]
            ok = not declined and not missing
            why = "declined" if declined else ("missing: " + "; ".join("/".join(g) for g in missing) if missing else "correct")
        results.append({"id": q["id"], "q": q["q"], "expected": q["answer"], "expect": q["expect"], "decision": final.get("decision"),
                        "final": text, "ok": ok, "why": why, "seconds": round(time.perf_counter() - t0, 1), "by": q.get("by")})
        print(f"{'PASS' if ok else 'FAIL'}  {q['id']:6} {final.get('decision', '?'):10} {why:28} {text[:90]}")
    n_ok = sum(r["ok"] for r in results)
    out = {"model": config.LLM_MODEL, "date": time.strftime("%Y-%m-%d"), "passed": n_ok, "total": len(results), "results": results}
    json.dump(out, open(os.path.join(config.PROCESSED, "eval_results.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"\n{n_ok} / {len(results)} passed")


if __name__ == "__main__":
    main()

"""Run a fixed set of questions once and save the real, checked results (including the ones the system declines).

The home page shows one of these runs as a worked example of the guardrail (nothing on that page is mocked up),
and judges can see a result without waiting for the local model.

Usage (from the project folder, Ollama running):  python src/examples.py
Writes data/processed/examples.json.
"""
import os
import sys
import json
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import config
from rag import RAG

QUESTIONS = [
    "Which investigations tested 30% oxygen or more, and with which fuels?",
    "Does shutting off ventilation put out a fire in high oxygen?",
    "What solid materials were burned in BASS-II and over what oxygen range?",
    "How was smoke measured in SAME and SAME-R?",
    "What did NASA learn from the Apollo 1 fire?",
    "Why are flames spherical in microgravity?",
    "What is the best recipe for chocolate cake?",          # outside the knowledge base: must be declined
]


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    rag, out = RAG(), []
    for q in QUESTIONS:
        final, evidence = {}, []
        for ev in rag.ask(q, lang="en"):
            if ev["stage"] == "evidence":
                evidence = [{"cite": c["cite"], "section": c["section"], "similarity": c["similarity"]} for c in ev["evidence"]]
            elif ev["stage"] == "final":
                final = ev
        out.append({"q": q, "decision": final.get("decision"), "why": final.get("why"), "draft": final.get("draft", ""), "final": final.get("final", ""),
                    "claims": [{"text": c["text"], "verdict": c["verdict"], "score": c["score"], "why": c["why"], "cite": c["evidence"]["cite"]} for c in final.get("claims", [])],
                    "stats": final.get("stats", {}), "evidence": evidence})
        print(f"{final.get('decision', '?'):10} removed={final.get('removed', 0)}  {q}", flush=True)
    json.dump({"model": config.LLM_MODEL, "date": time.strftime("%Y-%m-%d"), "examples": out},
              open(os.path.join(config.PROCESSED, "examples.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()

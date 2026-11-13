"""Pipeline: question -> (translate) -> retrieve -> draft -> guardrail -> (translate), streamed as progress events.

Usage:  python -m rag.pipeline "Which investigations tested 30% oxygen or more?"   (run from the src/ folder)
"""
import os
import sys
import json
import time
import hashlib
import threading

from .settings import config, OFF_TOPIC, ABSTAIN_EN, ABSTAIN_AR, ARABIC
from .embedder import Embedder
from .retrieval import Retriever
from . import generate, guardrail, translate


class RAG:
    def __init__(self):
        self.embed = Embedder()
        self.ret = Retriever(self.embed)
        self.catalog = {i["acc"]: i for i in self.ret.catalog}
        self.lock = threading.Lock()          # one CPU: one model call at a time
        self.cache_path = os.path.join(config.PROCESSED, "llm_cache.json")
        self.cache = json.load(open(self.cache_path, encoding="utf-8")) if os.path.exists(self.cache_path) else {}

    # ---- helpers ----
    def _save(self, key, value):
        self.cache[key] = value
        json.dump(self.cache, open(self.cache_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    def _vecs(self, chunks):
        return self.ret.E[[c["row"] for c in chunks]]

    @staticmethod
    def public(chunks):
        return [{k: c[k] for k in ("acc", "source", "section", "title", "url", "cite", "text", "similarity")} for c in chunks]

    def arabic(self, text):
        """Cached sentence-by-sentence Arabic translation of a checked English text."""
        key = "ar:" + hashlib.sha1(text.encode("utf-8")).hexdigest()
        if key not in self.cache:
            with self.lock:
                ar, ok = translate.answer_to_arabic(text)
            self._save(key, {"text": ar, "ok": ok, "source": text})
        return self.cache[key]["text"], self.cache[key]["ok"]

    # ---- the Ask page ----
    def ask(self, question, lang="en", only=None):
        t0, ok = time.perf_counter(), generate.llm_available()
        q = question
        if ARABIC.search(question) and ok:                                   # 1. translate an Arabic question
            with self.lock:
                q = translate.question_to_english(question)
            yield {"stage": "translated", "question_en": q}
        chunks = self.ret.search(q, only=only)                               # 2. retrieve
        yield {"stage": "evidence", "evidence": self.public(chunks), "seconds": round(time.perf_counter() - t0, 1)}
        if not chunks or max(c["similarity"] for c in chunks) < OFF_TOPIC:   # outside the knowledge base: decline now
            yield {"stage": "final", "decision": "abstained", "final": ABSTAIN_EN, "final_ar": ABSTAIN_AR, "claims": [], "why": "off_topic"}
            return
        if not ok:
            yield {"stage": "error", "message": "The local model is not running (start Ollama)."}
            return
        stats = {}
        with self.lock:                                                      # 3. draft
            for x in generate.draft(q, chunks):
                if isinstance(x, dict):
                    stats = x
                else:
                    yield {"stage": "token", "t": x}
        yield {"stage": "verifying"}
        tg = time.perf_counter()
        res = guardrail.check(stats.get("answer", ""), chunks, self.embed, self._vecs(chunks))   # 4. check
        stats.update({"guardrail_seconds": round(time.perf_counter() - tg, 1), "total_seconds": round(time.perf_counter() - t0, 1)})
        res["final_ar"] = ABSTAIN_AR if res["decision"] == "abstained" else None
        yield {"stage": "final", "draft": stats.pop("answer", ""), "stats": stats, **res}
        if lang == "ar" and res["decision"] != "abstained":                  # 5. translate the checked answer
            yield {"stage": "translating"}
            ar, ok_tr = self.arabic(res["final"])
            yield {"stage": "translated_answer", "final_ar": ar, "translation_ok": ok_tr}

    # ---- verified summary of one investigation ----
    def summary(self, acc, lang="en"):
        key = f"summary:{acc}:{config.LLM_MODEL}"
        if key not in self.cache:
            chunks = self.ret.passages_of(acc)
            with self.lock:
                st = generate.summary(self.catalog[acc]["short"], chunks)
            res = guardrail.check(st.get("answer", ""), chunks, self.embed, self._vecs(chunks))
            self._save(key, {"acc": acc, **res, "evidence": self.public(chunks)})
        out = dict(self.cache[key])
        if lang == "ar" and out["decision"] != "abstained":
            out["final_ar"], out["translation_ok"] = self.arabic(out["final"])
        return out


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    rag = RAG()
    q = " ".join(sys.argv[1:]) or "Which investigations tested 30% oxygen or more, and with which fuels?"
    for ev in rag.ask(q, lang="ar" if ARABIC.search(q) else "en"):
        if ev["stage"] == "token":
            continue
        if ev["stage"] == "evidence":
            print("EVIDENCE:", [f"{c['cite']} / {c['section']} ({c['similarity']})" for c in ev["evidence"]])
        elif ev["stage"] == "final":
            print("DRAFT:", ev.get("draft"))
            print("DECISION:", ev["decision"], "|", ev.get("why", ""), "|", ev.get("stats"))
            for c in ev["claims"]:
                print(f"   [{c['verdict']:11}] {c['score']:.2f} {c['text'][:110]}  <- {c['evidence']['cite']} ({c['why']})")
            print("FINAL:", ev["final"])
        else:
            print(ev)

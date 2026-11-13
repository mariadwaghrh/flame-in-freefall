"""Retrieval: find the passages that best answer a question.

score = HYBRID_ALPHA * cosine(question, passage)  +  (1 - HYBRID_ALPHA) * BM25(question, passage)

  - cosine (bge-m3) understands meaning, e.g. "putting out fires" finds FLEX
  - BM25 catches exact names the embedding can blur: "BASS-II", "PMMA", "SIBAL", "CFI-G"
  - if the question names an investigation, its passages get a small boost
  - at most 3 passages per source, so one long document cannot fill every slot
"""
import os
import re
import json
import math
import collections
import numpy as np

from .settings import config, TOP_K, HYBRID_ALPHA

STOP = set("a an the of in on at to for and or is are was were be been with by as from that this these those it its what which who how why "
           "when where does do did can could would should than then into over under about between during not no any all some more most".split())


def tokens(text):
    return [t for t in re.findall(r"[a-z0-9]+(?:-[a-z0-9]+)*", text.lower()) if t not in STOP and len(t) > 1]


class Retriever:
    def __init__(self, embed):
        P = config.PROCESSED
        self.chunks = json.load(open(os.path.join(P, "chunks.json"), encoding="utf-8"))
        self.E = np.load(os.path.join(P, "embeddings.npy"))          # built by src/index.py
        if len(self.chunks) != len(self.E):
            raise RuntimeError("chunks.json and embeddings.npy are out of sync: run python src/index.py")
        self.catalog = json.load(open(os.path.join(P, "catalog.json"), encoding="utf-8"))
        self.embed = embed
        # BM25 statistics
        self.docs = [collections.Counter(tokens(c["text"] + " " + c["title"])) for c in self.chunks]
        self.lens = np.array([sum(d.values()) for d in self.docs], dtype=np.float32)
        df = collections.Counter(t for d in self.docs for t in d)
        self.idf = {t: math.log(1 + (len(self.docs) - f + 0.5) / (f + 0.5)) for t, f in df.items()}
        # investigation names as they may appear in a question; short all-caps names must match exactly
        # (so "BASS" does not also match "BASS-II")
        self.names = []
        for inv in self.catalog:
            if inv["kind"] == "ground":
                continue
            for n in {inv["short"], inv["short"].replace("ACME ", ""), inv["acronym"] or ""}:
                if len(n) >= 3 and n != "ACME":
                    flags = 0 if re.fullmatch(r"[A-Z0-9\-/ ]+", n) else re.I
                    pat = re.compile(r"(?<![\w-])" + re.escape(n).replace(r"\-", r"[- ]?") + r"(?![\w]|-(?:II|I|2|R|G|\d))", flags)
                    self.names.append((pat, inv["acc"]))

    def bm25(self, q, k1=1.5, b=0.75):
        s, avg = np.zeros(len(self.docs), dtype=np.float32), float(self.lens.mean())
        for t in set(tokens(q)):
            idf = self.idf.get(t)
            if idf:
                for i, d in enumerate(self.docs):
                    f = d.get(t, 0)
                    if f:
                        s[i] += idf * f * (k1 + 1) / (f + k1 * (1 - b + b * self.lens[i] / avg))
        return s / s.max() if s.max() > 0 else s

    def named(self, q):
        out = []
        for pat, acc in self.names:
            if pat.search(q) and acc not in out:
                out.append(acc)
        return out

    def search(self, q, k=TOP_K, only=None):
        dense = self.E @ self.embed([q])[0]
        score = HYBRID_ALPHA * dense + (1 - HYBRID_ALPHA) * self.bm25(q)
        named = self.named(q)
        for i, c in enumerate(self.chunks):
            if only and c["acc"] not in only:
                score[i] = -1
            elif named and c["acc"] in named:
                score[i] += 0.08
        cap = 99 if (only and len(only) <= 2) or len(named) == 1 else 3
        picked, per = [], collections.Counter()
        for i in np.argsort(-score):
            if score[i] < 0 or len(picked) >= k:
                break
            key = self.chunks[i]["acc"] or self.chunks[i]["title"]
            if per[key] < cap:
                per[key] += 1
                picked.append({**self.chunks[i], "row": int(i), "similarity": round(float(dense[i]), 3)})
        return picked

    def passages_of(self, acc, sections=("Overview", "Objectives", "Approach", "Experimental table", "Research impacts")):
        """The main passages of one investigation, in a fixed order (used for summaries)."""
        out = []
        for s in sections:
            for i, c in enumerate(self.chunks):
                if c["acc"] == acc and c["source"] in ("psi", "psi_table") and c["section"].startswith(s) and "/" not in c["section"]:
                    out.append({**c, "row": i, "similarity": None})
                    break
        return out

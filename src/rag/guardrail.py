"""Guardrail: check every sentence (claim) of a draft against the retrieved NASA passages.

For each claim:
  1. any number in it (oxygen %, speed, pressure, count) must appear in the passages -> otherwise REMOVED
     (similarity alone cannot tell "21% O2" from "34% O2", the most dangerous error in modelling data)
  2. best similarity to a passage sentence >= TAU_SUPPORT -> SUPPORTED
     below TAU_WEAK -> REMOVED;  in between -> WEAK (kept, labelled)
Decision for the whole answer:
  - every claim kept               -> "accepted"
  - some claims removed            -> "partial" (the removed ones stay visible, struck through)
  - under MIN_RATIO supported, or the model itself said the evidence is insufficient -> "abstained"
"""
import re
import numpy as np

from .settings import TAU_SUPPORT, TAU_WEAK, MIN_RATIO, ABSTAIN_EN

INSUFFICIENT = re.compile(r"insufficient|not enough information|do(es)? not (contain|provide|mention)|no (information|evidence)|cannot (answer|determine)", re.I)
LEADIN = re.compile(r"^(according to [^,]*,\s*|based on [^,]*,\s*|however,\s*|additionally,\s*|furthermore,\s*|also,\s*|overall,\s*)", re.I)


def sentences(text):
    text = re.sub(r"\s+", " ", text or "").strip()
    text = re.sub(r"(?:e\.g|i\.e|et al|vs|Fig|approx|ca)\.", lambda m: m.group(0).replace(".", "․"), text)
    return [p.replace("․", ".").strip() for p in re.split(r"(?<=[.!?؟])\s+(?=[\"'(A-Z0-9؀-ۿ])", text) if p.strip()]


def numbers(text, claim=False):
    """Numbers in a text. In claims, numbers that are part of a name (PSI-25, FLEX-2, C2H4) and small counts without a unit are skipped."""
    if claim:
        text = re.sub(r"PSI-\d+|\b[A-Za-z]+-\d+\b|\b[A-Za-z]+\d+[A-Za-z0-9]*\b", " ", text)
    out = []
    for m in re.finditer(r"(?<![\w.])\d+(?:\.\d+)?", text or ""):
        v, unit = float(m.group(0)), text[m.end():m.end() + 6]
        if claim and v < 10 and "." not in m.group(0) and not re.match(r"\s*(%|percent|cm|mm|atm|psi|bar|kpa)", unit, re.I):
            continue
        out.append(v)
    return out


def number_in(v, pool):
    """0.21 in a table and 21% in a sentence are the same value."""
    return any(abs(c - e) <= 1e-6 + 0.005 * abs(e) for c in (v, v / 100, v * 100) for e in pool)


def split_claims(answer):
    claims = []
    for line in re.split(r"\n+", re.sub(r"\*\*|`", "", answer or "")):
        line = re.sub(r"^\s*(?:[-*•]|\d+[.)])\s+", "", line).strip()
        if line and not line.endswith(":"):             # a list title is not a claim
            for s in sentences(line):
                clean = LEADIN.sub("", s).strip()
                if len(re.findall(r"\w+", clean)) >= 4:
                    claims.append({"text": s, "clean": clean[:1].upper() + clean[1:]})
    return claims


def check(answer, chunks, embed, chunk_vecs):
    claims = split_claims(answer)
    if not claims:
        return {"decision": "abstained", "claims": [], "final": ABSTAIN_EN, "why": "no_claims"}
    pool = {v for c in chunks for v in numbers(c["text"])}
    C = embed([c["clean"] for c in claims])
    # compare each claim with the sentences of its 2 closest passages, plus every whole passage
    near = sorted({int(i) for i in np.argsort(-(C @ chunk_vecs.T), axis=1)[:, :2].ravel()})
    units, owner = [], []
    for ci in near:
        for s in sentences(chunks[ci]["text"]):
            if len(s.split()) >= 4:
                units.append(s)
                owner.append(ci)
    U = np.vstack([embed(units), chunk_vecs]) if units else chunk_vecs
    units += [" ".join(c["text"].split()[:60]) + " …" for c in chunks]
    owner += list(range(len(chunks)))
    sims = C @ U.T

    sup = weak = 0
    for k, cl in enumerate(claims):
        j = int(np.argmax(sims[k]))
        sc = float(sims[k, j])
        missing = [v for v in numbers(cl["clean"], claim=True) if not number_in(v, pool)]
        if INSUFFICIENT.search(cl["clean"]):
            verdict, why = "meta", "states_insufficient"
        elif missing:
            verdict, why = "unsupported", "number_missing:" + ",".join(f"{v:g}" for v in missing[:3])
        elif sc >= TAU_SUPPORT:
            verdict, why = "supported", "match"
        elif sc < TAU_WEAK:
            verdict, why = "unsupported", "no_match"
        else:
            verdict, why = "weak", "loose_match"
        sup += verdict == "supported"
        weak += verdict == "weak"
        src = chunks[owner[j]]
        cl.update({"verdict": verdict, "score": round(sc, 3), "why": why,
                   "evidence": {"cite": src["cite"], "section": src["section"], "url": src["url"], "sentence": units[j][:400]}})

    real = [c for c in claims if c["verdict"] != "meta"]
    ratio = (sup + 0.5 * weak) / len(real) if real else 0.0
    if not real or (sup == 0 and len(real) < len(claims)) or ratio < MIN_RATIO:
        return {"decision": "abstained", "claims": claims, "final": ABSTAIN_EN, "ratio": round(ratio, 2),
                "why": "model_insufficient" if sup == 0 and len(real) < len(claims) else "low_support"}
    kept = [c for c in claims if c["verdict"] in ("supported", "weak")]
    return {"decision": "accepted" if len(kept) == len(real) else "partial", "claims": claims, "ratio": round(ratio, 2),
            "final": " ".join(c["text"] for c in kept), "removed": len(real) - len(kept)}

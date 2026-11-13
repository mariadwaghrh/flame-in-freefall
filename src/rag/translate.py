"""Translation for the Arabic page.

The knowledge base and the guardrail work in English. So:
  - an Arabic question is translated to English before the search
  - the CHECKED English answer is translated to Arabic one sentence at a time (the small local model
    translates short sentences much better than whole paragraphs), with a glossary of fire-safety terms
  - every translated sentence is checked: it must keep every number and must not add a Latin name that is
    not in the English. If it fails three times, the checked English sentence is kept instead of a wrong translation.
"""
import re

from .generate import llm
from .guardrail import sentences

PROMPT = ("You translate NASA fire-safety text from English into clear Modern Standard Arabic. Keep experiment names "
          "(BASS-II, FLEX, Saffire, ACME, SAME), material names (PMMA, SIBAL, Nomex), chemical formulas and every number exactly "
          "as written, in Latin letters and Western digits. Output only the Arabic translation.")
GLOSSARY = {"oxygen concentration": "تركيز الأكسجين", "oxygen": "الأكسجين", "carbon dioxide": "ثاني أكسيد الكربون", "helium": "الهيليوم",
            "nitrogen": "النيتروجين", "flame spread": "انتشار اللهب", "extinction": "انطفاء اللهب", "flammability": "قابلية الاشتعال",
            "ignition": "الاشتعال", "microgravity": "الجاذبية الصغرى", "partial gravity": "الجاذبية الجزئية", "air flow": "تدفق الهواء",
            "forced flow": "تدفق قسري", "fabric": "قماش", "droplet": "قطيرة", "fuel": "وقود", "methanol": "الميثانول", "heptane": "الهبتان",
            "soot": "السخام", "smoke": "الدخان", "smoke detector": "كاشف الدخان", "cool flame": "اللهب البارد", "suppression": "إخماد الحرائق",
            "pressure": "الضغط", "atm": "ضغط جوي (atm)", "spacecraft": "المركبة الفضائية", "investigation": "تجربة", "sample": "عينة",
            "material": "مادة", "ventilation": "التهوية", "fire safety": "السلامة من الحرائق", "crew": "الطاقم"}
# characters outside Arabic, Latin, digits and punctuation: noise the small model sometimes emits (Thai, Devanagari...)
FOREIGN = re.compile(r"[^؀-ۿﭐ-﷿ﹰ-﻿ -~ -ÿ\s‐-‧≤≥°]")


def question_to_english(question):
    return llm([{"role": "system", "content": "Translate the user's question into English. Keep names and numbers. Output only the translation."},
                {"role": "user", "content": question}], 120).get("answer", question) or question


def missing_numbers(en, ar):
    ar = (ar or "").translate(str.maketrans("٠١٢٣٤٥٦٧٨٩٫", "0123456789."))
    have = set(re.findall(r"\d+(?:\.\d+)?", ar))
    return sorted(n for n in set(re.findall(r"(?<![A-Za-z\d.\-])\d+(?:\.\d+)?", en or "")) if n not in have)


def translation_ok(en, ar):
    if missing_numbers(en, ar):
        return False
    # names in capitals (SIBAL, PMMA, BASS-II, ISS) must be kept as written
    if any(n not in ar for n in re.findall(r"\b[A-Z][A-Za-z0-9]*[A-Z0-9](?:-[A-Za-z0-9]+)*\b", en)):
        return False
    # every Latin word in the Arabic must be a whole word of the English ("سIBال" from "SIBAL" fails)
    src = {w.lower() for w in re.findall(r"[A-Za-z][A-Za-z0-9\-]*", en)}
    return all(w.lower() in src for w in re.findall(r"[A-Za-z][A-Za-z0-9\-]*", ar))


def sentence_to_arabic(en):
    """-> (text, passed_check)"""
    terms = [f"{k} = {v}" for k, v in GLOSSARY.items() if k in en.lower()]
    system = PROMPT + ("\nGlossary:\n" + "\n".join(terms) if terms else "")
    # first try is deterministic; at temperature 0 the seed changes nothing, so retries add a little randomness
    for seed, temp in ((42, 0), (7, 0.5), (11, 0.5)):
        ar = FOREIGN.sub("", llm([{"role": "system", "content": system}, {"role": "user", "content": en}], 220, seed, temp).get("answer", "")).strip()
        if ar and translation_ok(en, ar):
            return ar, True
    return en, False


def answer_to_arabic(text):
    parts, ok_all = [], True
    for s in sentences(text):
        ar, ok = sentence_to_arabic(s)
        parts.append(ar)
        ok_all &= ok
    return " ".join(parts), ok_all

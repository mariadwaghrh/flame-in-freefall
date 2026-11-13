"""Generation: a local Llama 3.2 (3B) in Ollama drafts the answer from the retrieved passages only.

temperature 0 and a fixed seed: the same question gives the same draft.
The draft is never shown as final: guardrail.py checks it first.
"""
import json
import time
import requests

from .settings import config

SYSTEM = ("You are a spacecraft fire-safety research assistant. Answer using ONLY the NASA evidence passages provided "
          "(PSI investigation records, PSI experimental tables, NASA reports). Name investigations, fuels, oxygen levels, "
          "flow speeds and pressures, copying numbers exactly as written. If the passages do not contain the answer, say the "
          "evidence is insufficient. Do not add outside knowledge. Write at most five short sentences of at most 20 words each, "
          "no headings, no lists, in English.")
SUMMARY = ("Using ONLY the NASA PSI passages about one investigation, write exactly four short sentences: what it studied and why; "
           "the fuels or samples and test conditions (copy numbers exactly); what was measured; why it matters for fire safety in "
           "crewed spacecraft or habitats. No outside knowledge, no headings, no lists.")


def context(chunks, words=150):
    """Passages as the model sees them. Not numbered: numbering made models write "According to Passage 2"."""
    return "\n\n".join(f"[Source: {c['cite']} | {c['section']}]\n{' '.join(c['text'].split()[:words])}" for c in chunks)


def llm_stream(messages, max_tokens=260, seed=42, temperature=0):
    """Yields text tokens as they are written, then one dict with the full answer and timing."""
    payload = {"model": config.LLM_MODEL, "stream": True, "keep_alive": "30m", "messages": messages,
               "options": {"temperature": temperature, "seed": seed, "num_predict": max_tokens, "num_ctx": 4096}}
    t0, text = time.perf_counter(), ""
    with requests.post(f"{config.OLLAMA}/api/chat", json=payload, stream=True, timeout=900) as r:
        r.raise_for_status()
        for line in r.iter_lines():
            if not line:
                continue
            j = json.loads(line)
            tok = j.get("message", {}).get("content", "")
            if tok:
                text += tok
                yield tok
            if j.get("done"):
                w = (j.get("eval_duration") or 0) / 1e9
                yield {"answer": text.strip(), "prompt_tokens": j.get("prompt_eval_count") or 0, "answer_tokens": j.get("eval_count") or 0,
                       "tok_per_sec": round((j.get("eval_count") or 0) / w, 1) if w else 0, "seconds": round(time.perf_counter() - t0, 1)}


def llm(messages, max_tokens=260, seed=42, temperature=0):
    out = {}
    for x in llm_stream(messages, max_tokens, seed, temperature):
        if isinstance(x, dict):
            out = x
    return out


def draft(question, chunks):
    """Stream the answer draft for a question."""
    yield from llm_stream([{"role": "system", "content": SYSTEM},
                           {"role": "user", "content": f"Evidence passages:\n{context(chunks)}\n\nQuestion: {question}\n\nAnswer:"}])


def summary(short_name, chunks):
    return llm([{"role": "system", "content": SUMMARY},
                {"role": "user", "content": f"Passages:\n{context(chunks)}\n\nSummarise the {short_name} investigation."}], 260)


def llm_available():
    try:
        tags = requests.get(f"{config.OLLAMA}/api/tags", timeout=2).json().get("models", [])
        return any(m["name"].split(":")[0] == config.LLM_MODEL.split(":")[0] for m in tags)
    except Exception:
        return False

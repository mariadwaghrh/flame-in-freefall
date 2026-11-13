"""Embedder: text -> vector with bge-m3 (multilingual) running locally in Ollama.

Vectors are normalised, so a dot product is the cosine similarity.
The knowledge base itself is embedded once by src/index.py; this embeds questions and answer sentences.
"""
import numpy as np
import requests

from .settings import config


class Embedder:
    def __init__(self, model=config.EMBED_MODEL, url=config.OLLAMA):
        self.model, self.url, self.cache = model, url, {}

    def __call__(self, texts):
        """list of strings -> array (n, 1024)"""
        todo = [t for t in dict.fromkeys(texts) if t not in self.cache]
        for b in range(0, len(todo), 16):
            r = requests.post(f"{self.url}/api/embed", json={"model": self.model, "input": todo[b:b + 16], "keep_alive": "30m"}, timeout=600)
            r.raise_for_status()
            for t, v in zip(todo[b:b + 16], r.json()["embeddings"]):
                v = np.asarray(v, dtype=np.float32)
                self.cache[t] = v / (np.linalg.norm(v) + 1e-9)
        out = np.vstack([self.cache[t] for t in texts])
        if len(self.cache) > 5000:          # session cache only; keep it from growing forever
            self.cache = {t: self.cache[t] for t in texts}
        return out

"""TrustFlame RAG: answers from NASA sources only, with every sentence checked before it is shown.

    question
      -> translate.py   (Arabic question -> English, because the knowledge base is English)
      -> retrieval.py   hybrid search: meaning (embedder.py, bge-m3) + exact words (BM25) + investigation names
      -> generate.py    local Llama 3.2 drafts an answer from the retrieved passages only
      -> guardrail.py   every sentence and every number checked against the passages; unsupported ones removed
      -> translate.py   (Arabic page: checked answer translated sentence by sentence, numbers re-checked)
    pipeline.py ties the steps together and streams progress to the web page.
"""
from .generate import llm_available
from .pipeline import RAG

__all__ = ["RAG", "llm_available"]

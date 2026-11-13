"""All tunable numbers and fixed texts of the RAG in one place."""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config  # noqa: E402  (paths and model names shared with the rest of the project)

# retrieval
TOP_K = 5                 # passages given to the model
HYBRID_ALPHA = 0.7        # weight of meaning (embeddings) vs exact words (BM25)
OFF_TOPIC = 0.40          # best passage less similar than this: the question is outside the knowledge base

# guardrail
TAU_SUPPORT = 0.62        # similarity at or above this: the sentence is supported
TAU_WEAK = 0.56           # below this: the sentence is removed; in between: kept and labelled "weak"
MIN_RATIO = 0.5           # fewer supported sentences than this share: decline instead of answering

ABSTAIN_EN = "The retrieved NASA evidence is not enough to answer this reliably. Try rephrasing, or open the cited investigations in PSI."
ABSTAIN_AR = "الأدلة المسترجعة من ناسا غير كافية لإجابة موثوقة عن هذا السؤال. جرّب صياغة أخرى، أو افتح التجارب المذكورة في PSI."
ARABIC = re.compile(r"[؀-ۿ]")

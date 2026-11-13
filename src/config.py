"""Shared settings: paths, data sources, local models, retrieval and answer-check thresholds."""
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA = os.path.join(ROOT, "data")
RAW = os.path.join(DATA, "raw")            # files exactly as downloaded from NASA
CURATED = os.path.join(DATA, "curated")    # small hand-written layer (labels, Arabic text, scenarios)
PROCESSED = os.path.join(DATA, "processed")  # built by our scripts from raw + curated
WEB = os.path.join(ROOT, "web")

PSI = "https://psi.nasa.gov"
USER_AGENT = "trustflame-space-apps-2026/1.0 (hackathon prototype)"

# Local models through Ollama: the app runs offline once the data is downloaded
OLLAMA = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")
EMBED_MODEL = os.environ.get("EMBED_MODEL", "bge-m3")       # multilingual, so Arabic questions work
LLM_MODEL = os.environ.get("LLM_MODEL", "llama3.2:3b")

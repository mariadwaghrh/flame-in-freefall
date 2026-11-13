# TrustFlame: fire-safety insights from NASA microgravity combustion data

NASA Space Apps Challenge 2026, challenge **Flame in Freefall** (Amman & Aqaba local event, 13–14 November 2026).

Built during the hackathon. Every step is a git commit, so the history shows how the project grew.

## What it does
A bilingual (Arabic / English) dashboard that summarises, ranks and interprets the 24 combustion investigations in NASA's Physical Sciences Informatics (PSI) database for fire safety in crewed habitats, with an assistant that answers only from NASA sources and checks every sentence before showing it.

## Run it
```
pip install -r requirements.txt
python src/fetch_psi.py
```
More steps are added as the project grows.

## Data
- NASA PSI Data Repository, Combustion Science (CC0): https://psi.nasa.gov/physci/repo/search?q=combustion

## Use of SI (AI) tools
See [AI_USE.md](AI_USE.md).

## License
Apache-2.0, see [LICENSE](LICENSE).

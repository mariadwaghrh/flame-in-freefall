# TrustFlame: fire-safety insights from NASA microgravity combustion data

NASA Space Apps Challenge 2026, challenge **Flame in Freefall** (Amman & Aqaba local event, 13–14 November 2026).

Built during the hackathon. Every step is a git commit, so the history shows how the project grew.

## What it does
A bilingual (Arabic / English) dashboard that summarises, ranks and interprets the 24 combustion investigations in NASA's Physical Sciences Informatics (PSI) database for fire safety in crewed habitats, with an assistant that answers only from NASA sources and checks every sentence before showing it.

| Page | What it shows |
|---|---|
| Story (home) | the case told by scrolling: a real ISS flame video, Apollo 1 and Mir in NASA's own words, the Moon atmosphere, the data gap, how the guardrail works, a saved real run, and the system's limits |
| Overview | key findings, oxygen range of every investigation, top-ranked investigations, real flame images and videos |
| Investigations | the 24 investigations ranked 0–100 for a chosen crew environment (station, spacecraft, Moon base, rover, Mars base), with filters and details |
| Moon readiness | how many NASA tests reached a chosen oxygen level and pressure, which materials were tested, what happened to the flame, oxygen share vs oxygen amount |
| Research to equipment | which investigations inform smoke detectors, suppression, ventilation, material selection and fire models; every link quotes NASA word for word |
| Test data | every PSI test table, plotted, with normalised columns and CSV export for modelling |
| Ask | questions in Arabic or English, answered by a local model from NASA passages only; every sentence and number is checked, unsupported ones are removed |

The main finding: no solid material (fabric, plastic) in the PSI tables was tested above about 22% oxygen or at reduced pressure, while a Moon base is expected at 30% oxygen or more and 10.2 psi or less.

How it works: [ARCHITECTURE.md](ARCHITECTURE.md).

## Run it
Needs Python 3.10+ and [Ollama](https://ollama.com) with two local models:
```
ollama pull bge-m3
ollama pull llama3.2:3b
pip install -r requirements.txt
```
Build the data (once, needs internet; afterwards everything runs offline):
```
python src/fetch_psi.py          # PSI investigations and test tables
python src/fetch_resources.py    # every resource on the challenge's Resources tab, as text
python src/fetch_media.py        # 11 real flame images and videos (43 MB)
python src/applications.py       # checks every research-to-equipment quote against its NASA source
python src/build.py              # catalog, Moon readiness, knowledge passages
python src/index.py              # embeddings and relevance scores
```
Start the site:
```
python app.py --port 8000
```
Open http://127.0.0.1:8000 (add `?lang=en` for English).

Test the Ask page on the team's questions (writes `data/processed/eval_results.json`):
```
python src/evaluate.py
```
Save real example runs for the home page (writes `data/processed/examples.json`):
```
python src/examples.py
```

## Data and sources
All data is NASA's; nothing is generated.
- NASA PSI Data Repository, Combustion Science (CC0): https://psi.nasa.gov/physci/repo/search?q=combustion
- NASA Combustion Science, Glenn Research Center: https://www.nasa.gov/glenn/glenn-expertise-space-exploration/physical-sciences-program/combustion-science/
- A Researcher's Guide to: International Space Station Combustion Science (NASA, 2015): https://www.nasa.gov/missions/station/a-researchers-guide-to-combustion-science/
- Apollo 1 lessons learned (NASA SMA): https://sma.nasa.gov/sma-disciplines/accllp/apollo-1
- Apollo 13 lessons learned (NASA SMA): https://sma.nasa.gov/sma-disciplines/accllp/apollo-13
- 25 Years Ago: Fire Aboard Space Station Mir (NASA History): https://www.nasa.gov/history/25-years-ago-fire-aboard-space-station-mir/
- NASA Spinoff: Fireman's Air Tanks https://spinoff.nasa.gov/node/9582 · Fire Detector https://spinoff.nasa.gov/node/9407 · New Technology for the Fire Attire https://spinoff.nasa.gov/node/9918
- NASA ScienceCasts: The Power of Studying Combustion on the ISS (2018): https://www.youtube.com/watch?v=W1oXykoz9zg
- Challenge statement: https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/

Known errors inside NASA files (spreadsheet auto-fill, lost subscripts, samples named only by shape) are corrected on read and shown as data notes on the site.

## Limitations
- An answer takes 1 to 2 minutes on a laptop CPU.
- The answer check uses meaning similarity plus a check of every number, not a trained entailment model; thresholds were set by hand.
- Arabic answers are machine translations by a small local model; sentences that fail the number and name check stay in English.
- PSI has no partial-gravity (Moon or Mars gravity) data yet, and records flame outcomes in only a few tables.
- No PSI table pairs air speed with flame-spread rate, so the site does not draw that relation.

## Use of SI (AI) tools
See [AI_USE.md](AI_USE.md).

## License
Apache-2.0, see [LICENSE](LICENSE).

"""Step 2: turn the raw NASA files into what the website and the assistant use.

Outputs (data/processed/):
  catalog.json    one record per investigation: metadata + test conditions + labels
  materials.json  "Moon readiness" per fuel / material: highest O2 and lowest pressure actually tested
  tables.json     every experimental table with its normalised columns (for the data explorer)
  chunks.json     text passages for the Ask page, each with its source and link

Usage:  python src/build.py
"""
import os
import re
import sys
import json
import glob
import collections

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import config
from tables import load_table

CHUNK_WORDS, OVERLAP = 170, 35
MOON_O2, MOON_ATM = 30.0, 0.694          # challenge: >=30% O2 at <=10.2 psi (= 0.694 atm)

MEASUREMENTS = [
    (r"video|camera|imag(e|ing)", "Video / still imaging"), (r"radiomet", "Radiometry (flame radiation)"),
    (r"pyromet", "Thin-filament pyrometry"), (r"thermocouple", "Thermocouples"),
    (r"\bplif\b|laser.induced fluorescence", "PLIF laser diagnostics"), (r"chemiluminescen", "Chemiluminescence"),
    (r"soot volume|soot (formation|inception)|smoke.point", "Soot / smoke-point measurements"),
    (r"o2 %|co2 %|co \(ppm\)|gas (analy|sampl)", "Gas composition (O2 / CO2 / CO)"),
    (r"p-trak|dusttrak|particle count|aerosol (instrument|device)|smoke detector", "Aerosol particle instruments"),
    (r"electron microscop|thermal precipitator", "TEM particle sampling"), (r"ion current|chemi-?ion", "Ion current"),
    (r"burning rate|burn rate", "Burning rate"), (r"spread rate|flame spread", "Flame spread rate"),
    (r"extinction|extinguish|flammability limit", "Extinction / flammability limits"), (r"heat flux", "Heat flux"),
    (r"mass loss|weight loss", "Mass loss rate"), (r"lift-?off", "Flame lift-off / stability"),
]


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def one_line(s):
    return re.sub(r"\s+", " ", s or "").strip()


def split_words(text, size=CHUNK_WORDS, overlap=OVERLAP):
    """Word chunks with overlap, ending at a sentence boundary when one is close."""
    words = one_line(text).split(" ")
    if not words or not words[0]:
        return []
    if len(words) <= size + overlap:
        return [" ".join(words)]
    out, i = [], 0
    while i < len(words):
        j = min(i + size, len(words))
        k = j
        while k < min(j + 30, len(words)) and not re.search(r"[.!?]$", words[k - 1]):
            k += 1
        if k < len(words) and re.search(r"[.!?]$", words[k - 1]):
            j = k
        out.append(" ".join(words[i:j]))
        if j >= len(words):
            break
        i = j - overlap
    return out


def fmt_range(r, unit="", d=1):
    if not r:
        return None
    a, b = round(r[0], d), round(r[1], d)
    return f"{a:g}{unit}" if a == b else f"{a:g}-{b:g}{unit}"


def year(s):
    m = re.search(r"(19|20)\d{2}", s or "")
    return int(m.group(0)) if m else None


def table_passages(short, acc, t):
    """Plain-language description of a table, so the assistant can quote test conditions with numbers."""
    head = f"{short} ({acc}) experimental table '{t['label']}'"
    parts = [f"{head} lists {t['n_rows']} rows with the columns: {' | '.join(t['headers'][:22])}."]
    if t["fuels"]:
        parts.append("Fuels or sample materials (rows): " + ", ".join(f"{f} ({n})" for f, n in t["fuels"][:12]) + ".")
    for key, label, unit, d in (("o2_range", "Oxygen concentration", "%", 1), ("flow_range", "Flow velocity", " cm/s", 1),
                                ("pressure_range", "Pressure", " atm", 2)):
        if t[key]:
            parts.append(f"{label} spans {fmt_range(t[key], unit, d)}.")
    parts += ["Data note: " + n for n in t["notes"]]
    out = [(f"Experimental table: {t['label']}", " ".join(parts))]

    # outcomes: what happened to the flame, counted per fuel
    if t["outcome_columns"]:
        for label in dict.fromkeys(t["outcome_columns"]):
            by_fuel = collections.defaultdict(collections.Counter)
            for n in t["norm"]:
                v = (n.get("outcome") or {}).get(label)
                if v:
                    by_fuel[n.get("fuel") or "unnamed sample"][v] += 1
            if by_fuel:
                desc = "; ".join(f"{fuel}: " + ", ".join(f"{k} ({c})" for k, c in cnt.most_common(6)) for fuel, cnt in by_fuel.items())
                out.append((f"Outcomes: {t['label']} / {label}", f"In the {head}, the recorded outcome '{label}' was: {desc}."))
    # per-fuel conditions
    by_fuel = collections.defaultdict(list)
    for n in t["norm"]:
        if n.get("fuel"):
            by_fuel[n["fuel"]].append(n)
    if len(by_fuel) > 1:
        for fuel, rows in sorted(by_fuel.items(), key=lambda kv: -len(kv[1]))[:8]:
            bits = [f"In the {head}, {len(rows)} test rows used {fuel}."]
            for key, label, unit, d in (("o2_all", "oxygen concentration", "%", 1), ("flow_all", "flow velocity", " cm/s", 1),
                                        ("pressure_all", "pressure", " atm", 2)):
                vals = [x for r in rows for x in r.get(key, [])]
                if vals:
                    bits.append(f"The {label} ranged {fmt_range([min(vals), max(vals)], unit, d)}.")
            for key, label in (("co2_pct", "CO2 diluent"), ("he_pct", "helium diluent")):
                vals = [r[key] for r in rows if key in r]
                if vals:
                    bits.append(f"The {label} ranged {fmt_range([min(vals), max(vals)], '%')}.")
            if len(bits) > 1:
                out.append((f"Experimental table: {t['label']} / {fuel}", " ".join(bits)))
    return out


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    os.makedirs(config.PROCESSED, exist_ok=True)
    cur = load(os.path.join(config.CURATED, "investigations.json"))
    raw_inv = {os.path.basename(p)[:-5]: load(p) for p in glob.glob(os.path.join(config.RAW, "investigations", "PSI-*.json"))}
    order = sorted(raw_inv, key=lambda a: int(a.split("-")[1]))

    catalog, tables_out, chunks = [], {}, []

    def add(text, section, source, title, url, acc=None, cite=None):
        for piece in split_words(text):
            chunks.append({"id": f"c{len(chunks):04d}", "acc": acc, "source": source, "section": section,
                           "title": title, "url": url, "cite": cite or title, "text": piece})

    for acc in order:
        d, c = raw_inv[acc], cur["investigations"][acc]
        tabs = [load_table(os.path.join(config.RAW, "tables", f), f) for f in d["tables"]]
        tables_out[acc] = tabs

        def merged(key):
            vals = [v for t in tabs if t[key] for v in t[key]]
            return [min(vals), max(vals)] if vals else None

        fuels = collections.Counter()
        for t in tabs:
            for f, n in t["fuels"]:
                fuels[f] += n
        blob = " ".join([d["objective"] or "", d["approach"] or "", " ".join(d["keywords"]), " ".join(h for t in tabs for h in t["headers"])]).lower()
        inv = {
            "acc": acc, "short": c["short"], "short_ar": c.get("short_ar"), "title": d["title"], "acronym": d["acronym"],
            "kind": "ground" if "ground" in (d["project_type"] or "").lower() else "flight",
            "project_type": d["project_type"], "platform": d["platform"] or None, "hardware": d["hardware"] or None,
            "family": c["family"], "sub_area": d["sub_area"], "start": year(d["start"]), "end": year(d["end"]),
            "related": [r.strip() for r in (d["related"] or "").split(",") if r.strip()],
            "tier": c["tier"], "pillars": c["pillars"], "phase": c["phase"],
            "ar_title": c["ar_title"], "ar": c["ar"], "notes_en": c["notes_en"], "notes_ar": c["notes_ar"],
            "objective": d["objective"], "approach": d["approach"], "hypothesis": d["hypothesis"], "impacts": d["impacts"],
            "keywords": d["keywords"], "publications": d["publications"], "doi": d["doi"], "license": d["license"], "psi_url": d["psi_url"],
            "archive": d["archive"], "archive_gb": round(d["archive_bytes"] / 1e9, 1), "images": d["images"],
            "tables": [{k: t[k] for k in ("file", "label", "n_rows", "columns", "outcome_columns", "o2_range", "flow_range", "pressure_range", "fuels", "notes")} for t in tabs],
            "n_tests": sum(t["n_rows"] for t in tabs if t["is_test_table"]),
            "fuels": fuels.most_common(), "o2_range": merged("o2_range"),
            "o2_values": sorted(v for t in tabs for v in t["o2_values"]),
            "flow_range": merged("flow_range"), "pressure_range": merged("pressure_range"),
            "measurements": [label for pat, label in MEASUREMENTS if re.search(pat, blob)],
        }
        catalog.append(inv)

        # passages from the PSI record
        title, cite = f"{inv['short']} ({acc})", f"PSI {acc} {inv['short']}"
        overview = (f"{inv['short']} ({acc}): {d['title']}. Type: {d['project_type']}. Combustion science / {d['sub_area'] or 'n/a'}. "
                    + (f"Platform: {d['platform']}. " if d['platform'] else "") + (f"Hardware: {d['hardware']}. " if d['hardware'] else "")
                    + f"Hardware family: {c['family']}. "
                    + (f"Years: {inv['start']} to {inv['end'] or 'n/a'}. " if inv['start'] else "")
                    + (f"Keywords: {', '.join(d['keywords'])}. " if d['keywords'] else "")
                    + (f"Related PSI investigations: {', '.join(inv['related'])}. " if inv['related'] else "")
                    + f"Fuel phase: {', '.join(c['phase'])}. Fire-safety relevance: {c['tier']}; pillars: {', '.join(c['pillars'])}. "
                    + f"The PSI archive holds {d['archive']['files']} files ({inv['archive_gb']} GB) and {len(d['publications'])} publications. "
                    + " ".join(c["notes_en"]))
        add(overview, "Overview", "psi", title, d["psi_url"], acc, cite)
        for field, label in (("objective", "Objectives"), ("approach", "Approach"), ("hypothesis", "Hypothesis"), ("impacts", "Research impacts / Earth benefits")):
            if d[field] and len(d[field]) > 30:
                add(f"{inv['short']} ({acc}) - {label}: {d[field]}", label, "psi", title, d["psi_url"], acc, cite)
        if d["publications"]:
            add(f"{inv['short']} ({acc}) - Publications listed in PSI: " + "; ".join(p["title"] for p in d["publications"] if p["title"]),
                "Publications", "psi", title, d["psi_url"], acc, cite)
        for section, text in (p for t in tabs for p in table_passages(inv["short"], acc, t)):
            add(text, section, "psi_table", title, d["psi_url"], acc, cite)

    # ---- Moon readiness per material: what was actually tested, compared with the Moon base target ----
    mats = collections.defaultdict(lambda: {"o2": [], "atm": [], "investigations": set(), "rows": 0, "phase": None})
    for acc, tabs in tables_out.items():
        for t in tabs:
            for n in t["norm"]:
                f = n.get("fuel")
                if not f or "+" in f:
                    continue
                m = mats[f]
                m["rows"] += 1
                m["investigations"].add(acc)
                m["o2"] += n.get("o2_all", [])
                m["atm"] += n.get("pressure_all", [])
    phase_of = {name: phase for _, name, phase in __import__("tables").MATERIALS}
    materials = []
    for name, m in mats.items():
        o2_max = max(m["o2"]) if m["o2"] else None
        atm_min = min(m["atm"]) if m["atm"] else None
        status = ("tested" if o2_max is not None and o2_max >= MOON_O2 else
                  "below" if o2_max is not None else "no_o2_data")
        materials.append({"name": name, "phase": phase_of.get(name), "rows": m["rows"], "investigations": sorted(m["investigations"], key=lambda a: int(a.split("-")[1])),
                          "o2_max": o2_max, "o2_min": min(m["o2"]) if m["o2"] else None, "atm_min": atm_min,
                          "o2_status": status, "low_pressure_tested": atm_min is not None and atm_min <= MOON_ATM})
    materials.sort(key=lambda x: ({"solid": 0, "liquid": 1, "gas": 2}.get(x["phase"], 3), -x["rows"]))

    # ---- cross-investigation passages computed from the tables ----
    by_acc = {i["acc"]: i for i in catalog}
    name = lambda i: f"{i['short']} ({i['acc']})"
    o2 = sorted([i for i in catalog if i["o2_range"]], key=lambda i: -i["o2_range"][1])
    high = [i for i in o2 if i["o2_range"][1] >= MOON_O2]
    solid_mats = [m for m in materials if m["phase"] == "solid"]
    computed = [
        ("Oxygen coverage", "Oxygen concentration tested by each investigation, from the PSI experimental tables. "
         + " ".join(f"{name(i)}: {fmt_range(i['o2_range'], '%')} oxygen, {'/'.join(i['phase'])} fuel." for i in o2)
         + f" Investigations with test conditions at 30% oxygen or more: {', '.join(i['short'] for i in high)}."),
        ("Moon readiness of solid materials", "Moon readiness of solid spacecraft materials, from the PSI experimental tables (a Moon base is expected at 30% oxygen or more and 10.2 psi = 0.69 atm or less). "
         + " ".join(f"{m['name']}: " + (f"highest oxygen tested {m['o2_max']:g}%" if m["o2_max"] is not None else "no oxygen value recorded")
                    + f" in {', '.join(by_acc[a]['short'] for a in m['investigations'])}." for m in solid_mats)
         + f" No solid-material test row in these tables reaches 30% oxygen. The investigations that reach 30% or more ({', '.join(i['short'] for i in high)}) burn "
         + " and ".join(sorted({p for i in high for p in i['phase']})) + " fuels."),
        ("Pressure coverage", "Pressure tested by each investigation, from the PSI experimental tables. "
         + " ".join(f"{name(i)}: {fmt_range(i['pressure_range'], ' atm', 2)}." for i in sorted([i for i in catalog if i['pressure_range']], key=lambda i: i['pressure_range'][0]))
         + " A Moon base is expected at 10.2 psi or less, about 0.69 atm."),
        ("Flow velocity coverage", "Air flow velocity tested by each investigation, from the PSI experimental tables. "
         + " ".join(f"{name(i)}: {fmt_range(i['flow_range'], ' cm/s')}." for i in sorted([i for i in catalog if i['flow_range']], key=lambda i: -i['flow_range'][1]))),
        ("Amount of test data", "Test rows and archive size per investigation. "
         + " ".join(f"{name(i)}: {i['n_tests']} test rows, {len(i['publications'])} publications, {i['archive']['files']} archived files ({i['archive_gb']:g} GB)." for i in sorted(catalog, key=lambda i: -i['n_tests']) if i['n_tests'])),
    ]
    for ph in ("solid", "liquid", "gas"):
        members = [i for i in catalog if ph in i["phase"] and i["fuels"]]
        computed.append((f"{ph.title()} fuels", f"Investigations that burned {ph} fuels and the fuels or samples in their PSI tables (rows). "
                         + " ".join(f"{name(i)}: {', '.join(f'{f} ({n})' for f, n in i['fuels'][:7])}." for i in members)))
    for p, label in cur["pillars"].items():
        members = [i for i in catalog if p in i["pillars"]]
        computed.append((f"Pillar: {p}", f"Fire-safety pillar '{label['en']}'. Investigations: " + "; ".join(f"{name(i)}, {i['tier']} relevance" for i in members) + "."))
    for section, text in computed:
        add(text, f"Computed: {section}", "computed", "Computed from the PSI experimental tables",
            f"{config.PSI}/physci/repo/search?q=combustion", None, "Computed from PSI tables")

    # ---- the other challenge resources ----
    res_dir = os.path.join(config.RAW, "resources")
    for r in load(os.path.join(res_dir, "index.json")):
        path = os.path.join(res_dir, r["id"] + ".txt")
        if r["kind"] == "link" or not os.path.exists(path):
            continue
        text = open(path, encoding="utf-8").read()
        if r["kind"] == "pdf":
            for m in re.finditer(r"\[page (\d+)\]\n(.*?)(?=\n\n\[page |\Z)", text, re.S):
                add(m.group(2), f"page {m.group(1)}", "resource", r["title"], r.get("page", r["url"]), None, f"{r['title']}, p. {m.group(1)}")
        else:
            body = "\n".join(l for l in text.split("\n") if len(l.split()) >= 6)   # skip menu lines
            add(body, "page", "resource", r["title"], r["url"], None, r["title"])

    # ---- the challenge statement ----
    ch = load(os.path.join(config.CURATED, "challenge.json"))
    for p in ch["passages"]:
        add(f"{p['title']}: {p['text']}", p["title"], "challenge", "Flame in Freefall challenge statement", ch["url"], None, "NASA Space Apps challenge statement")

    for fname, obj in (("catalog.json", catalog), ("materials.json", materials), ("tables.json", tables_out), ("chunks.json", chunks)):
        with open(os.path.join(config.PROCESSED, fname), "w", encoding="utf-8") as f:
            json.dump(obj, f, ensure_ascii=False, indent=None if fname != "chunks.json" else 1)
    print(f"catalog: {len(catalog)} investigations, {sum(i['n_tests'] for i in catalog)} test rows")
    print(f"chunks:  {len(chunks)}  {dict(collections.Counter(c['source'] for c in chunks))}")
    print("Moon readiness (solid materials):")
    for m in solid_mats:
        print(f"   {m['name']:32} O2 max={m['o2_max']}  min atm={m['atm_min']}  status={m['o2_status']}  in {m['investigations']}")


if __name__ == "__main__":
    main()

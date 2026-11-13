"""Read NASA's experimental tables and put their key columns on one scale.

Every PSI table has different columns (FLEX is nothing like BASS or ACME). For fire modelling we need:
  o2_pct        oxygen, % by volume (tables write it as 0.21 or as 21)
  pressure_atm  pressure in atm (tables use atm, mmHg or bar)
  flow_cms      air flow velocity, cm/s
  co2_pct, he_pct   diluent gases used to put flames out (FLEX)
  fuel          the fuel or sample material, with one name per material
  outcome       what happened to the flame, where the table records it

The original columns are kept as published; the normalised values are added next to them.
Known errors inside the NASA files are corrected on read and reported as data notes.
"""
import io
import re
import csv
import collections

FUEL_COLUMN = [r"^fuel sample material", r"^sample material", r"^material$", r"^sample \(fuel type\)",
               r"^fuel$", r"^fuel type$", r"^fuel bottle", r"^sample type$"]
O2_COLUMN, O2_SKIP = r"\bxo2\b|o2 %|percent o2|oxygen conc|oxygen mole fraction|^oxygen$|^o initial ambient|^atmosphere", r"final|after|mg/s|flow rate"
FLOW_COLUMN = r"air flow|flow velocity|inlet velocity|air rate"
PRESSURE_COLUMN, PRESSURE_SKIP = r"pressure|^pinit|^approx p", r"final|mean"

# One name per material. Order matters: a matched pattern is removed before the next one is tried,
# so "methanol" is not also counted as "ethanol".
MATERIALS = [
    (r"cotton-?\s?fiberglass(\s*\(sibal\))?|sibal", "SIBAL cotton-fiberglass fabric", "solid"),
    (r"pmma|acrylic|plexiglas", "PMMA (acrylic)", "solid"),
    (r"nomex", "Nomex", "solid"),
    (r"ultem", "Ultem (PEI)", "solid"),
    (r"silicone|silicon rubber", "Silicone", "solid"),
    (r"kapton", "Kapton", "solid"),
    (r"teflon", "Teflon", "solid"),
    (r"pyrell", "Pyrell foam", "solid"),
    (r"lamp ?wick", "Lamp wick", "solid"),
    (r"cotton|cellulose|paper", "Cotton / cellulose", "solid"),
    (r"wax|candle", "Wax (candle)", "solid"),
    (r"dibutyl", "Dibutyl phthalate", "liquid"),
    (r"methanol|ch3oh", "Methanol", "liquid"),
    (r"ethanol", "Ethanol", "liquid"),
    (r"propanol", "Propanol", "liquid"),
    (r"glycerol", "Glycerol", "liquid"),
    (r"iso-?octane", "Iso-octane", "liquid"),
    (r"n-?octane|octane", "n-Octane", "liquid"),
    (r"heptane|c7h16", "n-Heptane", "liquid"),
    (r"c12h26/iso-?dodecane", "n-Dodecane / iso-dodecane blend", "liquid"),
    (r"dodecane|c12h26", "n-Dodecane", "liquid"),
    (r"decane|c10h22", "n-Decane", "liquid"),
    (r"ethylene|c2h4", "Ethylene", "gas"),
    (r"methane|ch4", "Methane", "gas"),
    (r"propylene|c3h6", "Propylene", "gas"),
    (r"propane|c3h8", "Propane", "gas"),
    (r"butane|c4h10", "n-Butane", "gas"),
    (r"ethane|c2h6", "Ethane", "gas"),
    (r"pentane|c5h12", "n-Pentane", "gas"),
    (r"hydrogen|\bh2\b", "Hydrogen", "gas"),
    (r"dust|\bard\b", "Arizona road dust (aerosol)", "aerosol"),
]
NOT_A_TEST = r"soot cleaning|pre-test"
SHAPE_ONLY = r"\brod\b|sphere|spherical|micron|\bfilm\b"   # BASS rows that name only the sample shape

# Errors inside the NASA files themselves
FILE_FIXES = {
    "PSI-21": {"note": "The PSI table has spreadsheet auto-fill errors in 'Fuel Bottle' (CH4 became CH5, CH6...; C2H4 became "
                       "C2H5...). They are read as methane and ethylene, the two fuels named in the CLD Flame objectives.",
               "subs": [(r"\bCH\d+\b", "CH4"), (r"\bC2H\d+\b", "C2H4")]},
}

# Columns that record what happened to the flame: (table file prefix, column pattern, label)
OUTCOME_COLUMNS = [
    ("PSI-69", r"^test end$", "Test end"),
    ("PSI-159", r"^hot ignition$", "Hot ignition"),
    ("PSI-159", r"^self.?ext", "Self-extinguished (SE) or flow terminated (FT)"),
    ("PSI-159", r"^cool flame\?", "Cool flame"),
    ("PSI-99", r"^\?-g burn length$", "Microgravity burn length"),
    ("PSI-99", r"^\?-g spread length$", "Microgravity spread"),
    ("PSI-99", r"^1-g burn length$", "Normal-gravity burn length"),
    ("PSI-99", r"^1-g spread rate$", "Normal-gravity spread rate"),
]


def _clean(h):
    return re.sub(r"\s+", " ", (h or "").replace("﻿", "")).strip()


def read_csv(path):
    raw = open(path, "rb").read()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("cp1252")
    rows = [r for r in csv.reader(io.StringIO(text)) if any(c.strip() for c in r)]
    head = [_clean(h) for h in rows[0]]
    keep = [i for i, h in enumerate(head) if h or any(len(r) > i and r[i].strip() for r in rows[1:])]
    head = [head[i] or f"col{i + 1}" for i in keep]
    body = [[_clean(r[i]) if i < len(r) else "" for i in keep] for r in rows[1:]]
    return head, body


def _first(headers, include, skip=None, extra_skip=None):
    for i, h in enumerate(headers):
        hl = h.lower()
        if re.search(include, hl) and not (skip and re.search(skip, hl)) and not (extra_skip and re.search(extra_skip, hl)):
            return i
    return None


def find_columns(headers):
    low = [h.lower() for h in headers]
    fuel = None
    for pat in FUEL_COLUMN:
        hit = [i for i, h in enumerate(low) if re.search(pat, h) and not re.search(r"rate|mfc|conc", h)]
        if hit:
            fuel = hit[0]
            break
    return {"fuel": fuel, "o2": _first(headers, O2_COLUMN, O2_SKIP),
            "flow": _first(headers, FLOW_COLUMN, extra_skip="fuel"), "pressure": _first(headers, PRESSURE_COLUMN, PRESSURE_SKIP)}


def numbers(cell):
    out = []
    for m in re.findall(r"(?<![A-Za-z])\d*\.?\d+", cell or ""):
        try:
            out.append(float(m))
        except ValueError:
            pass
    return out


def oxygen(cell, header):
    if "atmosphere" in header.lower():                       # s-Flame writes "~21% O2 with N2"
        vals = [float(x) for x in re.findall(r"(\d+(?:\.\d+)?)\s*%\s*O2", cell or "")]
    else:
        vals = numbers(cell)
        if vals and all(v <= 1.0 for v in vals):            # mole fraction -> percent
            vals = [v * 100 for v in vals]
    return [round(v, 2) for v in vals if 5 <= v <= 100]


def pressure(cell, header):
    vals, h = numbers(cell), header.lower() + " " + (cell or "").lower()
    factor = 1 / 760 if ("mmhg" in h or "torr" in h) else 1 / 1.01325 if "bar" in h else 1 / 14.696 if "psi" in h else 1.0
    return [round(v * factor, 3) for v in vals if 0.01 <= v * factor <= 20]


def material(cell):
    """-> (name, phase, guessed_from_shape) or (None, None, False) for rows that are not tests."""
    low = (cell or "").lower().strip()
    if not low or re.search(NOT_A_TEST, low):
        return None, None, False
    rest, found = low, []
    for pat, name, phase in MATERIALS:
        if re.search(pat, rest):
            rest = re.sub(pat, " ", rest)
            if name not in [n for n, _ in found]:
                found.append((name, phase))
    if found:
        return " + ".join(n for n, _ in found[:3]), found[0][1], False
    if re.search(SHAPE_ONLY, low):
        return "PMMA (acrylic)", "solid", True
    return cell.strip()[:40], None, False


def load_table(path, file_name):
    acc = file_name.split("_")[0]
    headers, rows = read_csv(path)
    cols = find_columns(headers)
    notes = []
    fix = FILE_FIXES.get(acc)
    if fix and cols["fuel"] is not None:
        for r in rows:
            for pat, rep in fix["subs"]:
                r[cols["fuel"]] = re.sub(pat, rep, r[cols["fuel"]])
        notes.append(fix["note"])
    low = [h.lower() for h in headers]
    diluents = {"co2_pct": next((i for i, h in enumerate(low) if re.search(r"^co2? initial ambient", h)), None),
                "he_pct": next((i for i, h in enumerate(low) if re.search(r"^he initial ambient|^helium$", h)), None)}
    outcome_cols = [(i, label) for prefix, pat, label in OUTCOME_COLUMNS if prefix == acc
                    for i, h in enumerate(low) if re.search(pat, h)]

    norm, fuels, phases, guessed = [], collections.Counter(), collections.Counter(), 0
    for r in rows:
        rec = {}
        # a cell can hold several tested values ("0.17; 0.21; 0.25"): keep all of them for the ranges,
        # and use the first for plotting
        if cols["o2"] is not None and (v := oxygen(r[cols["o2"]], headers[cols["o2"]])):
            rec["o2_pct"], rec["o2_all"] = v[0], v
        if cols["flow"] is not None and (v := [x for x in numbers(r[cols["flow"]]) if 0 <= x <= 500]):
            rec["flow_cms"], rec["flow_all"] = v[0], v
        if cols["pressure"] is not None and (v := pressure(r[cols["pressure"]], headers[cols["pressure"]])):
            rec["pressure_atm"], rec["pressure_all"] = v[0], v
        for key, i in diluents.items():
            if i is not None and (v := numbers(r[i])) and v[0] <= 1.0:
                rec[key] = round(v[0] * 100, 2)
        if cols["fuel"] is not None:
            name, phase, g = material(r[cols["fuel"]])
            guessed += int(g)
            if name:
                rec["fuel"] = name
                fuels[name] += 1
                if phase:
                    phases[phase] += 1
        out = {label: r[i] for i, label in outcome_cols if r[i] and r[i] not in ("-", "n/a")}
        if out:
            rec["outcome"] = out
        norm.append(rec)
    if guessed:
        notes.append(f"{guessed} rows name the sample only by its shape (rod, sphere, film). They are grouped with PMMA, "
                     "the material named in neighbouring rows and in the BASS publications listed in PSI.")
    if diluents["co2_pct"] is not None:
        notes.append("Column headers in this PSI file lost their subscripts: 'O', 'N' and 'CO' initial ambient composition "
                     "are read as O2, N2 and CO2 (FLEX diluted the atmosphere with CO2 and helium).")

    def rng(key):
        vals = [x for n in norm for x in n.get(key.split("_")[0] + "_all", [n[key]] if key in n else [])]
        return [min(vals), max(vals)] if vals else None

    is_test_table = bool(fuels or rng("o2_pct") or rng("flow_cms"))
    return {
        "file": file_name, "acc": acc, "label": re.sub(r"^PSI-\d+_Experimental table_", "", file_name)[:-4],
        "headers": headers, "rows": rows, "norm": norm, "n_rows": len(rows), "is_test_table": is_test_table,
        "columns": {k: (headers[v] if v is not None else None) for k, v in cols.items()},
        "outcome_columns": [label for _, label in outcome_cols],
        "o2_range": rng("o2_pct"), "o2_values": sorted(x for n in norm for x in n.get("o2_all", [])),
        "flow_range": rng("flow_cms"), "pressure_range": rng("pressure_atm"),
        "fuels": fuels.most_common(), "phases": dict(phases), "notes": notes,
    }


if __name__ == "__main__":
    import os, sys, glob
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import config
    sys.stdout.reconfigure(encoding="utf-8")
    for p in sorted(glob.glob(os.path.join(config.RAW, "tables", "*.csv"))):
        t = load_table(p, os.path.basename(p))
        print(f"{t['acc']:8} {t['label'][:28]:28} rows={t['n_rows']:4} O2={t['o2_range']} flow={t['flow_range']} "
              f"p={t['pressure_range']} outcome={t['outcome_columns']}")
        print(f"{'':8} fuels: {t['fuels'][:6]}")

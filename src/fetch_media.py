"""Real flame images and short videos from the PSI archive (about 43 MB of the ~12 TB).

Picked by looking at a frame of every candidate video: only files that actually show a flame.
Skipped on purpose: a BASS-II clip that only shows a camera's settings screen, and the DAFT photo
(an identifiable astronaut; the submission rules are strict about people appearing).
FLEX and Saffire keep their files inside large zip archives, so they have no media here.

Output: web/media/<file> and web/media/media.json (captions in English and Arabic, source, licence)
Usage:  python src/fetch_media.py
"""
import os
import sys
import json
import requests

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import config

OUT = os.path.join(config.WEB, "media")
HEADERS = {"User-Agent": config.USER_AGENT}
MAX_BYTES = 30e6
# (investigation, PSI file, local name, kind, start second for the preview frame, caption EN, caption AR)
PICKS = [
    ("PSI-25", "PSI-25_Representative Image(s)_BASS-II_flame testing.jpg", "PSI-25_1.jpg", "image", None,
     "A BASS-II flame burning over a solid sample in the flow duct.", "لهب من BASS-II يحترق فوق عينة صلبة داخل نفق الهواء."),
    ("PSI-25", "PSI-25_Raw Data_vlc-record-2015-06-04-17h20m14s-BASS_GMT190_SAMPLE_145_TEST_T21.ts-.mp4", "PSI-25_2.mp4", "video", 2.6,
     "Ignition of a BASS-II sample: a small glow turns into a flame (test T21, 3 s).", "اشتعال عينة في BASS-II: توهج صغير يتحول إلى لهب (الاختبار T21، 3 ثوانٍ)."),
    ("PSI-26", "PSI-26_Raw Data_20130430 13.02.54 iss035m061191257.mp4", "PSI-26_1.mp4", "video", 9,
     "Black-and-white camera video of a BASS test on the ISS, 30 April 2013 (30 s).", "فيديو بالأبيض والأسود لاختبار BASS على محطة الفضاء، 30 نيسان 2013 (30 ثانية)."),
    ("PSI-10", "PSI-10_Representative Image(s)_Flame Design_In Space flame.jpg", "PSI-10_1.jpg", "image", None,
     "A flame from the ACME Flame Design experiment in microgravity.", "لهب من تجربة Flame Design في الجاذبية الصغرى."),
    ("PSI-10", "PSI-10_Representative Image(s)_Flame Design_Flame Stages.jpg", "PSI-10_2.jpg", "image", None,
     "Spherical diffusion flames in Flame Design: dim blue soot-free flames and bright yellow sooty flames.", "لهب انتشار كروي في Flame Design: أزرق خافت بلا سخام، وأصفر ساطع فيه سخام."),
    ("PSI-22", "PSI-22_Representative Image(s)_E-Field flames blue 2.jpg", "PSI-22_1.jpg", "image", None,
     "A blue laminar flame from E-FIELD Flames, which used an electric field to mimic partial gravity.", "لهب أزرق من E-FIELD Flames، التي استخدمت مجالاً كهربائياً لتحاكي الجاذبية الجزئية."),
    ("PSI-23", "PSI-23_Raw Data_vlc-record-2019-09-14-00h51m49s-udp_19256L1pt2.mp4", "PSI-23_1.mp4", "video", 11,
     "A spherical diffusion flame growing around the burner on the ISS (s-Flame raw video, 22 s).", "لهب انتشار كروي يكبر حول الموقد على محطة الفضاء (فيديو خام من s-Flame، 22 ثانية)."),
    ("PSI-39", "PSI-39_Raw Data_MDCA_View_Movie.mp4", "PSI-39_1.mp4", "video", 17,
     "A burning fuel droplet in the Multi-user Droplet Combustion Apparatus (CFI raw video, 85 s).", "قطيرة وقود تحترق في جهاز MDCA (فيديو خام من CFI، 85 ثانية)."),
    ("PSI-107", "PSI-107_Raw Data_GMT62_12.06.mp4", "PSI-107_1.mp4", "video", 17,
     "A small jet flame inside the SPICE flow duct (raw video, March 2009, 34 s).", "لهب نفاث صغير داخل نفق الهواء في SPICE (فيديو خام، آذار 2009، 34 ثانية)."),
    ("PSI-159", "PSI-159_Representative Image(s)_CFI-G_Observation of non-premixed quasi-steady spherical cool flames on porous burners.jpg", "PSI-159_1.jpg", "image", None,
     "A spherical flame on a porous burner, from NASA's CFI-G image on spherical cool flames.", "لهب كروي على موقد مسامي، من صورة CFI-G في ناسا عن اللهب البارد الكروي."),
    ("PSI-159", "PSI-159_Raw Data_vlc-record-2021-04-12-19h41m39s-udp____21102B1.mp4", "PSI-159_2.mp4", "video", 54,
     "A faint spherical flame on the CFI-G burner, the experiment that reached up to 85% oxygen (raw video, 108 s).", "لهب كروي خافت على موقد CFI-G، التجربة التي وصلت إلى 85% أكسجين (فيديو خام، 108 ثوانٍ)."),
]


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    os.makedirs(OUT, exist_ok=True)
    manifest, total, versions = [], 0, {}
    for acc, name, local, kind, t0, cap_en, cap_ar in PICKS:
        if acc not in versions:
            d = requests.get(f"{config.PSI}/geode-py/ws/repo/investigations/{acc}", headers=HEADERS, timeout=60).json()
            versions[acc] = {f["file_name"]: (f.get("version", 1), float(f.get("file_size") or 0)) for f in (d.get("images") or []) + (d.get("added") or [])}
        if name not in versions[acc]:
            print(f"  ! not in PSI any more: {name}")
            continue
        version, size = versions[acc][name]
        path = os.path.join(OUT, local)
        if size > MAX_BYTES:
            print(f"  ! skipped, too large: {name}")
            continue
        if not os.path.exists(path) or os.path.getsize(path) != int(size):
            r = requests.get(f"{config.PSI}/geode-py/ws/studies/{acc}/download", params={"file": name, "version": version, "redirect": "false"}, headers=HEADERS, timeout=60)
            r.raise_for_status()
            with requests.get(r.text.strip().strip('"'), stream=True, timeout=300) as c:
                c.raise_for_status()
                with open(path, "wb") as f:
                    for block in c.iter_content(1 << 20):
                        f.write(block)
        got = os.path.getsize(path)
        total += got
        manifest.append({"acc": acc, "kind": kind, "file": f"media/{local}", "start": t0, "psi_name": name, "bytes": got,
                         "caption_en": cap_en, "caption_ar": cap_ar, "source": f"{config.PSI}/physci/repo/data/investigations/{acc}", "license": "CC0-1.0"})
        print(f"  {acc:8} {kind:5} {got / 1e6:6.2f} MB  {local}")
    json.dump(manifest, open(os.path.join(OUT, "media.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"{len(manifest)} files, {total / 1e6:.1f} MB")


if __name__ == "__main__":
    main()

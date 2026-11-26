#!/usr/bin/env python3
"""Render one week of GBTW carousels and build its HighLevel CSV.

Usage (from the repo root): python3 _scripts/gbtw_carousels_build.py _social/carousels/2026-11-30.json

The week file:
{
  "week": "2026-11-30",
  "carousels": {
    "C1": {"date": "2026-11-30", "time": "07:30:00", "theme": "light", "approved": false,
           "caption": "full caption", "slides": [{"tag": "...", "headline": "...", "body": "..."}]},
    ...
  }
}
Outputs:
  media/carousels/<date>-<id>/slide-NN.png and preview.png  (public at goboilthewater.com/media/...)
  _social/carousels/GBTW-GHL-Carousels-<week>.csv             (approved only; HighLevel Social Planner bulk upload,
                                                               kept as a manual fallback for the API scheduler)
  /tmp/gbtw-manifest.json                                     (approved posts, read by gbtw_ghl_schedule.py)

Checks every approved post before writing anything: 2 to 10 slides, and no em dashes, [NOAH, TODO,
placeholder text, or BOIL / KETTLE outside the brand name.
"""
import csv, json, os, re, subprocess, sys

BASE = "https://goboilthewater.com/media/carousels"
OUT = "media/carousels"


def check(cid, c, n_slides):
    text = c["caption"] + " " + " ".join(f"{s.get('tag', '')} {s.get('headline', '')} {s.get('body', '')}" for s in c["slides"])
    errs = []
    if not 2 <= n_slides <= 10:
        errs.append(f"{n_slides} slides (Instagram carousels take 2 to 10)")
    for bad in ["—", "[NOAH", "TODO", "placeholder"]:
        if bad.lower() in text.lower():
            errs.append(f"contains {bad!r}")
    stripped = re.sub(r"go ?boil ?the ?water", "", text, flags=re.I)
    for word in ["BOIL", "KETTLE"]:
        if re.search(rf"\b{word}\b", stripped):
            errs.append(f"uses the trigger word {word}")
    if errs:
        sys.exit(f"{cid}: " + "; ".join(errs))


week_file = sys.argv[1]
week = json.load(open(week_file))
cars = week["carousels"]
spec_tmp = "/tmp/gbtw-specs.json"
json.dump({k: {"date": v["date"], "theme": v.get("theme", "light"), "slides": v["slides"]} for k, v in cars.items()},
          open(spec_tmp, "w"))
subprocess.run(["node", "_scripts/gbtw_carousel_render.js", spec_tmp, OUT], check=True)

manifest = []
for cid, c in sorted(cars.items(), key=lambda kv: (kv[1]["date"], kv[1].get("time", "07:30:00"))):
    if not c.get("approved"):
        continue
    d = f"{c['date']}-{cid}"
    slides = sorted(f for f in os.listdir(f"{OUT}/{d}") if f.startswith("slide-"))
    check(cid, c, len(slides))
    manifest.append({"id": cid, "date": c["date"], "time": c.get("time", "07:30:00"), "caption": c["caption"],
                     "media": [f"{BASE}/{d}/{s}" for s in slides]})

json.dump({"week": week["week"], "posts": manifest}, open("/tmp/gbtw-manifest.json", "w"))
if manifest:
    # HighLevel Social Planner bulk upload (basic CSV). Headers must match HighLevel's sample exactly.
    # Times are read in the HighLevel location's time zone (US Central).
    ghl_path = f"_social/carousels/GBTW-GHL-Carousels-{week['week']}.csv"
    with open(ghl_path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["postAtSpecificTime (YYYY-MM-DD HH:mm:ss)", "content", "link (OGmetaUrl)", "imageUrls", "gifUrl", "videoUrls"])
        for m in manifest:
            w.writerow([f"{m['date']} {m['time']}", m["caption"], "", ",".join(m["media"]), "", ""])
    print("wrote", ghl_path)
else:
    print("No carousels approved yet, so no CSV. Previews only.")
for cid, c in cars.items():
    print(f"preview {cid}: {BASE}/{c['date']}-{cid}/preview.png")

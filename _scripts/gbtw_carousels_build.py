#!/usr/bin/env python3
"""Render one week of GBTW carousels and build its Metricool CSV.

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
  _social/carousels/GBTW-Metricool-Carousels-<week>.csv       (approved only; _ folders stay off the public site)
  _social/carousels/GBTW-GHL-Carousels-<week>.csv             (approved only; HighLevel Social Planner bulk upload, basic format)
"""
import csv, json, os, subprocess, sys

BASE = "https://goboilthewater.com/media/carousels"
OUT = "media/carousels"

week_file = sys.argv[1]
week = json.load(open(week_file))
cars = week["carousels"]
spec_tmp = "/tmp/gbtw-specs.json"
json.dump({k: {"date": v["date"], "theme": v.get("theme", "light"), "slides": v["slides"]} for k, v in cars.items()},
          open(spec_tmp, "w"))
subprocess.run(["node", "_scripts/gbtw_carousel_render.js", spec_tmp, OUT], check=True)

manifest = []
for cid, c in sorted(cars.items(), key=lambda kv: (kv[1]["date"], kv[1].get("time", "07:30:00"))):
    d = f"{c['date']}-{cid}"
    slides = sorted(f for f in os.listdir(f"{OUT}/{d}") if f.startswith("slide-"))
    manifest.append({"date": c["date"], "time": c.get("time", "07:30:00"), "type": "POST",
                     "approved": bool(c.get("approved")), "caption": c["caption"],
                     "media": [f"{BASE}/{d}/{s}" for s in slides]})

csv_path = f"_social/carousels/GBTW-Metricool-Carousels-{week['week']}.csv"
if any(m["approved"] for m in manifest):
    json.dump(manifest, open("/tmp/gbtw-manifest.json", "w"))
    subprocess.run(["python3", "_scripts/gbtw_metricool_csv.py", "/tmp/gbtw-manifest.json", csv_path], check=True)
    # HighLevel Social Planner bulk upload (basic CSV). Headers must match HighLevel's sample exactly.
    # Times are read in the HighLevel location's time zone (US Central).
    ghl_path = f"_social/carousels/GBTW-GHL-Carousels-{week['week']}.csv"
    with open(ghl_path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["postAtSpecificTime (YYYY-MM-DD HH:mm:ss)", "content", "link (OGmetaUrl)", "imageUrls", "gifUrl", "videoUrls"])
        for m in manifest:
            if m["approved"]:
                w.writerow([f"{m['date']} {m['time']}", m["caption"], "", ",".join(m["media"]), "", ""])
    print("wrote", ghl_path)
else:
    print("No carousels approved yet, so no CSV. Previews only.")
for cid, c in cars.items():
    print(f"preview {cid}: {BASE}/{c['date']}-{cid}/preview.png")

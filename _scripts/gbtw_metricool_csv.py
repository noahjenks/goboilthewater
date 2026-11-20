"""Build a Metricool bulk-import CSV for Go Boil the Water.

Usage: python3 gbtw_metricool_csv.py manifest.json out.csv

manifest.json is a list of posts:
  {"date": "2026-11-23", "time": "07:30:00", "type": "POST" | "REEL" | "TRIAL_REEL",
   "approved": true, "caption": "full caption text",
   "media": ["https://goboilthewater.com/media/carousels/.../slide-01.png", ...]}

Rules it enforces:
- Only posts with "approved": true go into the CSV (carousels need Noah's approval in chat first).
- POST (carousel): 2 to 10 images. REEL / TRIAL_REEL: exactly 1 video.
- TRIAL_REEL sets "Instagram Show Reel On Feed" FALSE; REEL sets it TRUE.
- No em dashes, no [NOAH, TODO or placeholder text, and no BOIL or KETTLE outside the brand name.
- Instagram only; every other network FALSE; Draft FALSE. Times are Central, the same as earlier weeks.
"""
import csv, json, re, sys

HEADER = """Text,Date,Time,Draft,Facebook,Twitter/X,LinkedIn,GBP,Instagram,Pinterest,TikTok,YouTube,Threads,Bluesky,Picture Url 1,Picture Url 2,Picture Url 3,Picture Url 4,Picture Url 5,Picture Url 6,Picture Url 7,Picture Url 8,Picture Url 9,Picture Url 10,Alt text picture 1,Alt text picture 2,Alt text picture 3,Alt text picture 4,Alt text picture 5,Alt text picture 6,Alt text picture 7,Alt text picture 8,Alt text picture 9,Alt text picture 10,Document title,Shortener,Video Thumbnail Url,Video Cover Frame,Twitter/X Can reply,Twitter/X Type,Twitter/X Poll Duration minutes,Twitter/X Poll Option 1,Twitter/X Poll Option 2,Twitter/X Poll Option 3,Twitter/X Poll Option 4,Pinterest Board,Pinterest Pin Title,Pinterest Pin Link,Pinterest Pin New Format,Instagram Post Type,Instagram Show Reel On Feed,YouTube Video Title,YouTube Video Type,YouTube Video Privacy,YouTube video for kids,YouTube Video Category,YouTube Video Tags,YouTube Playlist,YouTube Notify Subscribers,GBP Post Type,Facebook Post Type,Facebook Title,First Comment Text,TikTok Title,TikTok disable comments,TikTok disable duet,TikTok disable stitch,TikTok Post Privacy (personal accounts only),TikTok Branded Content (personal accounts only),TikTok Your Brand (personal accounts only),TikTok Auto Add Music (personal accounts only),TikTok Photo Cover Index,TikTok musicId,TikTok music title,TikTok music author,TikTok music previewUrl,TikTok music thumbnailUrl,TikTok music soundVolume,TikTok music originalVolume,TikTok music startMillis,TikTok music endMillis,LinkedIn Type,LinkedIn Poll Question,LinkedIn Poll Option 1,LinkedIn Poll Option 2,LinkedIn Poll Option 3,LinkedIn Poll Option 4,LinkedIn Poll Duration,LinkedIn Show link preview,LinkedIn Images as Carousel,Threads Reply Control,Threads Is Spoiler,Threads Post Type,Brand name (Optional)""".split(',')
NETWORKS = ['Facebook', 'Twitter/X', 'LinkedIn', 'GBP', 'Pinterest', 'TikTok', 'YouTube', 'Threads', 'Bluesky']


def check(text):
    t = re.sub(r'Go Boil the Water|goboilthewater', '', text)
    bad = [b for b in ['—', '[NOAH', 'TODO', 'placeholder'] if b.lower() in t.lower()]
    bad += [w for w in ['BOIL', 'KETTLE'] if re.search(w, t, re.I)]
    return bad


def main(manifest, out):
    posts = json.load(open(manifest))
    rows, skipped, errors = [], [], []
    for i, p in enumerate(posts, 1):
        if not p.get('approved'):
            skipped.append(i); continue
        media = p.get('media', [])
        kind = p['type']
        if kind == 'POST' and not 2 <= len(media) <= 10:
            errors.append(f'post {i}: carousel needs 2 to 10 images, has {len(media)}')
        if kind in ('REEL', 'TRIAL_REEL') and len(media) != 1:
            errors.append(f'post {i}: reel needs exactly 1 video, has {len(media)}')
        bad = check(p['caption'])
        if bad:
            errors.append(f'post {i}: caption contains {bad}')
        r = {h: '' for h in HEADER}
        r.update({'Text': p['caption'], 'Date': p['date'], 'Time': p['time'], 'Draft': 'FALSE', 'Instagram': 'TRUE',
                  'Instagram Post Type': kind})
        for n in NETWORKS:
            r[n] = 'FALSE'
        for k, u in enumerate(media[:10], 1):
            r[f'Picture Url {k}'] = u
        if kind in ('REEL', 'TRIAL_REEL'):
            r['Instagram Show Reel On Feed'] = 'TRUE' if kind == 'REEL' else 'FALSE'
        rows.append(r)
    if errors:
        print('NOT WRITTEN:\n' + '\n'.join(errors)); sys.exit(1)
    with open(out, 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=HEADER, quoting=csv.QUOTE_MINIMAL)
        w.writeheader(); w.writerows(rows)
    print(f'wrote {len(rows)} rows to {out}; skipped (not approved): {skipped}')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])

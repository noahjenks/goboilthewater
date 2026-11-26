#!/usr/bin/env python3
"""Schedule approved GBTW carousels in HighLevel's Social Planner through the HighLevel API.

Usage (from the repo root, after gbtw_carousels_build.py has written /tmp/gbtw-manifest.json):
  python3 _scripts/gbtw_ghl_schedule.py /tmp/gbtw-manifest.json

Settings (GitHub repo > Settings > Secrets and variables > Actions):
  GHL_TOKEN                 secret    HighLevel Private Integration token with Social Planner scopes
                                      (socialplanner/post.write, socialplanner/post.readonly,
                                      socialplanner/account.readonly). Without it this script does nothing.
  GHL_LOCATION_ID           variable  the location ID from the HighLevel URL (.../v2/location/<ID>/...)
  GHL_INSTAGRAM_ACCOUNT_ID  variable  optional; if unset, the script uses the one Instagram account connected
                                      in Social Planner and prints its ID
  GHL_USER_ID               variable  optional; the HighLevel user the posts are created as

Safety:
- Only approved carousels reach the manifest, and only ones dated in the future are sent.
- Every post sent is recorded in _social/carousels/ghl-scheduled-<week>.json with HighLevel's post ID,
  so a rerun never schedules the same carousel twice. To resend one, delete its line from that file.
- Times are the week file's US Central times, converted to UTC for the API.
- Any API error stops the run with HighLevel's response printed, so GitHub emails Noah that the run failed.
"""
import json, os, sys, urllib.error, urllib.request
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

API = "https://services.leadconnectorhq.com"
VERSION = "2021-07-28"
CENTRAL = ZoneInfo("America/Chicago")


def call(method, path, token, body=None):
    req = urllib.request.Request(
        API + path, method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Authorization": f"Bearer {token}", "Version": VERSION,
                 "Accept": "application/json", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        sys.exit(f"HighLevel API {method} {path} failed: HTTP {e.code}\n{e.read().decode(errors='replace')}")


def instagram_account(token, loc):
    acct = os.environ.get("GHL_INSTAGRAM_ACCOUNT_ID", "").strip()
    if acct:
        return acct
    res = call("GET", f"/social-media-posting/{loc}/accounts", token)
    accounts = (res.get("results") or res).get("accounts", [])
    ig = [a for a in accounts if str(a.get("platform", "")).lower() == "instagram" and not a.get("deleted")]
    for a in accounts:
        print(f"  connected account: {a.get('platform')} | {a.get('name')} | id {a.get('id')}")
    if len(ig) != 1:
        sys.exit(f"Found {len(ig)} Instagram accounts in Social Planner. Set GHL_INSTAGRAM_ACCOUNT_ID to the right id above.")
    print(f"Using Instagram account {ig[0].get('name')} ({ig[0]['id']}). Set GHL_INSTAGRAM_ACCOUNT_ID to pin it.")
    return ig[0]["id"]


def main():
    token = os.environ.get("GHL_TOKEN", "").strip()
    loc = os.environ.get("GHL_LOCATION_ID", "").strip()
    if not token or not loc:
        print("GHL_TOKEN or GHL_LOCATION_ID is not set, so nothing was scheduled. Use the GHL CSV instead.")
        return
    manifest = json.load(open(sys.argv[1]))
    week, posts = manifest["week"], manifest["posts"]
    record_path = f"_social/carousels/ghl-scheduled-{week}.json"
    record = json.load(open(record_path)) if os.path.exists(record_path) else {}
    now = datetime.now(timezone.utc)
    todo = []
    for p in posts:
        when = datetime.fromisoformat(f"{p['date']}T{p['time']}").replace(tzinfo=CENTRAL).astimezone(timezone.utc)
        if p["id"] in record:
            print(f"{p['id']}: already scheduled ({record[p['id']]}), skipping")
        elif when <= now:
            print(f"{p['id']}: {p['date']} {p['time']} Central is in the past, skipping")
        else:
            todo.append((p, when))
    if not todo:
        print("Nothing new to schedule.")
        return
    acct = instagram_account(token, loc)
    for p, when in todo:
        body = {
            "accountIds": [acct],
            "type": "post",
            "status": "scheduled",
            "scheduleDate": when.strftime("%Y-%m-%dT%H:%M:%S.000Z"),
            "summary": p["caption"],
            "media": [{"url": u, "type": "image/png"} for u in p["media"]],
        }
        if os.environ.get("GHL_USER_ID", "").strip():
            body["userId"] = os.environ["GHL_USER_ID"].strip()
        res = call("POST", f"/social-media-posting/{loc}/posts", token, body)
        post = (res.get("results") or res).get("post") or res.get("results") or res
        post_id = post.get("_id") or post.get("id") or "created (no id returned)"
        record[p["id"]] = post_id
        json.dump(record, open(record_path, "w"), indent=2)  # save after each post so a later failure can't cause a repeat
        print(f"{p['id']}: scheduled for {p['date']} {p['time']} Central, HighLevel post {post_id}")


if __name__ == "__main__":
    main()

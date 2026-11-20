#!/usr/bin/env python3
"""Publish one queued Go Boil the Water blog post to the live site.

Usage: python3 gbtw_publish_post.py <queue_dir> [--repo PATH] [--due YYYY-MM-DD] [--push]

<queue_dir> holds index.html (the finished post page), meta.json and approved.txt.
  meta.json: {"slug", "date" (YYYY-MM-DD), "date_long", "title", "card", "llms"}
--repo PATH  work in an existing checkout of main (the GitHub Action uses this). It commits
             there and leaves the push to the caller.
--due DATE   skip the post if its date is after DATE.
Without --repo it clones the repo to /tmp, and --push pushes to main (old session mode).
"""
import html, json, os, re, shutil, subprocess, sys

REPO_URL = "https://github.com/noahjenks/goboilthewater.git"
WORK = "/tmp/gbtw-publish"


def sh(*a, cwd=None):
    r = subprocess.run(a, cwd=cwd, capture_output=True, text=True)
    if r.returncode:
        sys.exit(f"FAILED: {' '.join(a)}\n{r.stdout}\n{r.stderr}")
    return r.stdout


def attr(s):
    return html.escape(s, quote=True)


def opt(name):
    if name in sys.argv:
        return sys.argv[sys.argv.index(name) + 1]


def main():
    qdir = sys.argv[1].rstrip("/")
    push = "--push" in sys.argv
    repo, due = opt("--repo"), opt("--due")
    if not os.path.exists(f"{qdir}/approved.txt"):
        print(f"NOT APPROVED: {qdir}"); return
    meta = json.load(open(f"{qdir}/meta.json"))
    page = open(f"{qdir}/index.html").read()
    slug = meta["slug"]
    if due and meta["date"] > due:
        print(f"NOT DUE: {slug} ({meta['date']})"); return
    if not repo:
        shutil.rmtree(WORK, ignore_errors=True)
        sh("git", "clone", "-q", REPO_URL, WORK)
        repo = WORK
    if os.path.exists(f"{repo}/blog/{slug}/index.html"):
        print(f"ALREADY LIVE: blog/{slug}/"); return
    before = {f: open(f"{repo}/{f}").read() for f in ["blog/index.html", "index.html", "sitemap.xml", "llms.txt"]}

    # match the live site's asset cache-busting version (?v=...)
    live_v = re.search(r'styles\.css\?v=([0-9a-z]+)', before["index.html"])
    if live_v:
        page = re.sub(r'(\.(?:css|js)\?v=)[0-9a-z]+', r'\g<1>' + live_v.group(1), page)
    # sanity checks on the page
    for m in re.findall(r'<script type="application/ld\+json">(.*?)</script>', page, re.S):
        json.loads(m)
    for bad in ["[NOAH", "TODO", "—"]:
        if bad in page:
            sys.exit(f"FAILED: {slug} page contains {bad!r}")
    os.makedirs(f"{repo}/blog/{slug}", exist_ok=True)
    open(f"{repo}/blog/{slug}/index.html", "w").write(page)
    for h in set(re.findall(r'href="(/[^"#?]*)"', page)):
        p = repo + h + ("index.html" if h.endswith("/") else "")
        if not os.path.exists(p):
            shutil.rmtree(f"{repo}/blog/{slug}")
            sys.exit(f"FAILED: {slug} has a broken internal link {h}")

    # blog/index.html: card at top
    bi = before["blog/index.html"]
    card = (f'        <li class="blog-card">\n          <time datetime="{meta["date"]}">{meta["date_long"]}</time>\n'
            f'          <h2><a href="/blog/{slug}/">{attr(meta["title"])}</a></h2>\n          <p>{attr(meta["card"])}</p>\n        </li>\n')
    i = bi.index('        <li class="blog-card">'); bi = bi[:i] + card + bi[i:]
    open(f"{repo}/blog/index.html", "w").write(bi)
    # index.html: top of home-post-list
    hi = before["index.html"]
    i = hi.index('<ul class="home-post-list">') + len('<ul class="home-post-list">\n')
    hi = hi[:i] + f'        <li><a href="/blog/{slug}/">{attr(meta["title"])}</a></li>\n' + hi[i:]
    open(f"{repo}/index.html", "w").write(hi)
    # sitemap
    sm = before["sitemap.xml"]
    sm = re.sub(r'(<loc>https://goboilthewater.com/blog/</loc>\s*<lastmod>)[^<]+', r'\g<1>' + meta["date"], sm)
    loc = f"https://goboilthewater.com/blog/{slug}/"
    block = f'  <url>\n    <loc>{loc}</loc>\n    <lastmod>{meta["date"]}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>\n'
    i = sm.index("</urlset>"); sm = sm[:i] + block + sm[i:]
    open(f"{repo}/sitemap.xml", "w").write(sm)
    # llms.txt: end of Blog posts section
    ll = before["llms.txt"]; i = ll.index("\n## Chapters")
    ll = ll[:i].rstrip("\n") + "\n" + f'- [{meta["title"]}]({loc}): {meta["llms"]}\n' + ll[i:]
    open(f"{repo}/llms.txt", "w").write(ll)

    # shared files may only add lines (plus the /blog/ lastmod)
    for f, old in before.items():
        new = open(f"{repo}/{f}").read().splitlines()
        removed = [l for l in old.splitlines() if l not in new]
        if f == "sitemap.xml":
            removed = [l for l in removed if "<lastmod>" not in l]
        if removed:
            sys.exit(f"FAILED: {f} would remove lines: {removed[:3]}")
    assert os.path.exists(f"{repo}/CNAME"), "CNAME missing"

    sh("git", "add", f"blog/{slug}/index.html", "blog/index.html", "index.html", "sitemap.xml", "llms.txt", cwd=repo)
    sh("git", "-c", "user.name=Noah Jenks", "-c", "user.email=noah.jenks@gmail.com", "commit", "-q", "-m",
       f"Publish blog post: {meta['title']}", cwd=repo)
    if repo != WORK:
        print("COMMITTED:", loc); return
    if not push:
        print("DRY RUN OK:", sh("git", "show", "--stat", "--oneline", "HEAD", cwd=repo)); return
    sh("git", "push", "-q", REPO_URL, "HEAD:main", cwd=repo)
    print("PUSHED:", loc)


if __name__ == "__main__":
    main()

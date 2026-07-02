#!/usr/bin/env python3
"""Cairnsite Pulse — one-command poster (mirrors the SheetReady pattern, no deps).

    python run_next.py            # inject the next queued item into pulse/index.html
    python run_next.py status     # show what's queued vs sent (no posting)

Marks items 'sent' in pulse_queue.json so nothing double-posts. Runs entirely on
stdlib (json/re/datetime) — no pip install needed in the GitHub Actions workflow.
"""
import json, os, re, sys, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
QUEUE = os.path.join(HERE, "pulse_queue.json")
PULSE_HTML = os.path.normpath(os.path.join(HERE, "..", "pulse", "index.html"))
SITEMAP = os.path.normpath(os.path.join(HERE, "..", "sitemap.xml"))
MAX_ENTRIES = 10

ENTRY_TMPL = """  <article class="entry">
    <p class="date">{date_long}</p>
    <h2>{headline}</h2>
    <div class="body">
{paragraphs}
    </div>
  </article>

"""


def _load():
    with open(QUEUE, encoding="utf-8") as f:
        return json.load(f)


def _save(d):
    with open(QUEUE, "w", encoding="utf-8") as f:
        json.dump(d, f, indent=2, ensure_ascii=False)
        f.write("\n")


def _update_jsonld(html, new_posting, max_entries):
    """Parse the page's JSON-LD as real JSON (never regex/string-surgery on JSON —
    the last array item has no trailing comma, which broke a naive comma-based
    trim on day 11 in testing). Insert the new posting, trim from the true end."""
    m = re.search(r'(<script type="application/ld\+json">\s*)(.*?)(\s*</script>)', html, re.S)
    data = json.loads(m.group(2))
    blog = next(node for node in data["@graph"] if node.get("@type") == "Blog")
    blog["blogPost"].insert(0, new_posting)
    if len(blog["blogPost"]) > max_entries:
        blog["blogPost"] = blog["blogPost"][:max_entries]
    new_json = json.dumps(data, ensure_ascii=False)
    return html[: m.start()] + m.group(1) + new_json + m.group(3) + html[m.end():]


def inject(item):
    today = datetime.date.today()
    date_long = f"{today.day} {today.strftime('%B %Y')}"   # e.g. "1 July 2026" (portable across OSes)
    date_iso = today.isoformat()

    paragraphs_html = "\n".join(f"      <p>{p}</p>" for p in item["paragraphs"])
    entry_html = ENTRY_TMPL.format(date_long=date_long, headline=item["headline"], paragraphs=paragraphs_html)

    new_posting = {
        "@type": "BlogPosting",
        "headline": item["headline"],
        "datePublished": date_iso,
        "description": item["description"],
    }

    with open(PULSE_HTML, encoding="utf-8") as f:
        html = f.read()

    # --- 1. Insert the new <article> as the first entry in the feed ---
    feed_marker = '<section class="feed" aria-label="Tips feed">\n'
    idx = html.index(feed_marker) + len(feed_marker)
    html = html[:idx] + "\n" + entry_html + html[idx:]

    # --- 2. Trim to MAX_ENTRIES: drop the oldest <article> block if over the cap ---
    articles = list(re.finditer(r'  <article class="entry">.*?</article>\n\n', html, re.S))
    if len(articles) > MAX_ENTRIES:
        oldest = articles[-1]
        html = html[: oldest.start()] + html[oldest.end():]

    # --- 3. Insert + trim the matching JSON-LD BlogPosting via real JSON parsing ---
    html = _update_jsonld(html, new_posting, MAX_ENTRIES)

    with open(PULSE_HTML, "w", encoding="utf-8") as f:
        f.write(html)

    # --- 4. Bump sitemap.xml's lastmod for /pulse/ ---
    if os.path.exists(SITEMAP):
        with open(SITEMAP, encoding="utf-8") as f:
            sitemap = f.read()
        sitemap = re.sub(
            r"(<loc>https://cairnsite\.vercel\.app/pulse/</loc>\s*<lastmod>)[\d-]+(</lastmod>)",
            r"\g<1>" + date_iso + r"\g<2>",
            sitemap,
        )
        with open(SITEMAP, "w", encoding="utf-8") as f:
            f.write(sitemap)

    return date_iso


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "next"
    d = _load()
    queued = [p for p in d["posts"] if p["status"] == "queued"]

    if cmd == "status":
        for p in d["posts"]:
            print(f"  [{p['status']:>6}] {p['id']}")
        print(f"  {len(queued)} queued, {len(d['posts']) - len(queued)} sent")
    elif not queued:
        print("Nothing queued. Add posts to pulse_queue.json.")
    else:
        item = queued[0]
        date_iso = inject(item)
        item["status"] = "sent"
        item["posted_on"] = date_iso
        _save(d)
        print(f"posted: {item['id']} ({date_iso})")

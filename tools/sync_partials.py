"""Copy the shared header and footer into every page.

Each page keeps its own copy of the header and footer so the site works as
plain HTML on GitHub Pages with no build step. When you change the nav or
footer, edit partials/header.html or partials/footer.html, then run:

    python tools/sync_partials.py

It replaces everything between <!-- @header --> and <!-- /@header --> (and the
same for @footer) in each *.html file at the site root, and marks the current
page's nav link with aria-current="page" (both work pages mark "Work").
"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PARTIALS = ROOT / "partials"


def block(name: str, html: str, content: str) -> str:
    pattern = re.compile(rf"(<!-- @{name} -->)(.*?)(<!-- /@{name} -->)", re.S)
    if not pattern.search(html):
        return html
    return pattern.sub(lambda m: f"{m.group(1)}\n{content.strip()}\n{m.group(3)}", html, count=1)


# pages that light up a nav link other than their own ("Work" covers both tabs)
SECTION = {"optics.html": "optics.html", "materials.html": "optics.html"}


def mark_current(header: str, page: str) -> str:
    target = SECTION.get(page, page)
    value = "page" if target == page else "true"
    # mark the nav link, not the name at the left (both point at index.html)
    return header.replace(f'class="nav__link" href="{target}">', f'class="nav__link" href="{target}" aria-current="{value}">', 1)


def main() -> None:
    header = (PARTIALS / "header.html").read_text(encoding="utf-8")
    footer = (PARTIALS / "footer.html").read_text(encoding="utf-8")
    for page in sorted(ROOT.glob("*.html")):
        html = page.read_text(encoding="utf-8")
        head = mark_current(header, page.name)
        if page.name == "404.html":  # its <base href="/"> would send "#main" to the home page
            head = head.replace('href="#main"', 'href="404.html#main"')
        new = block("header", html, head)
        new = block("footer", new, footer)
        if new != html:
            page.write_text(new, encoding="utf-8")
            print(f"updated {page.name}")


if __name__ == "__main__":
    main()

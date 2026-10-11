"""Print a ready-to-paste montage tile for an image or video.

    python tools/tile.py assets/img/irradiant/new-photo.webp "Short caption"
    python tools/tile.py assets/video/new-loop.mp4 "Short caption" assets/video/new-loop.webp

The --ar value (width / height) is read from the file, so tiles in a row stay the
same height. Videos need a poster image; ffprobe must be installed for them.
"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def size(path: str) -> tuple[int, int]:
    full = ROOT / path
    if path.endswith(".svg"):
        m = re.search(r'viewBox="\s*[-\d.]+[ ,]+[-\d.]+[ ,]+([\d.]+)[ ,]+([\d.]+)', full.read_text(encoding="utf-8")[:6000])
        return round(float(m.group(1))), round(float(m.group(2)))
    if path.endswith(".mp4"):
        out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                              "stream=width,height", "-of", "csv=p=0", str(full)], capture_output=True, text=True).stdout
        w, h = out.strip().split(",")
        return int(w), int(h)
    from PIL import Image
    with Image.open(full) as im:
        return im.size


def main() -> None:
    path, caption = sys.argv[1], sys.argv[2]
    w, h = size(path)
    if path.endswith(".mp4"):
        poster = sys.argv[3]
        media = (f'<video data-loop data-zoom muted playsinline preload="metadata" poster="{poster}" '
                 f'width="{w}" height="{h}" aria-label="DESCRIBE THE VIDEO"><source src="{path}" type="video/mp4"></video>')
    else:
        media = f'<img src="{path}" width="{w}" height="{h}" loading="lazy" data-zoom alt="DESCRIBE THE IMAGE">'
    print(f'<figure class="tile" style="--ar:{w / h:.4f}">\n'
          f'  <div class="tile__media">{media}</div>\n'
          f'  <figcaption>{caption}</figcaption>\n'
          f'</figure>')


if __name__ == "__main__":
    main()

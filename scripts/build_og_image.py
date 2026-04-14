"""
Build og-image.png (1200x630) from the inline zf-logo SVG in index.html.
Run: py -3 scripts/build_og_image.py
"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / "index.html"
OUT_PNG = ROOT / "og-image.png"
OUT_SVG = ROOT / "assets" / "zepfusion-og-source.svg"

FILL = {
    "logo-primary": "#f0f2f7",
    "logo-accent-red": "#e05062",
    "logo-accent-teal": "#44abb6",
    "logo-accent-yellow": "#fdc446",
    "logo-wordmark": "#f0f2f7",
}


def extract_logo_svg_inner(html: str) -> str:
    m = re.search(
        r'<div class="zf-logo"[^>]*>\s*(<svg\b[\s\S]*?</svg>)\s*</div>',
        html,
        re.IGNORECASE,
    )
    if not m:
        raise SystemExit("Could not find zf-logo SVG in index.html")
    return m.group(1)


def strip_classes_apply_fills(svg_inner: str) -> str:
    """Remove class/style from path/ellipse; set fill for OG (dark theme colors)."""
    out = svg_inner

    def clean_path(m: re.Match) -> str:
        cls = m.group(1)
        rest = m.group(2)  # transform + d= etc
        fill = FILL[cls]
        return f'<path fill="{fill}" {rest}'

    def clean_ellipse(m: re.Match) -> str:
        cls = m.group(1)
        rest = m.group(2)
        fill = FILL[cls]
        return f'<ellipse fill="{fill}" {rest}'

    for cls in FILL:
        fill = FILL[cls]
        # path: class then optional style then rest
        out = re.sub(
            rf'<path\s+class="{re.escape(cls)}"\s+style="[^"]*"\s*',
            f'<path fill="{fill}" ',
            out,
            flags=re.IGNORECASE,
        )
        out = re.sub(
            rf'<ellipse\s+class="{re.escape(cls)}"\s+style="[^"]*"\s*',
            f'<ellipse fill="{fill}" ',
            out,
            flags=re.IGNORECASE,
        )
    # wordmark paths only have fill #000000 in file
    out = re.sub(
        r'<path\s+class="logo-wordmark"\s+fill="[^"]*"\s+opacity="[^"]*"\s*',
        f'<path fill="{FILL["logo-wordmark"]}" opacity="1" ',
        out,
        flags=re.IGNORECASE,
    )
    return out


def build_wrapper(inner: str) -> str:
    inner = strip_classes_apply_fills(inner)
    m = re.match(r"<svg\b[^>]*>([\s\S]*)</svg>\s*$", inner.strip(), re.I)
    if not m:
        raise SystemExit("Inner SVG parse failed")
    body = m.group(1)
    return f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#0d0f14"/>
  <svg x="300" y="15" width="600" height="600" viewBox="150 50 250 250" preserveAspectRatio="xMidYMid meet">
{body}
  </svg>
</svg>
'''


def main() -> None:
    html = INDEX.read_text(encoding="utf-8")
    inner_svg = extract_logo_svg_inner(html)
    wrapped = build_wrapper(inner_svg)
    OUT_SVG.parent.mkdir(parents=True, exist_ok=True)
    OUT_SVG.write_text(wrapped, encoding="utf-8")

    import cairosvg

    cairosvg.svg2png(bytestring=wrapped.encode("utf-8"), write_to=str(OUT_PNG), output_width=1200, output_height=630)
    print(f"Wrote {OUT_PNG}")
    print(f"Source {OUT_SVG}")


if __name__ == "__main__":
    main()

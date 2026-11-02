"""Generate app icons from shared vector geometry. Requires Pillow (API dependency)."""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1] / "apps/web/public"
BG, PAPER, ACCENT = "#275f4e", "#fff8e8", "#e77d58"
SVG = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
  <rect width="256" height="256" fill="{BG}"/>
  <circle cx="144" cy="128" r="60" fill="{PAPER}"/>
  <circle cx="144" cy="128" r="46" fill="none" stroke="{BG}" stroke-width="4"/>
  <path d="M42 82v27q0 13 13 13t13-13V82M55 82v92" fill="none" stroke="{PAPER}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="m119 128 17 18 31-36" fill="none" stroke="{ACCENT}" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
'''
ROOT.joinpath("favicon-v2.svg").write_text(SVG, encoding="utf-8")
# Render at 4x the largest output, then downsample for clean edges.
scale = 8
im = Image.new("RGB", (256 * scale, 256 * scale), BG)
d = ImageDraw.Draw(im)
def points(values): return [(int(x*scale), int(y*scale)) for x,y in values]
def line(values, color, width):
    ps = points(values)
    d.line(ps, fill=color, width=width*scale, joint="curve")
    r = width*scale/2
    for x,y in ps: d.ellipse((x-r,y-r,x+r,y+r), fill=color)
d.ellipse(tuple(v*scale for v in (84,68,204,188)), fill=PAPER)
d.ellipse(tuple(v*scale for v in (98,82,190,174)), outline=BG, width=4*scale)
# Quadratic fork bowl sampled from the same SVG curves.
curve = [(42,82),(42,109)]
for i in range(1,21):
    t=i/20; curve.append((42+13*t*t,109+26*t-13*t*t))
for i in range(1,21):
    t=i/20; curve.append((55+26*t-13*t*t,122-13*t*t))
curve.append((68,82))
line(curve,PAPER,8)
line([(55,82),(55,174)],PAPER,8)
line([(119,128),(136,146),(167,110)],ACCENT,11)
for name,size in [("apple-touch-icon-v2.png",180),("icon-v2-192.png",192),("icon-v2-512.png",512)]:
    im.resize((size,size),Image.Resampling.LANCZOS).save(ROOT/name,optimize=True)
print("Generated SVG and opaque 180, 192, 512 pixel app icons.")

"""Lay the reference renders out on one sheet.

    python pack_refsheet.py --src DIR --out tools/omega/reference/omega-reference-sheet.png
"""
import argparse, os
from PIL import Image, ImageDraw, ImageFont

ap = argparse.ArgumentParser()
ap.add_argument("--src", required=True)
ap.add_argument("--out", required=True)
a = ap.parse_args()

W, H = 2400, 2020
BG, INK, SOFT, LINE = (241, 242, 238), (19, 21, 19), (95, 100, 95), (214, 216, 210)
F = lambda n, s: ImageFont.truetype(os.path.join("C:/Windows/Fonts", n), s)
title, h2, body, small, label = F("segoeuib.ttf", 72), F("segoeuib.ttf", 34), F("segoeui.ttf", 28), F("segoeui.ttf", 22), F("segoeuib.ttf", 24)

sheet = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(sheet)


def load(name):
    return Image.open(os.path.join(a.src, name + ".png")).convert("RGBA")


def union_box(names):
    boxes = [load(n).getchannel("A").point(lambda v: 255 if v > 10 else 0).getbbox() for n in names]
    return (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))


def paste_fit(img, box, cell, anchor="center"):
    """Fit `img` inside the (x, y, w, h) cell, keeping its proportions."""
    x, y, w, h = cell
    r = min(w / img.width, h / img.height)
    im = img.resize((max(1, int(img.width * r)), max(1, int(img.height * r))), Image.LANCZOS)
    px = x + (w - im.width) // 2
    py = y + (h - im.height) // 2 if anchor == "center" else y + h - im.height
    sheet.paste(im, (px, py), im)


M = 70
d.text((M, 46), "Omega", font=title, fill=INK)
d.text((M + 330, 74), "Orbit's little robot. Reference sheet, rendered from the 3D model.", font=body, fill=SOFT)
d.line((M, 150, W - M, 150), fill=LINE, width=2)

# ---- turnaround
d.text((M, 172), "Turnaround", font=h2, fill=INK)
views = [("view-front", "Front"), ("view-three-quarter", "Three-quarter"), ("view-side", "Side"), ("view-back", "Back"), ("view-top", "From above")]
vb = union_box([v for v, _ in views if v != "view-top"])
cw, gap = 436, 20
for i, (v, name) in enumerate(views):
    x = M + i * (cw + gap)
    d.rounded_rectangle((x, 226, x + cw, 226 + 430), radius=14, fill=(250, 250, 247), outline=LINE, width=2)
    if v == "view-top":
        full = load(v)
        paste_fit(full.crop(full.getchannel("A").point(lambda q: 255 if q > 10 else 0).getbbox()), None, (x + 12, 240, cw - 24, 372))
    else:
        paste_fit(load(v).crop(vb), None, (x + 12, 240, cw - 24, 372))
    d.text((x + 16, 616), name, font=label, fill=SOFT)

# ---- faces
d.text((M, 696), "Faces", font=h2, fill=INK)
d.text((M + 170, 706), "the eyes are the only part that changes; the shape of the glow shows the mood", font=small, fill=SOFT)
faces = [("neutral", "Neutral"), ("dots", "Content"), ("happy", "Happy"), ("wide", "Wide-eyed"), ("sleepy", "Sleepy"),
         ("determined", "Determined"), ("flat", "Unimpressed"), ("dizzy", "Dizzy"), ("squint", "Squint"), ("battery", "Low battery")]
fb = (50, 90, 390, 430)
for i, (k, name) in enumerate(faces):
    col, row = i % 5, i // 5
    x, y = M + col * (cw + gap), 750 + row * 262
    d.rounded_rectangle((x, y, x + cw, y + 246), radius=14, fill=(250, 250, 247), outline=LINE, width=2)
    im = load(f"face-{k}").crop(fb)
    paste_fit(im, None, (x + 10, y + 8, 228, 228))
    d.text((x + 252, y + 100), name, font=label, fill=INK)

# ---- colours
y0 = 1300
d.text((M, y0), "Colours", font=h2, fill=INK)
sw = [("#F76F1C", "Shell, lit"), ("#D9480A", "Shell, mid"), ("#9C2C05", "Shell, shade"), ("#0C0502", "Shell, deepest"),
      ("#040303", "Visor glass"), ("#A1C3E0", "Eye glow (centre)"), ("#3A1711", "Leg blades"), ("#C04A1C", "Leg joints")]
for i, (hx, name) in enumerate(sw):
    col, row = i % 4, i // 4
    x, y = M + col * 270, y0 + 62 + row * 150
    rgb = tuple(int(hx[j:j + 2], 16) for j in (1, 3, 5))
    d.rounded_rectangle((x, y, x + 250, y + 84), radius=12, fill=rgb, outline=LINE, width=2)
    d.text((x, y + 92), name, font=label, fill=INK)
    d.text((x, y + 120), hx, font=small, fill=SOFT)
d.text((M, y0 + 62 + 2 * 150 - 6), "Shell colours are the model's own; the others are sampled from the renders, so close, not exact.", font=small, fill=SOFT)

# ---- notes
nx = 1240
d.text((nx, y0), "What makes him Omega", font=h2, fill=INK)
notes = [
    "Body: a glossy orange ball. The front is a black glass visor, a rounded shield shape; a small orange cap sits on the top.",
    "Eyes: two small glowing ice-blue shapes on the visor. Nothing else is on the face: no nose, no mouth.",
    "Legs: four thin spider legs, two a side. Each is two segments with ball joints, ending in a long curved dark blade for a foot.",
    "Tail: a long segmented tail from the back, banded orange and near-black, with a dark rounded tip.",
    "Proportions: the ball is the main shape. The legs span about twice its width, the tail about twice its width again.",
    "To keep in a simple icon: orange ball, black visor, two blue eyes, four legs with blade feet, striped tail.",
    "Fine to drop: the panel seams, the glossy reflections, the gears (you never see them).",
]
yy = y0 + 58
import textwrap
for n in notes:
    lines = textwrap.wrap(n, width=62)
    for k, ln in enumerate(lines):
        d.text((nx + (0 if k == 0 else 26), yy), ("\u2022  " if k == 0 else "") + ln, font=body if False else F("segoeui.ttf", 25), fill=INK if k == 0 else INK)
        yy += 33
    yy += 8

os.makedirs(os.path.dirname(a.out), exist_ok=True)
sheet.save(a.out)
print("saved", a.out, sheet.size)

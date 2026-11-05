"""Draws the animated Orbit orb used at the top of the sign-in emails (web/public/email/orbit-hello.gif).
Email cannot run CSS or scripts, so a looping GIF is the way to move in an inbox. Run:  python web/scripts/make-email-art.py
It draws at 4x and shrinks for smooth edges. The background is the card's white, because GIF has no soft transparency."""
import math, os
from PIL import Image, ImageDraw

W, H, S = 240, 132, 4          # final size and the drawing scale
FRAMES, MS = 40, 55            # 40 frames, 55 ms each: a two second loop
BG = (255, 255, 255)
BODY = [(244, 150, 108), (236, 105, 62), (226, 87, 42), (201, 72, 34)]  # highlight to edge
EYE = (252, 250, 247)
SHADOW = (232, 233, 228)

def circle(d, cx, cy, r, fill):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=fill)

def pill(d, cx, cy, w, h, fill):
    r = w / 2
    d.rounded_rectangle([cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2], radius=min(r, h / 2), fill=fill)

def frame(i):
    t = i / FRAMES
    img = Image.new("RGB", (W * S, H * S), BG)
    d = ImageDraw.Draw(img)
    cx = W * S / 2
    ground = (H - 16) * S

    # a gentle hop: up on the first half, down on the second, with a small squash as it lands
    hop = abs(math.sin(t * math.pi * 2)) ** 0.8
    lift = hop * 16 * S
    land = max(0.0, 1 - hop * 5) if hop < 0.2 else 0.0
    sx, sy = 1 + 0.07 * land, 1 - 0.09 * land

    # shadow shrinks as the orb rises
    sw = (34 - hop * 10) * S
    d.ellipse([cx - sw, ground - 5 * S, cx + sw, ground + 5 * S], fill=SHADOW)

    r = 40 * S
    cy = ground - r * sy - lift - 2 * S
    # body: the base colour, then lighter, smaller circles up and to the left give a soft light
    body = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))
    bd = ImageDraw.Draw(body)
    bd.ellipse([cx - r * sx, cy - r * sy, cx + r * sx, cy + r * sy], fill=BODY[2])
    # a soft light: many small steps from the body colour to a warm highlight, drifting up and to the left
    steps = 18
    for n in range(steps):
        f = n / (steps - 1)
        frac = 0.96 - 0.74 * f
        col = tuple(round(BODY[2][c] + (BODY[0][c] - BODY[2][c]) * (f ** 0.9)) for c in range(3))
        rx, ry = r * sx * frac, r * sy * frac
        ox, oy = r * sx * (-0.03 - 0.17 * f), r * sy * (-0.04 - 0.22 * f)
        bd.ellipse([cx + ox - rx, cy + oy - ry, cx + ox + rx, cy + oy + ry], fill=col)
    # clip the light to the body shape and add a darker rim
    mask = Image.new("L", body.size, 0)
    ImageDraw.Draw(mask).ellipse([cx - r * sx, cy - r * sy, cx + r * sx, cy + r * sy], fill=255)
    rim = Image.new("RGBA", body.size, (0, 0, 0, 0))
    rd = ImageDraw.Draw(rim)
    rd.ellipse([cx - r * sx, cy - r * sy, cx + r * sx, cy + r * sy], outline=BODY[3], width=int(2.2 * S))
    img.paste(body, (0, 0), Image.composite(body.split()[3], Image.new("L", body.size, 0), mask))
    img.paste(rim, (0, 0), rim)

    # eyes look left, then right, with a blink in the second half
    look = math.sin(t * math.pi * 2 * 1.0) * 6 * S
    blink = 1.0
    b = (i - 28) % FRAMES
    if 0 <= b < 4:
        blink = [0.55, 0.12, 0.12, 0.6][b]
    ey = cy - 2 * S
    for side in (-1, 1):
        pill(d, cx + side * 15 * S * sx + look, ey, 9 * S, 24 * S * blink * sy, EYE)

    return img.resize((W, H), Image.LANCZOS)

frames = [frame(i) for i in range(FRAMES)]
out = os.path.join(os.path.dirname(__file__), "..", "public", "email")
os.makedirs(out, exist_ok=True)
path = os.path.join(out, "orbit-hello.gif")
pal = frames[0].quantize(colors=64, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
q = [f.quantize(palette=pal, dither=Image.Dither.NONE) for f in frames]
q[0].save(path, save_all=True, append_images=q[1:], duration=MS, loop=0, optimize=True, disposal=1)
print(path, os.path.getsize(path) // 1024, "KB,", len(frames), "frames")

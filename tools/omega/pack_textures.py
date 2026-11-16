"""Pack the texture tiles (from make_textures.py) into what the page loads.   python pack_textures.py --tiles DIR --out web/public/omega

 omega_dif.webp   2048x1024  colour of the shell, doors, legs and tail (the page recolours it orange with a ramp, as the sprites were)
 omega_emi.webp   2048x1024  what glows on the shell
 omega_orm.webp   2048x1024  R = opacity, G = roughness
 omega_eyes1001.webp / omega_eyes1003.webp   1024x1024 RGBA  the glowing eye shapes: the base eyes, and every expression (colour = glow, alpha = shape)

The shell atlas layout must match CELL in export_live.py: tile 1001 on the left half, tiles 1002, 1004 and 1006 in the right half.
"""
import argparse, os
from PIL import Image
Image.MAX_IMAGE_PIXELS = None

ap = argparse.ArgumentParser()
ap.add_argument("--tiles", required=True)
ap.add_argument("--out", required=True)
a = ap.parse_args()
W, H = 2048, 1024
CELL = {1001: (0.0, 0.0, 0.5, 1.0), 1002: (0.5, 0.5, 0.75, 1.0), 1004: (0.75, 0.5, 1.0, 1.0), 1006: (0.5, 0.0, 0.75, 0.5)}  # x0, y0, x1, y1 with V up


def tile(kind, n):
    return Image.open(os.path.join(a.tiles, f"omega_{kind}.{n}.png")).convert("RGB")


def box(c):
    x0, y0, x1, y1 = c
    return int(x0 * W), int((1 - y1) * H), int(x1 * W), int((1 - y0) * H)


def atlas(make, mode="RGB"):
    out = Image.new(mode, (W, H), (0, 0, 0))
    for n, c in CELL.items():
        l, t, r, b = box(c)
        out.paste(make(n).resize((r - l, b - t), Image.LANCZOS), (l, t))
    return out


dif = atlas(lambda n: tile("dif", n))
emi = atlas(lambda n: tile("emi", n))
def orm_tile(n):
    o = tile("opa", n).split()[0].resize((1024, 1024), Image.LANCZOS)  # the maps are not all the same size, so bring them together first
    r = tile("rgh", n).split()[0].resize((1024, 1024), Image.LANCZOS)
    return Image.merge("RGB", (o, r, Image.new("L", (1024, 1024), 0)))


orm = atlas(orm_tile)
os.makedirs(a.out, exist_ok=True)
dif.save(os.path.join(a.out, "omega_dif.webp"), quality=90, method=6)
emi.save(os.path.join(a.out, "omega_emi.webp"), quality=90, method=6)
orm.save(os.path.join(a.out, "omega_orm.webp"), quality=92, method=6)
for n in (1001, 1003):
    rgb = tile("emi", n).resize((1024, 1024), Image.LANCZOS)
    al = tile("opa", n).split()[0].resize((1024, 1024), Image.LANCZOS)
    im = rgb.convert("RGBA")
    im.putalpha(al)
    im.save(os.path.join(a.out, f"omega_eyes{n}.webp"), quality=92, alpha_quality=100, method=6)
for f in sorted(os.listdir(a.out)):
    if f.startswith("omega_") and f.endswith(".webp"):
        print(f, round(os.path.getsize(os.path.join(a.out, f)) / 1024), "KB")

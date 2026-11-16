"""Turn the rendered card pictures into the web files: one shared crop (so Omega is the same size in every card), transparent WebP.

    python pack_cards.py --src DIR --out web/public/cards
"""
import argparse, os, glob
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument("--src", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--quality", type=int, default=88)
a = ap.parse_args()
os.makedirs(a.out, exist_ok=True)
files = sorted(glob.glob(os.path.join(a.src, "*.png")))
imgs = {f: Image.open(f).convert("RGBA") for f in files}
# the box that holds something in any of them, with a little air around it
boxes = [im.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox() for im in imgs.values()]
l, t = min(b[0] for b in boxes), min(b[1] for b in boxes)
r, bt = max(b[2] for b in boxes), max(b[3] for b in boxes)
pad = 14
W, H = next(iter(imgs.values())).size
box = (max(0, l - pad), max(0, t - pad), min(W, r + pad), min(H, bt + pad))
print("crop", box)
for f, im in imgs.items():
    name = os.path.splitext(os.path.basename(f))[0] + ".webp"
    im.crop(box).save(os.path.join(a.out, name), "WEBP", quality=a.quality, method=6)
    print(name, os.path.getsize(os.path.join(a.out, name)) // 1024, "KB", im.crop(box).size)

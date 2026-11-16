"""Pull Omega's texture set out of the .blend (it is packed inside) at web sizes.   blender -b file.blend --python make_textures.py -- out=DIR
The 4096 px maps are far too heavy for a web page: diffuse and emission go to 2048, opacity to 2048 (eye decals need crisp edges), roughness to 1024.
Written as PNG; make_textures.py's caller (or build step) turns them into WebP."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
a = dict(x.split("=", 1) for x in sys.argv[sys.argv.index("--") + 1:] if "=" in x)
OUT = a["out"]
os.makedirs(OUT, exist_ok=True)
WANT = {"dif": 2048, "emi": 2048, "opa": 2048, "rgh": 1024}
for img in bpy.data.images:
    for key, size in WANT.items():
        if f"ch_omega_main_{key}_" in img.name:
            c = img.copy()
            c.scale(size, size)
            c.filepath_raw = os.path.join(OUT, f"omega_{key}.<UDIM>.png")  # a tiled (UDIM) image can only be saved with the marker in the name
            c.file_format = 'PNG'
            c.save()
            print("TEX", key, size, os.listdir(OUT))

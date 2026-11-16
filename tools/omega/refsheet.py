"""Renders for the reference sheet of Omega: turnaround views and face close-ups, transparent, no floor shadow.

    blender -b Omega_Orbit_Onboarding.blend --python refsheet.py -- out=DIR [part=views|faces] [size=700] [samples=64]

pack_refsheet.py lays the renders out on one page.
"""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *  # noqa: F401,F403
import acting
from acting import pose, REST_Z, apply

a = args()
OUT = a["out"]
os.makedirs(OUT, exist_ok=True)
PART = a.get("part", "views")
SIZE = int(a.get("size", "700"))
SAMPLES = int(a.get("samples", "64"))

G = prep()
render_settings(SIZE, SAMPLES)
sc.render.resolution_x = sc.render.resolution_y = SIZE
G["flr"].hide_render = True  # a clean cut-out: no shadow


def camera(cx, cy, cz, scale, az, el):
    cam, tg = G["cam"], G["tg"]
    azr, elr = d2r(az), d2r(el)
    tg.location = (cx, cy, cz)
    cam.location = (cx + math.sin(azr) * math.cos(elr) * 4, cy - math.cos(azr) * math.cos(elr) * 4, cz + math.sin(elr) * 4)
    cam.data.ortho_scale = scale
    cam.data.shift_y = 0
    cam.data.clip_end = 30
    # the key light turns with the camera, so every view is lit the same way
    k = d2r(az)
    D["OB_Key"].location = (cx + math.sin(k - 0.6) * 1.6, cy - math.cos(k - 0.6) * 1.6, 2.6)
    D["OB_Rim"].location = (cx + math.sin(k + 2.4) * 1.8, cy - math.cos(k + 2.4) * 1.8, 1.8)


def omega(p):
    for rig in (om, ex):
        rig.animation_data_clear()
    for n in BODY_BONES:
        pb = om.pose.bones[n]
        pb.location = (0, 0, 0)
        pb.rotation_euler = (0, 0, 0)
    apply(G, 1, p, None)
    sc.frame_set(1)
    bpy.context.view_layer.update()


def render(name):
    sc.render.filepath = os.path.join(OUT, name + ".png")
    bpy.ops.render.render(write_still=True)
    print("REF", name, flush=True)


if PART == "views":
    omega(pose(bz=REST_Z, expr={"neutral": 1.0}))
    # (name, azimuth, elevation): 0 is the front (the way he looks at you)
    for name, az, el in (("front", 0, 14), ("three-quarter", 38, 18), ("side", 90, 12), ("back", 180, 16), ("top", 0, 78)):
        camera(0.0, 0.2, 0.26, 1.75, az, el)
        render("view-" + name)
else:
    faces = [("neutral", {"neutral": 1.0}), ("dots", {"dots": 1.0}), ("happy", {"happy": 1.0}), ("wide", {"wide": 1.0}), ("sleepy", {"sleepy": 1.0}),
             ("determined", {"determined": 1.0}), ("flat", {"flat": 1.0}), ("dizzy", {"dizzy": 1.0}), ("squint", {"squint": 1.0}), ("battery", {"battery": 1.0})]
    for name, ex_ in faces:
        omega(pose(bz=REST_Z, expr=ex_))
        camera(0.0, 0.0, 0.225, 0.58, 0, 8)
        render("face-" + name)
print("REFS done")

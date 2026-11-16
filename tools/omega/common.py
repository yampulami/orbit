"""Shared setup for rendering Omega sprite clips from Omega_Orbit_Onboarding.blend (run inside Blender: blender -b file.blend --python script.py -- args).

This is the look and camera setup of the original sprite pipeline (Desktop/sprites_v3.py), kept identical so new clips sit beside the old ones:
orthographic camera, 20 degree elevation, transparent film, no baked shadow (the page draws the shadow), punchier colours.
"""
import bpy, math, json, os, sys
import numpy as np

D = bpy.data.objects
sc = bpy.context.scene
om = D["RIG - Omega"]
ex = D["RIG - Omega_Expression"]
d2r = math.radians
FLOOR_Z = 0.078
TAIL = [f"Tail0{j}" for j in range(1, 7)]
FEET = {"FL": ("Front", "L"), "FR": ("Front", "R"), "BL": ("Back", "L"), "BR": ("Back", "R")}
BODY_BONES = ["root", "Rotation", "Squash_Top", "Squash_Bottom"] + [f"{a}_Spider_Leg03_ik.{b}" for a in ("Front", "Back") for b in "LR"] + TAIL


REC = {"expr": [], "gaze": []}  # per frame, for the clip being built: which eye layers show and where they look (written beside the glb)


def args():
    """Arguments after `--` on the command line, as a dict of key=value."""
    a = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    return dict(x.split("=", 1) for x in a if "=" in x)


def ss(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def Rz(a):
    return np.array([[math.cos(a), -math.sin(a)], [math.sin(a), math.cos(a)]])


def prep():
    """Freeze the scene the way the sprite pipeline did, measure the rest pose, and return the helpers the clip builders need."""
    sc.frame_set(60)
    for rig in (om, ex):
        if rig.animation_data:
            rig.animation_data.action = None
    st = bpy.data.collections["Orbit_Stage"]
    flr = D["OB_Floor"]
    for c in list(flr.users_collection):
        c.objects.unlink(flr)
    sc.collection.objects.link(flr)
    st.hide_render = True
    st.hide_viewport = True
    flr.hide_render = True  # no baked shadow: the page draws it
    dm = max(flr.dimensions.x, flr.dimensions.y)
    if dm < 14:
        flr.scale = (flr.scale[0] * 14 / dm, flr.scale[1] * 14 / dm, flr.scale[2])
    for m in bpy.data.materials:
        if not m.use_nodes:
            continue
        for n in m.node_tree.nodes:
            if n.type == 'VALTORGB' and len(n.color_ramp.elements) == 4:
                cols = [(0x0C, 0x05, 0x02), (0x9C, 0x2C, 0x05), (0xD9, 0x48, 0x0A), (0xF7, 0x6F, 0x1C)]
                for e, c in zip(n.color_ramp.elements, cols):
                    lin = [(v / 255) ** 2.2 for v in c]
                    e.color = (lin[0], lin[1], lin[2], 1)
    sc.view_settings.view_transform = 'AgX'
    try:
        sc.view_settings.look = 'AgX - Punchy'
    except Exception as e:  # noqa: BLE001
        print("look", e)
    sc.view_settings.exposure = -0.35
    cam, tg = D["OB_Cam"], D["OB_Target"]
    for o in (cam, tg, D["OB_Key"], D["OB_Rim"], flr):
        if o.animation_data:
            o.animation_data_clear()
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = 1.4
    base = {n: np.array(D[n].location) for n in ("OB_Key", "OB_Rim")}
    for rig in (om, ex):
        rig.animation_data_clear()
    for n in BODY_BONES:
        pb = om.pose.bones[n]
        pb.location = (0, 0, 0)
        pb.rotation_mode = 'XYZ'
        pb.rotation_euler = (0, 0, 0)
    bpy.context.view_layer.update()
    rest = {n: np.array(om.matrix_world @ om.pose.bones[f"DEF-{fb}_Spider_Leg03.{s}"].tail) for n, (fb, s) in FEET.items()}
    M = {"L": np.array([[0.0, 0.16, 0.99], [-1.0, 0.0, 0.0], [0.0, -0.99, 0.16]]), "R": np.array([[0.0, -0.16, -0.99], [1.0, 0.0, 0.0], [0.0, -0.99, 0.16]])}
    Minv = {s: np.linalg.inv(M[s]) for s in M}
    jit = {"FL": np.array([0.012, -0.012]), "FR": np.array([-0.008, 0.012]), "BL": np.array([-0.014, -0.008]), "BR": np.array([0.010, 0.016])}
    home = {n: rest[n][:2] + jit[n] for n in FEET}
    return {"cam": cam, "tg": tg, "flr": flr, "base": base, "rest": rest, "Minv": Minv, "home": home}


def key(pb, path, idx, f, group):
    pb.keyframe_insert(path, index=idx, frame=f, group=group)


def key_camera(G, f, bxy, dx=0.0):
    """The camera, target, floor and lights follow Omega, exactly as in the original pipeline, so the sprite always has the same framing.
    `dx` slides the view sideways (world units) toward the side his tail points, so a long tail is never cut off by the edge of the frame;
    the page puts him back in the middle using the same number (stored as `cdx` in clip.json)."""
    G["cam"].location = bxy + np.array([dx, -3.0, 1.3])
    G["tg"].location = bxy + np.array([dx, 0, 0.22])
    G["flr"].location = (bxy[0], bxy[1], G["flr"].location.z)
    D["OB_Key"].location = G["base"]["OB_Key"] + bxy
    D["OB_Rim"].location = G["base"]["OB_Rim"] + bxy
    for o in (G["cam"], G["tg"], G["flr"], D["OB_Key"], D["OB_Rim"]):
        o.keyframe_insert("location", frame=f)


def set_linear():
    for rig in (om, ex):
        if not rig.animation_data or not rig.animation_data.action:
            continue
        for l in rig.animation_data.action.layers:
            for stp in l.strips:
                for cb_ in stp.channelbags:
                    for fc in cb_.fcurves:
                        for kp in fc.keyframe_points:
                            kp.interpolation = 'LINEAR'


def render_settings(size, samples):
    sc.render.resolution_x = sc.render.resolution_y = size
    sc.render.resolution_percentage = 100
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    sc.render.use_persistent_data = True
    sc.render.film_transparent = True
    sc.render.image_settings.media_type = 'IMAGE'
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    sc.render.use_overwrite = False
    sc.render.use_placeholder = True

"""Pictures for the setup cards: Omega in a little scene that says what the card says (a dorm and a backpack, a car, a house and moving boxes, a map and a pin).

    blender -b Omega_Orbit_Onboarding.blend --python cards.py -- out=DIR [scene=res,com,off,oth] [size=1100] [samples=96]

Each is the real model, posed with the same helpers as the clips, with props built from plain shapes in a few matte colours that sit with Omega's orange. Rendered
with a transparent background and a soft contact shadow, so a card can put it on any surface, light or dark.
"""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *  # noqa: F401,F403
import acting
from acting import pose, REST_Z, feet_rest, apply
import bmesh
from mathutils import Vector

a = args()
OUT = a["out"]
os.makedirs(OUT, exist_ok=True)
SIZE = int(a.get("size", "1100"))
SAMPLES = int(a.get("samples", "96"))
WANT = a.get("scene", "res,com,off,oth").split(",")

G = prep()
render_settings(SIZE, SAMPLES)
sc.render.resolution_x = SIZE
sc.render.resolution_y = int(SIZE * 0.66)
sc.render.filepath = OUT

# palette (sRGB hex). Matte, warm, a little desaturated, so Omega's orange is the loudest thing in the picture.
CREAM, SAND, SLATE, CHAR, ORANGE, DEEP, WARM, SKY, LEAF, PAPER = "#ece6dc", "#d9cdb8", "#46525e", "#1f242a", "#e0612a", "#b8431f", "#ffd68a", "#9db8c9", "#9ccf9a", "#f1ebdc"


def lin(h):
    h = h.lstrip("#")
    return tuple(((int(h[i:i + 2], 16) / 255) ** 2.2) for i in (0, 2, 4))


def mat(name, hexcol, rough=0.7, emit=None, alpha=None, metal=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    n = m.node_tree.nodes
    n.clear()
    out = n.new("ShaderNodeOutputMaterial")
    b = n.new("ShaderNodeBsdfPrincipled")
    b.inputs["Base Color"].default_value = (*lin(hexcol), 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if emit:
        b.inputs["Emission Color"].default_value = (*lin(emit), 1)
        b.inputs["Emission Strength"].default_value = 2.5
    if alpha is not None:
        b.inputs["Alpha"].default_value = alpha
    m.node_tree.links.new(b.outputs["BSDF"], out.inputs["Surface"])
    return m


made = []


def box(name, size, loc, m, bevel=0.012, rot=(0, 0, 0)):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    sc.collection.objects.link(ob)
    ob.scale = size
    ob.location = loc
    ob.rotation_euler = rot
    ob.data.materials.append(m)
    if bevel:
        md = ob.modifiers.new("bev", 'BEVEL')
        md.width = bevel / max(min(size), 0.05)  # the scale is applied to the bevel as well, so divide it out
        md.width = bevel
        md.segments = 3
        md.limit_method = 'ANGLE'
    made.append(ob)
    return ob


def prim(kind, name, loc, m, scale=(1, 1, 1), rot=(0, 0, 0), **kw):
    bm = bmesh.new()
    if kind == "sphere":
        bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=20, radius=1.0)
    elif kind == "cyl":
        bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=kw.get("seg", 32), radius1=1.0, radius2=1.0, depth=2.0)
    elif kind == "cone":
        bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=kw.get("seg", 32), radius1=1.0, radius2=kw.get("r2", 0.0), depth=2.0)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    sc.collection.objects.link(ob)
    ob.scale = scale
    ob.location = loc
    ob.rotation_euler = rot
    ob.data.materials.append(m)
    made.append(ob)
    return ob


def prism(name, hw, hd, h, loc, m):
    """A gable roof: a triangle in the width-and-height plane, running the depth of the house. (A scaled cone, rotated, came out as a skewed diamond.)"""
    bm = bmesh.new()
    v = [bm.verts.new(c) for c in ((-hw, -hd, 0), (hw, -hd, 0), (hw, hd, 0), (-hw, hd, 0), (0, -hd, h), (0, hd, h))]
    for f in ((0, 1, 2, 3), (0, 4, 5, 3), (1, 2, 5, 4), (0, 1, 4), (3, 5, 2)):
        bm.faces.new([v[i] for i in f])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    sc.collection.objects.link(ob)
    ob.location = loc
    ob.data.materials.append(m)
    md = ob.modifiers.new("bev", 'BEVEL')
    md.width = 0.008
    md.segments = 2
    made.append(ob)
    return ob


def clear():
    for ob in made:
        bpy.data.objects.remove(ob, do_unlink=True)
    made.clear()


def camera(cx, cy, cz, scale, az=24.0, el=22.0):
    cam, tg = G["cam"], G["tg"]
    az, el = d2r(az), d2r(el)
    tg.location = (cx, cy, cz)
    cam.location = (cx + math.sin(az) * math.cos(el) * 4, cy - math.cos(az) * math.cos(el) * 4, cz + math.sin(el) * 4)
    cam.data.ortho_scale = scale
    cam.data.shift_y = -0.02
    cam.data.clip_end = 30
    # the key light high and close to overhead, so shadows are short and sit under things instead of smearing across the floor
    D["OB_Key"].location = (cx - 0.7, cy - 0.9, 3.4)
    D["OB_Rim"].location = (cx + 1.4, cy + 1.3, 1.8)
    flr = G["flr"]
    flr.location = (cx, cy, 0.0)
    flr.hide_render = False
    flr.is_shadow_catcher = True


def omega(p):
    """Pose Omega on frame 1 and make it the current frame."""
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
    print("CARD", name, flush=True)


# ---------------------------------------------------------------------------------------------------------------- scenes
def scene_res():
    """On campus: a residence hall behind him, a backpack at his side, a wave."""
    m_wall, m_roof, m_door = mat("c_wall", CREAM, 0.85), mat("c_roof", SLATE, 0.6), mat("c_door", CHAR, 0.6)
    m_win = mat("c_win", WARM, 0.4, emit=WARM)
    box("hall", (0.62, 0.4, 0.82), (-0.58, 0.62, 0.41), m_wall)
    box("hall_roof", (0.68, 0.46, 0.05), (-0.58, 0.62, 0.845), m_roof)
    for r, z in enumerate((0.64, 0.42)):
        for c, x in enumerate((-0.74, -0.58, -0.42)):
            lit = (r + c) % 2 == 0
            box(f"w{r}{c}", (0.085, 0.012, 0.11), (x, 0.62 - 0.206, z), m_win if lit else mat("c_win_off", SKY, 0.3), bevel=0.004)
    box("hall_door", (0.12, 0.014, 0.2), (-0.58, 0.62 - 0.206, 0.1), m_door, bevel=0.005)
    m_bag, m_pocket = mat("c_bag", ORANGE, 0.75), mat("c_pocket", DEEP, 0.75)
    box("bag", (0.2, 0.12, 0.25), (0.62, -0.05, 0.125), m_bag, bevel=0.045)
    box("bag_pocket", (0.15, 0.05, 0.1), (0.62, -0.115, 0.07), m_pocket, bevel=0.02)
    box("bag_flap", (0.2, 0.125, 0.05), (0.62, -0.05, 0.255), m_pocket, bevel=0.02)
    camera(0.0, 0.25, 0.42, 2.35)
    omega(acting.wave(26, 56))
    render("home-residence")


def scene_com():
    """I commute: Omega riding in a small open car."""
    m_body, m_dark, m_stripe = mat("c_car", SLATE, 0.45), mat("c_cardark", CHAR, 0.6), mat("c_stripe", ORANGE, 0.5)
    m_tyre, m_light, m_seat = mat("c_tyre", CHAR, 0.8), mat("c_light", WARM, 0.3, emit=WARM), mat("c_seat", "#5b4a43", 0.8)
    box("car_floor", (1.2, 0.58, 0.14), (0.0, 0.0, 0.17), m_body, bevel=0.04)
    box("car_wall_near", (1.2, 0.045, 0.13), (0.0, -0.268, 0.3), m_body, bevel=0.03)
    box("car_wall_far", (1.2, 0.045, 0.13), (0.0, 0.268, 0.3), m_body, bevel=0.03)
    box("car_stripe", (1.205, 0.05, 0.03), (0.0, -0.272, 0.3), m_stripe, bevel=0.008)
    box("car_dash", (0.07, 0.5, 0.2), (0.54, 0.0, 0.33), m_body, bevel=0.03)
    box("car_seatback", (0.08, 0.5, 0.3), (-0.5, 0.0, 0.4), m_seat, bevel=0.035)
    box("car_light_a", (0.03, 0.12, 0.07), (0.615, -0.17, 0.2), m_light, bevel=0.01)
    box("car_light_b", (0.03, 0.12, 0.07), (0.615, 0.17, 0.2), m_light, bevel=0.01)
    for x in (-0.4, 0.4):
        for y in (-0.3, 0.3):
            prim("cyl", f"wheel{x}{y}", (x, y, 0.11), m_tyre, scale=(0.12, 0.12, 0.04), rot=(math.pi / 2, 0, 0))
    camera(0.0, 0.0, 0.4, 2.35, az=18)
    # Omega sits in the car: lifted onto its floor, his feet on it
    lift = 0.245
    feet = {n: (0.0, 0.0, lift, 0.0) for n in FEET}
    omega(pose(bz=REST_Z + lift, feet=feet, tail=acting.tail_wave(20, 0.08, 14), expr={"happy": 0.9}, gaze=(0.0, 0.1)))
    render("home-commute")


def scene_off():
    """Off campus, with roommates: a house, and moving boxes."""
    m_wall, m_roof, m_door = mat("c_hwall", SAND, 0.85), mat("c_hroof", DEEP, 0.7), mat("c_hdoor", SLATE, 0.6)
    m_win = mat("c_win", WARM, 0.4, emit=WARM)
    box("house", (0.66, 0.44, 0.44), (-0.56, 0.6, 0.22), m_wall)
    prism("roof", 0.4, 0.27, 0.2, (-0.56, 0.6, 0.44), m_roof)
    box("h_door", (0.1, 0.014, 0.2), (-0.56, 0.6 - 0.226, 0.1), m_door, bevel=0.005)
    box("h_win_l", (0.1, 0.012, 0.1), (-0.76, 0.6 - 0.226, 0.26), m_win, bevel=0.004)
    box("h_win_r", (0.1, 0.012, 0.1), (-0.36, 0.6 - 0.226, 0.26), m_win, bevel=0.004)
    m_box, m_tape = mat("c_box", "#c99a63", 0.85), mat("c_tape", "#e6c690", 0.7)
    box("box1", (0.24, 0.22, 0.2), (0.6, -0.04, 0.1), m_box, bevel=0.012)
    box("box1_tape", (0.05, 0.225, 0.205), (0.6, -0.04, 0.1), m_tape, bevel=0.004)
    box("box2", (0.17, 0.16, 0.15), (0.58, -0.04, 0.275), m_box, bevel=0.012, rot=(0, 0, 0.18))
    box("box3", (0.2, 0.18, 0.15), (0.78, 0.18, 0.075), m_box, bevel=0.012, rot=(0, 0, -0.2))
    camera(0.05, 0.2, 0.42, 2.35)
    omega(acting.smile(20, 52))
    render("home-offcampus")


def scene_oth():
    """Somewhere else: a map with a pin in it."""
    m_map, m_fold = mat("c_map", PAPER, 0.9), mat("c_fold", "#d9d1bd", 0.9)
    m_road, m_park, m_river = mat("c_road", "#e8a36f", 0.8), mat("c_park", LEAF, 0.9), mat("c_river", SKY, 0.5)
    box("map", (1.5, 1.0, 0.03), (0.0, 0.1, 0.015), m_map, bevel=0.008)
    for x in (-0.25, 0.25):
        box(f"fold{x}", (0.006, 1.0, 0.032), (x, 0.1, 0.016), m_fold, bevel=0.0)
    box("park", (0.34, 0.26, 0.034), (-0.5, 0.36, 0.017), m_park, bevel=0.01)
    box("river", (1.5, 0.1, 0.033), (0.0, -0.2, 0.0165), m_river, bevel=0.0, rot=(0, 0, 0.08))
    box("road1", (1.5, 0.05, 0.034), (0.0, 0.2, 0.017), m_road, bevel=0.0)
    box("road2", (0.05, 1.0, 0.034), (0.47, 0.1, 0.017), m_road, bevel=0.0)
    m_pin = mat("c_pin", ORANGE, 0.4)
    prim("cone", "pin_tip", (0.47, 0.2, 0.17), m_pin, scale=(0.06, 0.06, 0.14), rot=(math.pi, 0, 0))
    prim("sphere", "pin_head", (0.47, 0.2, 0.36), m_pin, scale=(0.11, 0.11, 0.11))
    prim("sphere", "pin_dot", (0.47, 0.2 - 0.075, 0.38), mat("c_pin_dot", CREAM, 0.5), scale=(0.04, 0.025, 0.04))
    camera(0.12, 0.15, 0.34, 2.45, az=20)
    # he stands on the map, looking at the pin
    feet = {n: (0.0, 0.0, 0.03, 0.0) for n in FEET}
    omega(pose(bz=REST_Z + 0.03, feet=feet, tail=acting.tail_wave(24, 0.08, 14), expr={"happy": 0.5}, gaze=(0.9, 0.35), yaw=-18))
    render("home-other")


SCENES = {"res": scene_res, "com": scene_com, "off": scene_off, "oth": scene_oth}
for key_ in WANT:
    SCENES[key_.strip()]()
    clear()
print("CARDS done")

"""Export the live Omega: omega.glb (meshes, skeleton, every clip as an animation) and omega_clips.json (per clip: length, loop, ground speed, face over time).

    blender -b Omega_Orbit_Onboarding.blend --python export_live.py -- out=DIR [clips=idle,walk,...]

Only what shows from outside is exported (the gears and other interiors, 41k triangles that are never seen, are left out). Materials are not exported: the page
builds them from the packed textures (make_textures.py / pack_textures.py), so the texture coordinates are remapped here to match that atlas.
"""
import os, sys, json, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *  # noqa: F401,F403
import live

a = args()
OUT = a["out"]
os.makedirs(OUT, exist_ok=True)
names = a["clips"].split(",") if a.get("clips") else live.names()
G = prep()

KEEP = {"Ball Body", "Doors", "Base Eyes", "Tail", "Legs", "Anger", "Exhausted Left", "Exhausted Right", "Happiness", "X . X", "Low Battery", "> <",
        "Sadness Left", "Sadness Right", "Satisfaction", "Unphased"}  # (not "Interiors": with the doors shut it is never seen)
objs = [o for o in bpy.data.objects if o.type == 'MESH' and any(c.name in KEEP for c in o.users_collection)]
# The doors that close the openings in the shell hang off bones that only the rig uses (ORG-...), which a deform-bones-only export drops, taking the doors with
# them and leaving holes in the head and sides. They stay shut in every clip, so they ride on the ball bone instead, where they are now.
# (Reparenting keeps each part where it is now, so the body has to be at rest when it is done, or they would be fixed to the ball with an offset.)
for rig in (om, ex):  # the body rig and the expression rig (whose eye bones the gaze moves) both at rest
    for pb in rig.pose.bones:
        pb.location = (0, 0, 0); pb.rotation_euler = (0, 0, 0); pb.rotation_quaternion = (1, 0, 0, 0); pb.scale = (1, 1, 1)
bpy.context.view_layer.update()
# The eyes (the base eyes and every expression's shapes) hang off the separate expression rig, which is not exported either: without this they stay where
# they were while the head jumps. They ride on the ball bone too; the page moves them for the gaze.
for o in objs:
    if o.parent_type == 'BONE' and o.parent_bone.startswith("ORG-"):
        world = o.matrix_world.copy()
        o.parent = om
        o.parent_type = 'BONE'
        o.parent_bone = "DEF-Ball"
        o.matrix_parent_inverse.identity()
        o.matrix_world = world
        print("EXPORT rode", o.name, "now on DEF-Ball")
# The inside of the body (gears and the like) shows through the openings in the shell. Kept, but thinned to a fifth of the triangles: from outside nobody can
# tell, and the page gives them one plain dark material (their names start with INT_).
for o in objs:
    if o.users_collection[0].name == "Interiors":
        o.name = "INT_" + o.name
        if len(o.data.polygons) > 400:
            m = o.modifiers.new("thin", 'DECIMATE')
            m.ratio = 0.2
        print("EXPORT interior", o.name, len(o.data.polygons), "parent", o.parent_type, o.parent_bone if o.parent_type == 'BONE' else "")

# ---- texture coordinates: the model uses UDIM tiles 1001..1006; the page uses one atlas for the shell (tiles 1001, 1002, 1004, 1006) and one small
# picture for each set of glowing eye shapes (1001's base eyes, 1003's expressions), which keep their own tile-relative coordinates.
CELL = {1001: (0.0, 0.0, 0.5, 1.0), 1002: (0.5, 0.5, 0.75, 1.0), 1004: (0.75, 0.5, 1.0, 1.0), 1006: (0.5, 0.0, 0.75, 0.5)}
done = set()
tile_of = {}
for o in objs:
    me = o.data
    if me.name in done or not me.uv_layers:
        continue
    done.add(me.name)
    is_eye = o.users_collection[0].name == "Base Eyes" or o.name.startswith("EXP_")
    uv = me.uv_layers.active.data
    for p in me.polygons:
        cu = sum(uv[l].uv[0] for l in p.loop_indices) / p.loop_total
        cv = sum(uv[l].uv[1] for l in p.loop_indices) / p.loop_total
        tu, tv = int(cu // 1), int(cv // 1)
        tile = 1001 + tu + 10 * tv
        tile_of[o.name] = tile
        for l in p.loop_indices:
            u, v = uv[l].uv[0] - tu, uv[l].uv[1] - tv
            if is_eye:
                uv[l].uv = (u, v)
            elif tile not in CELL:
                uv[l].uv = (0.0, 0.0)  # the interior parts have no texture on the page
            else:
                x0, y0, x1, y1 = CELL[tile]
                uv[l].uv = (x0 + u * (x1 - x0), y0 + v * (y1 - y0))
print("EXPORT tiles", dict(collections.Counter(tile_of.values())))

# ---- clips: one action each, then one NLA track each, so each exports as its own animation
meta = {}
actions = {}
for name in names:
    meta[name] = live.build(G, name)
    act = om.animation_data.action
    act.name = name
    act.use_fake_user = True
    actions[name] = act
    om.animation_data.action = None
    print("EXPORT clip", name, meta[name]["frames"], "frames", flush=True)
om.animation_data_create()
for name, act in actions.items():
    tr = om.animation_data.nla_tracks.new()
    tr.name = name
    st = tr.strips.new(name, 1, act)
    st.name = name
for rig in (ex,):
    if rig.animation_data:
        rig.animation_data_clear()
for n in BODY_BONES:
    pb = om.pose.bones[n]
    pb.location = (0, 0, 0)
    pb.rotation_euler = (0, 0, 0)

bpy.ops.object.select_all(action='DESELECT')
for o in objs:
    o.select_set(True)
om.select_set(True)
bpy.context.view_layer.objects.active = om
sc.render.fps = 24
glb = os.path.join(OUT, "omega.glb")
res = bpy.ops.export_scene.gltf(
    filepath=glb, export_format='GLB', use_selection=True, export_apply=True,
    export_skins=True, export_animations=True, export_animation_mode='NLA_TRACKS', export_force_sampling=True, export_optimize_animation_size=True,
    export_yup=True, export_materials='NONE', export_texcoords=True, export_normals=True, export_cameras=False, export_lights=False,
    export_extras=False, export_gn_mesh=False, export_def_bones=bool(int(a.get("defbones", "0"))),
)
json.dump({"fps": 24, "clips": meta}, open(os.path.join(OUT, "omega_clips.json"), "w"), separators=(",", ":"))
print("EXPORT result", res, "glb MB", round(os.path.getsize(glb) / 1e6, 2), "clips", len(meta))

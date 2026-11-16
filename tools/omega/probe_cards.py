"""Print the numbers the card scenes need: where the ball is, where the ground is, what lights and camera there are."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *  # noqa: F401,F403
from mathutils import Vector

G = prep()
bpy.context.view_layer.update()
body = D["Body_geo"]
bb = [body.matrix_world @ Vector(v) for v in body.bound_box]
mn = Vector((min(v.x for v in bb), min(v.y for v in bb), min(v.z for v in bb)))
mx = Vector((max(v.x for v in bb), max(v.y for v in bb), max(v.z for v in bb)))
print("PROBE body", [round(x, 3) for x in mn], [round(x, 3) for x in mx], "centre", [round((a + b) / 2, 3) for a, b in zip(mn, mx)])
print("PROBE feet", {k: [round(float(x), 3) for x in v] for k, v in G["rest"].items()})
print("PROBE rig", [round(x, 3) for x in om.matrix_world.translation], "FLOOR_Z", FLOOR_Z)
for n in ("OB_Cam", "OB_Target", "OB_Key", "OB_Rim", "OB_Floor"):
    o = D[n]
    print("PROBE", n, o.type, [round(x, 3) for x in o.location], getattr(o.data, "energy", None))
print("PROBE engine", sc.render.engine, "world", sc.world.name if sc.world else None)
tail = D.get("Tail_geo")
if tail:
    tb = [tail.matrix_world @ Vector(v) for v in tail.bound_box]
    print("PROBE tail y range", round(min(v.y for v in tb), 3), round(max(v.y for v in tb), 3), "z", round(min(v.z for v in tb), 3), round(max(v.z for v in tb), 3))

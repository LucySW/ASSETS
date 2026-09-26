"""Robô mascote fofo (branco, visor preto, olhos e detalhes azuis brilhantes).

Uso:
  - Blender MCP: cole o conteúdo deste arquivo na ferramenta `execute_blender_code`.
  - Blender GUI: aba Scripting > Open > Run Script.
  - Linha de comando: blender -b -P blender/cute_robot.py -- --render out/robot
    (ou `python blender/cute_robot.py --render out/robot` com o módulo `bpy`).
"""

import math
import sys

import bpy
from mathutils import Vector

COLLECTION_NAME = "CuteRobot"

# Proporções principais (Z para cima, frente do robô olhando para -Y)
HEAD_CENTER = Vector((0.0, 0.0, 2.1))
HEAD_DIMS = (1.5, 1.2, 1.15)
HEAD_BEVEL = 0.35
BODY_CENTER = Vector((0.0, 0.0, 0.8))
BODY_RADIUS = 0.75
BODY_SCALE_Z = 0.9
BODY_DARK_BELOW_Z = 0.52


# ---------------------------------------------------------------- materiais

def principled(name, color, roughness=0.3, coat=0.0, emission=None, strength=0.0):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Coat Weight"].default_value = coat
    bsdf.inputs["Coat Roughness"].default_value = 0.05
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
        bsdf.inputs["Emission Strength"].default_value = strength
    return mat


def make_materials():
    return {
        "white": principled("Robot_White", (0.86, 0.87, 0.9), roughness=0.22, coat=0.6),
        "black": principled("Robot_Black", (0.01, 0.01, 0.012), roughness=0.15, coat=1.0),
        "visor": principled("Robot_Visor", (0.003, 0.004, 0.006), roughness=0.08, coat=1.0),
        "glow_cyan": principled("Robot_GlowCyan", (0.05, 0.55, 1.0), emission=(0.05, 0.55, 1.0), strength=4.0),
        "glow_blue": principled("Robot_GlowBlue", (0.1, 0.4, 1.0), emission=(0.02, 0.25, 1.0), strength=5.0),
        "blue": principled("Robot_Blue", (0.015, 0.06, 0.55), roughness=0.18, coat=1.0),
        "logo": principled("Robot_Logo", (0.01, 0.1, 0.75), roughness=0.25, coat=0.8),
    }


# ---------------------------------------------------------------- utilidades

def get_collection():
    col = bpy.data.collections.get(COLLECTION_NAME)
    if col:
        for obj in list(col.objects):
            bpy.data.objects.remove(obj, do_unlink=True)
    else:
        col = bpy.data.collections.new(COLLECTION_NAME)
        bpy.context.scene.collection.children.link(col)
    return col


def link(obj, col, mat=None, smooth=True):
    for c in obj.users_collection:
        c.objects.unlink(obj)
    col.objects.link(obj)
    if mat is not None and obj.type in {"MESH", "CURVE"}:
        obj.data.materials.clear()
        obj.data.materials.append(mat)
    if smooth and obj.type == "MESH":
        for p in obj.data.polygons:
            p.use_smooth = True
    return obj


def rounded_box(name, dims, bevel, location, col, mat):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    mod = obj.modifiers.new("Bevel", "BEVEL")
    mod.width = bevel
    mod.segments = 12
    mod.limit_method = "NONE"
    return link(obj, col, mat)


def uv_sphere(name, radius, location, scale, col, mat, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=32, radius=radius,
                                         location=location, rotation=rotation)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    return link(obj, col, mat)


def cylinder(name, radius, depth, location, rotation, col, mat, vertices=64):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth,
                                        location=location, rotation=rotation)
    obj = bpy.context.active_object
    obj.name = name
    mod = obj.modifiers.new("Bevel", "BEVEL")
    mod.width = min(radius, depth) * 0.3
    mod.segments = 4
    obj.data.polygons.foreach_set("use_smooth", [True] * len(obj.data.polygons))
    obj.data.update()
    return link(obj, col, mat, smooth=False)


def tube_curve(name, points, radius, col, mat, cyclic=False):
    """Tubo arredondado passando pelos pontos (em coordenadas do mundo)."""
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.bevel_depth = radius
    curve.bevel_resolution = 6
    curve.use_fill_caps = True
    spline = curve.splines.new("NURBS")
    spline.points.add(len(points) - 1)
    for p, co in zip(spline.points, points):
        p.co = (*co, 1.0)
    spline.use_endpoint_u = not cyclic
    spline.use_cyclic_u = cyclic
    spline.order_u = 3
    spline.resolution_u = 16
    obj = bpy.data.objects.new(name, curve)
    col.objects.link(obj)
    curve.materials.append(mat)
    return obj


def arc_points(center, radius, start_deg, end_deg, count=9):
    cx, cy, cz = center
    pts = []
    for i in range(count):
        a = math.radians(start_deg + (end_deg - start_deg) * i / (count - 1))
        pts.append((cx + radius * math.cos(a), cy, cz + radius * math.sin(a)))
    return pts


def body_front_y(x, z):
    """Posição Y da superfície frontal do corpo (elipsoide) em (x, z)."""
    rz = BODY_RADIUS * BODY_SCALE_Z
    t = 1.0 - (x / BODY_RADIUS) ** 2 - ((z - BODY_CENTER.z) / rz) ** 2
    return -BODY_RADIUS * math.sqrt(max(t, 0.0))


# ---------------------------------------------------------------- partes

def build_head(col, m):
    head = rounded_box("Head", HEAD_DIMS, HEAD_BEVEL, HEAD_CENTER, col, m["white"])
    # Visor: uma cópia menor da forma da cabeça empurrada para frente
    visor = rounded_box("Visor", (1.34, 1.2, 0.98), 0.26,
                        HEAD_CENTER + Vector((0, -0.035, -0.02)), col, m["visor"])

    face_y = -HEAD_DIMS[1] / 2 - 0.035 - 0.012
    eye_z = HEAD_CENTER.z + 0.04
    for side in (-1, 1):
        tube_curve(f"Eye_{'L' if side < 0 else 'R'}",
                   arc_points((side * 0.25, face_y, eye_z), 0.11, 20, 160), 0.028,
                   col, m["glow_cyan"])
    tube_curve("Mouth", arc_points((0, face_y, HEAD_CENTER.z - 0.14), 0.07, 200, 340, 7),
               0.024, col, m["glow_cyan"])

    # "Fones de ouvido" laterais
    for side in (-1, 1):
        s = "L" if side < 0 else "R"
        x = side * HEAD_DIMS[0] / 2
        cylinder(f"Ear_{s}", 0.29, 0.14, (x + side * 0.02, 0, HEAD_CENTER.z),
                 (0, math.pi / 2, 0), col, m["white"])
        cylinder(f"EarCap_{s}", 0.2, 0.08, (x + side * 0.1, 0, HEAD_CENTER.z),
                 (0, math.pi / 2, 0), col, m["blue"])
        bpy.ops.mesh.primitive_torus_add(major_radius=0.22, minor_radius=0.03,
                                         major_segments=64, minor_segments=16,
                                         location=(x + side * 0.1, 0, HEAD_CENTER.z),
                                         rotation=(0, math.pi / 2, 0))
        ring = bpy.context.active_object
        ring.name = f"EarRing_{s}"
        link(ring, col, m["glow_blue"])
    return head


def build_body(col, m):
    cylinder("Neck", 0.32, 0.22, (0, 0, 1.5), (0, 0, 0), col, m["black"])

    body = uv_sphere("Body", BODY_RADIUS, BODY_CENTER, (1, 1, BODY_SCALE_Z), col, m["white"])
    body.data.materials.append(m["black"])
    # Faixa inferior preta: faces abaixo de certa altura usam o material 1
    for poly in body.data.polygons:
        world_z = BODY_CENTER.z + poly.center.z * BODY_SCALE_Z
        poly.material_index = 1 if world_z < BODY_DARK_BELOW_Z else 0

    # Base luminosa
    cylinder("GlowBase", 0.38, 0.06, (0, 0, BODY_CENTER.z - BODY_RADIUS * BODY_SCALE_Z + 0.06),
             (0, 0, 0), col, m["glow_blue"])
    build_logo(col, m)
    return body


def build_logo(col, m):
    """Dois elos entrelaçados na diagonal, curvados sobre o peito."""
    cx, cz = 0.0, 0.98
    half_len, r = 0.1, 0.06
    ang = math.radians(40)
    ca, sa = math.cos(ang), math.sin(ang)
    tmp_objs = []
    for i, offset in enumerate((-0.075, 0.075)):
        pts = []
        for a in range(0, 360, 15):
            t = math.radians(a)
            px = math.copysign(half_len, math.cos(t)) + r * math.cos(t)
            pz = r * math.sin(t)
            pts.append((cx + offset + px * ca - pz * sa, 0.0, cz + px * sa + pz * ca))
        tmp_objs.append(tube_curve(f"Logo_{i}", pts, 0.024, col, m["logo"], cyclic=True))

    # Converte para malha e "cola" na superfície do corpo
    depsgraph = bpy.context.evaluated_depsgraph_get()
    for obj in tmp_objs:
        mesh = bpy.data.meshes.new_from_object(obj.evaluated_get(depsgraph))
        for v in mesh.vertices:
            v.co.y = v.co.y * 0.5 + body_front_y(v.co.x, v.co.z) - 0.004
        new = bpy.data.objects.new(obj.name, mesh)
        col.objects.link(new)
        bpy.data.objects.remove(obj, do_unlink=True)
        new.data.materials.clear()
        new.data.materials.append(m["logo"])


def build_arms(col, m):
    for side in (-1, 1):
        s = "L" if side < 0 else "R"
        uv_sphere(f"Shoulder_{s}", 0.15, (side * 0.68, 0.0, 1.12), (1, 1, 1), col, m["black"])
        uv_sphere(f"Arm_{s}", 1.0, (side * 0.82, -0.02, 0.88), (0.16, 0.16, 0.28), col, m["white"],
                  rotation=(math.radians(8), -side * math.radians(15), 0))
        uv_sphere(f"Hand_{s}", 1.0, (side * 0.9, -0.05, 0.6), (0.12, 0.11, 0.14), col, m["black"],
                  rotation=(0, -side * math.radians(15), 0))


def build_robot():
    col = get_collection()
    m = make_materials()
    build_head(col, m)
    build_body(col, m)
    build_arms(col, m)

    # Agrupa tudo sob um Empty para mover/girar o robô inteiro
    root = bpy.data.objects.new("CuteRobot_Root", None)
    col.objects.link(root)
    for obj in col.objects:
        if obj is not root:
            obj.parent = root
    return root


# ---------------------------------------------------------------- cena/render

def setup_scene():
    scene = bpy.context.scene
    for name in ("Cube", "Light", "Camera"):  # objetos da cena padrão
        if name in bpy.data.objects:
            bpy.data.objects.remove(bpy.data.objects[name], do_unlink=True)
    world = scene.world or bpy.data.worlds.new("World")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = (0.16, 0.16, 0.17, 1.0)
    bg.inputs["Strength"].default_value = 0.6

    col = bpy.data.collections.get(COLLECTION_NAME)

    def area(name, loc, energy, size, color=(1, 1, 1)):
        light = bpy.data.lights.new(name, "AREA")
        light.energy = energy
        light.size = size
        light.color = color
        obj = bpy.data.objects.new(name, light)
        obj.location = loc
        con = obj.constraints.new("TRACK_TO")
        con.target = bpy.data.objects["CuteRobot_Root"]
        col.objects.link(obj)

    area("Key", (-3.5, -4.5, 5.0), 900, 3.0)
    area("Fill", (4.0, -3.5, 2.5), 350, 4.0, (0.85, 0.9, 1.0))
    area("Rim", (0.0, 4.5, 4.0), 600, 3.0, (0.7, 0.8, 1.0))

    cam_data = bpy.data.cameras.new("Camera")
    cam_data.lens = 70
    cam = bpy.data.objects.new("Camera", cam_data)
    col.objects.link(cam)
    target = bpy.data.objects.new("CamTarget", None)
    target.location = (0, 0, 1.3)
    col.objects.link(target)
    con = cam.constraints.new("TRACK_TO")
    con.target = target
    scene.camera = cam

    scene.render.engine = "CYCLES"
    scene.cycles.samples = 96
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 900
    scene.render.resolution_y = 900
    scene.view_settings.view_transform = "AgX"
    return cam


def render_views(prefix):
    cam = setup_scene()
    views = {
        "front": (0.0, -9.0, 2.0),
        "three_quarter": (3.6, -8.2, 2.6),
        "side": (9.0, -0.6, 2.0),
        "back": (0.0, 9.0, 2.2),
    }
    for name, loc in views.items():
        cam.location = loc
        bpy.context.scene.render.filepath = f"{prefix}_{name}.png"
        bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    build_robot()
    if "--render" in argv:
        render_views(argv[argv.index("--render") + 1])

"""Robô mascote: cabeça branca arredondada, visor preto com rosto azul
luminoso, fones laterais azuis, corpo branco com base preta, logo azul no
peito, braços com mãos pretas e base com brilho azul.

Uso:
  - Blender MCP (blend-ai / blender-mcp): cole este arquivo em `execute_blender_code`.
  - Blender GUI: aba Scripting > Open > Run Script.
  - Linha de comando:
      blender -b -P blender/cute_robot.py -- --render blender/renders/robot --save blender/robot.blend
"""

import math
import sys

import bpy  # noqa: I001 - bpy precisa vir antes de bmesh fora do Blender
import bmesh
from mathutils import Vector

COLLECTION_NAME = "CuteRobot"

# ---------------------------------------------------------------- proporções
# Z para cima, frente do robô virada para -Y, base do corpo em Z = 0.

HEAD_C = Vector((0.0, 0.0, 1.98))
HEAD_A, HEAD_B, HEAD_H = 1.07, 0.80, 0.87   # meia largura, meia profundidade, meia altura
HEAD_N = 3.6                                # expoente do superelipsoide (maior = mais quadrado)

VISOR_C_Z = 1.95
VISOR_HW, VISOR_HH, VISOR_R = 0.78, 0.64, 0.44
VISOR_PROTRUDE = 0.015
VISOR_BULGE = 0.045

# Perfil (raio, altura) do corpo, girado em torno de Z
BODY_PROFILE = [
    (0.0, 0.03), (0.324, 0.035), (0.508, 0.10), (0.648, 0.24), (0.745, 0.42),
    (0.794, 0.62), (0.805, 0.82), (0.756, 1.00), (0.648, 1.13), (0.432, 1.22), (0.0, 1.25),
]
BODY_DEPTH = 0.9          # achatamento frente/trás do corpo
BODY_SPLIT_Z = 0.435      # divisão entre parte branca e parte preta


# ---------------------------------------------------------------- materiais

def principled(name, color, roughness=0.3, coat=0.0, emission=None, strength=0.0,
               coat_roughness=0.03, specular=0.5):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Coat Weight"].default_value = coat
    bsdf.inputs["Coat Roughness"].default_value = coat_roughness
    bsdf.inputs["Specular IOR Level"].default_value = specular
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
        bsdf.inputs["Emission Strength"].default_value = strength
    return mat


def make_materials():
    return {
        "white": principled("Robot_White", (0.80, 0.82, 0.86), roughness=0.28, coat=1.0),
        "black": principled("Robot_Black", (0.01, 0.01, 0.013), roughness=0.28, coat=1.0),
        "visor": principled("Robot_Visor", (0.003, 0.004, 0.006), roughness=0.3, coat=0.8,
                            coat_roughness=0.04, specular=0.3),
        "face": principled("Robot_FaceGlow", (0.1, 0.6, 1.0), emission=(0.08, 0.55, 1.0),
                           strength=7.0),
        "ring": principled("Robot_RingGlow", (0.05, 0.35, 1.0), emission=(0.03, 0.3, 1.0),
                           strength=9.0),
        "base_glow": principled("Robot_BaseGlow", (0.2, 0.7, 1.0), emission=(0.15, 0.65, 1.0),
                                strength=10.0),
        "ear_blue": principled("Robot_EarBlue", (0.008, 0.04, 0.45), roughness=0.2, coat=1.0),
        "logo": principled("Robot_Logo", (0.01, 0.12, 0.7), roughness=0.3, coat=1.0),
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


def mesh_object(name, bm, col, mat, smooth=True):
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    if smooth:
        mesh.polygons.foreach_set("use_smooth", [True] * len(mesh.polygons))
    mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    col.objects.link(obj)
    return obj


def primitive(kind, name, col, mat, location, rotation=(0, 0, 0), scale=(1, 1, 1), **kw):
    getattr(bpy.ops.mesh, f"primitive_{kind}_add")(location=location, rotation=rotation, **kw)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    for c in obj.users_collection:
        c.objects.unlink(obj)
    col.objects.link(obj)
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    obj.data.polygons.foreach_set("use_smooth", [True] * len(obj.data.polygons))
    obj.data.update()
    return obj


def sphere(name, col, mat, location, scale, rotation=(0, 0, 0)):
    return primitive("uv_sphere", name, col, mat, location, rotation, scale,
                     segments=64, ring_count=32, radius=1.0)


def disc(name, col, mat, location, rotation, radius, depth, bevel=0.3):
    obj = primitive("cylinder", name, col, mat, location, rotation,
                    vertices=96, radius=radius, depth=depth)
    mod = obj.modifiers.new("Bevel", "BEVEL")
    mod.width = min(radius, depth) * bevel
    mod.segments = 6
    mod.harden_normals = True
    return obj


def smoothstep(t):
    t = min(max(t, 0.0), 1.0)
    return t * t * (3 - 2 * t)


def catmull_rom(points, samples=12):
    pts = [points[0]] + list(points) + [points[-1]]
    out = []
    for i in range(1, len(pts) - 2):
        p0, p1, p2, p3 = (Vector(p) for p in pts[i - 1:i + 3])
        for s in range(samples):
            t = s / samples
            out.append(tuple(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
                                    + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3)))
    out.append(tuple(points[-1]))
    return out


# ---------------------------------------------------------------- superfícies

def head_taper(z):
    """Escala em X da cabeça conforme a altura (um pouco mais estreita embaixo)."""
    t = (z - (HEAD_C.z - HEAD_H)) / (2 * HEAD_H)
    return 0.93 + 0.07 * math.sin(min(max(t, 0.0), 1.0) * math.pi / 2)


def head_front_y(x, z):
    xe = x / head_taper(z)
    v = 1 - abs(xe / HEAD_A) ** HEAD_N - abs((z - HEAD_C.z) / HEAD_H) ** HEAD_N
    return -HEAD_B * max(v, 0.0) ** (1 / HEAD_N)


def rrect_sdf(x, z, hw, hh, r):
    qx, qz = abs(x) - (hw - r), abs(z) - (hh - r)
    outside = math.hypot(max(qx, 0), max(qz, 0))
    return outside + min(max(qx, qz), 0) - r


def visor_front_y(x, z):
    sdf = rrect_sdf(x, z - VISOR_C_Z, VISOR_HW, VISOR_HH, VISOR_R)
    bulge = VISOR_BULGE * smoothstep(-sdf / 0.5)
    return head_front_y(x, z) - VISOR_PROTRUDE - bulge


_BODY_DENSE = catmull_rom(BODY_PROFILE, 16)


def body_radius(z):
    pts = _BODY_DENSE
    for (r0, z0), (r1, z1) in zip(pts, pts[1:]):
        if z0 <= z <= z1 and z1 > z0:
            return r0 + (r1 - r0) * (z - z0) / (z1 - z0)
    return 0.0


def body_front_y(x, z):
    return -BODY_DEPTH * math.sqrt(max(body_radius(z) ** 2 - x * x, 0.0))


# ---------------------------------------------------------------- geradores

def superellipsoid(name, col, mat, res=48):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=2.0)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=res, use_grid_fill=True)
    for v in bm.verts:
        d = v.co
        s = (abs(d.x / HEAD_A) ** HEAD_N + abs(d.y / HEAD_B) ** HEAD_N
             + abs(d.z / HEAD_H) ** HEAD_N) ** (-1 / HEAD_N)
        p = d * s
        z = p.z + HEAD_C.z
        v.co = Vector((p.x * head_taper(z), p.y, z))
    return mesh_object(name, bm, col, mat)


def lathe(name, profile, col, mat, segments=128, depth=BODY_DEPTH):
    bm = bmesh.new()
    rings = []
    for r, z in profile:
        if r < 1e-5:
            rings.append([bm.verts.new((0, 0, z))])
        else:
            rings.append([bm.verts.new((r * math.cos(a), depth * r * math.sin(a), z))
                          for a in (2 * math.pi * i / segments for i in range(segments))])
    for ra, rb in zip(rings, rings[1:]):
        if len(ra) == 1 and len(rb) == 1:
            continue
        for i in range(segments):
            j = (i + 1) % segments
            if len(ra) == 1:
                bm.faces.new((ra[0], rb[i], rb[j]))
            elif len(rb) == 1:
                bm.faces.new((ra[i], rb[0], ra[j]))
            else:
                bm.faces.new((ra[i], rb[i], rb[j], ra[j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return mesh_object(name, bm, col, mat)


def rrect_outline(hw, hh, r, per_arc=16, per_side=10):
    pts = []
    corners = [(hw - r, hh - r, 0), (-(hw - r), hh - r, 90),
               (-(hw - r), -(hh - r), 180), (hw - r, -(hh - r), 270)]
    for k, (cx, cz, a0) in enumerate(corners):
        for i in range(per_arc + 1):
            a = math.radians(a0 + 90 * i / per_arc)
            pts.append((cx + r * math.cos(a), cz + r * math.sin(a)))
        nx, nz, na = corners[(k + 1) % 4]
        end = pts[-1]
        start = (nx + r * math.cos(math.radians(na)), nz + r * math.sin(math.radians(na)))
        for i in range(1, per_side):
            t = i / per_side
            pts.append((end[0] + (start[0] - end[0]) * t, end[1] + (start[1] - end[1]) * t))
    return pts


def _face_outward(bm):
    """Garante que as faces de uma superfície frontal apontem para -Y."""
    bm.normal_update()
    for f in bm.faces:
        if f.normal.y > 0:
            f.normal_flip()


def visor(name, col, mat, rings=24):
    outline = rrect_outline(VISOR_HW, VISOR_HH, VISOR_R)
    bm = bmesh.new()

    def vert(x, z):
        return bm.verts.new((x, visor_front_y(x, z), z))

    center = vert(0.0, VISOR_C_Z)
    prev = None
    for k in range(1, rings + 1):
        s = (k / rings) ** 0.7
        ring = [vert(px * s, VISOR_C_Z + pz * s) for px, pz in outline]
        n = len(ring)
        for i in range(n):
            j = (i + 1) % n
            if prev is None:
                bm.faces.new((center, ring[j], ring[i]))
            else:
                bm.faces.new((prev[i], prev[j], ring[j], ring[i]))
        prev = ring
    _face_outward(bm)
    obj = mesh_object(name, bm, col, mat)
    mod = obj.modifiers.new("Thickness", "SOLIDIFY")
    mod.thickness = 0.06
    mod.offset = -1.0
    mod.use_even_offset = True
    bev = obj.modifiers.new("Bevel", "BEVEL")
    bev.width = 0.008
    bev.segments = 3
    return obj


def resample(path, cyclic, max_step=0.012):
    """Subdivide trechos longos para o traço acompanhar a curvatura da superfície."""
    out = []
    segs = len(path) if cyclic else len(path) - 1
    for i in range(segs):
        a, b = path[i], path[(i + 1) % len(path)]
        steps = max(1, math.ceil(math.dist(a, b) / max_step))
        out.extend((a[0] + (b[0] - a[0]) * k / steps, a[1] + (b[1] - a[1]) * k / steps)
                   for k in range(steps))
    if not cyclic:
        out.append(path[-1])
    return out


def stroke(name, path, width, surface, col, mat, cyclic=False, lift=0.004,
           thickness=0.0, cap_segments=10):
    """Traço chato (com pontas arredondadas) sobre uma superfície frontal.

    path: lista de pontos (x, z); surface(x, z) -> y da superfície.
    """
    path = resample(path, cyclic)
    bm = bmesh.new()

    def vert(x, z):
        return bm.verts.new((x, surface(x, z) - lift, z))

    n = len(path)
    lefts, rights = [], []
    for i, (x, z) in enumerate(path):
        a = path[(i - 1) % n] if (cyclic or i > 0) else path[i]
        b = path[(i + 1) % n] if (cyclic or i < n - 1) else path[i]
        t = Vector((b[0] - a[0], b[1] - a[1])).normalized()
        nrm = Vector((-t.y, t.x)) * (width / 2)
        lefts.append(vert(x + nrm.x, z + nrm.y))
        rights.append(vert(x - nrm.x, z - nrm.y))
    segs = n if cyclic else n - 1
    for i in range(segs):
        j = (i + 1) % n
        bm.faces.new((lefts[i], lefts[j], rights[j], rights[i]))
    if not cyclic:
        for idx in (0, n - 1):
            x, z = path[idx]
            nb = path[idx + 1] if idx == 0 else path[idx - 1]
            fwd = Vector((x - nb[0], z - nb[1])).normalized()
            c = vert(x, z)
            # Semicírculo de uma borda do traço à outra, passando pela ponta
            p_from = Vector((lefts[idx].co.x - x, lefts[idx].co.z - z))
            cap = [lefts[idx]]
            for k in range(1, cap_segments):
                a = math.pi * k / cap_segments
                d = p_from * math.cos(a) + fwd * (width / 2) * math.sin(a)
                cap.append(vert(x + d.x, z + d.y))
            cap.append(rights[idx])
            for k in range(cap_segments):
                bm.faces.new((c, cap[k], cap[k + 1]))
    _face_outward(bm)
    obj = mesh_object(name, bm, col, mat)
    if thickness:
        mod = obj.modifiers.new("Thickness", "SOLIDIFY")
        mod.thickness = thickness
        mod.offset = -1.0
    return obj


def arc(cx, cz, r, a0, a1, count=40):
    return [(cx + r * math.cos(math.radians(a0 + (a1 - a0) * i / (count - 1))),
             cz + r * math.sin(math.radians(a0 + (a1 - a0) * i / (count - 1))))
            for i in range(count)]


def diamond(cx, cz, half_side, corner, per_corner=16):
    """Quadrado de cantos arredondados girado 45 graus (losango)."""
    c = half_side - corner
    pts = []
    for k, (sx, sz) in enumerate(((1, 1), (-1, 1), (-1, -1), (1, -1))):
        for i in range(per_corner + 1):
            a = math.radians(90 * k + 90 * i / per_corner)
            x, z = sx * c + corner * math.cos(a), sz * c + corner * math.sin(a)
            pts.append((cx + (x - z) / math.sqrt(2), cz + (x + z) / math.sqrt(2)))
    return pts


def stadium(cx, cz, half_len, r, angle_deg, count=96):
    ang = math.radians(angle_deg)
    ca, sa = math.cos(ang), math.sin(ang)
    pts = []
    for i in range(count):
        t = 2 * math.pi * i / count
        px = math.copysign(half_len, math.cos(t)) + r * math.cos(t)
        pz = r * math.sin(t)
        pts.append((cx + px * ca - pz * sa, cz + px * sa + pz * ca))
    return pts


# ---------------------------------------------------------------- partes

def build_head(col, m):
    superellipsoid("Head", col, m["white"])
    visor("Visor", col, m["visor"])

    for side, tag in ((-1, "L"), (1, "R")):
        stroke(f"Eye_{tag}", arc(side * 0.42, 1.87, 0.235, 18, 162), 0.085,
               visor_front_y, col, m["face"])
    stroke("Mouth", arc(0.0, 1.84, 0.13, 205, 335), 0.07, visor_front_y, col, m["face"])

    x_edge = HEAD_A * head_taper(HEAD_C.z)
    rot = (0, math.pi / 2, 0)
    for side, tag in ((-1, "L"), (1, "R")):
        disc(f"Ear_Base_{tag}", col, m["white"], (side * (x_edge - 0.05), 0, HEAD_C.z), rot,
             0.34, 0.25, bevel=0.35)
        disc(f"Ear_Cap_{tag}", col, m["ear_blue"], (side * (x_edge + 0.12), 0, HEAD_C.z), rot,
             0.37, 0.14, bevel=0.45)
        primitive("torus", f"Ear_Ring_{tag}", col, m["ring"],
                  (side * (x_edge + 0.19), 0, HEAD_C.z), rot,
                  major_radius=0.33, minor_radius=0.035, major_segments=96, minor_segments=16)
        disc(f"Ear_Center_{tag}", col, m["ear_blue"], (side * (x_edge + 0.19), 0, HEAD_C.z), rot,
             0.25, 0.05, bevel=0.5)


def build_body(col, m):
    disc("Neck", col, m["black"], (0, 0, 1.13), (0, 0, 0), 0.5, 0.2)

    split, groove = BODY_SPLIT_Z, 0.012
    r_split = body_radius(split)
    z_hi, z_lo = split + groove + 0.01, split - groove - 0.01
    white = [(r_split - 0.035, split + groove), (body_radius(z_hi), z_hi)] + \
        [(r, z) for r, z in _BODY_DENSE if z > z_hi + 0.005]
    black = [(r, z) for r, z in _BODY_DENSE if z < z_lo - 0.005] + \
        [(body_radius(z_lo), z_lo), (r_split - 0.035, split - groove), (0.0, split - groove)]
    lathe("Body_White", white, col, m["white"])
    lathe("Body_Black", black, col, m["black"])
    lathe("Body_Groove", [(0.0, split - 0.03), (r_split - 0.03, split - 0.03),
                          (r_split - 0.03, split + 0.03), (0.0, split + 0.03)],
          col, m["black"])

    disc("Base_Glow", col, m["base_glow"], (0, 0, 0.03), (0, 0, 0), 0.40, 0.06, bevel=0.4)

    # Logo: dois losangos arredondados entrelaçados
    for i, (dx, lift) in enumerate(((-0.115, 0.003), (0.115, 0.005))):
        stroke(f"Logo_{i}", diamond(dx, 0.76, 0.14, 0.055), 0.07, body_front_y, col,
               m["logo"], cyclic=True, lift=lift)


def build_arms(col, m):
    for side, tag in ((-1, "L"), (1, "R")):
        sphere(f"Shoulder_{tag}", col, m["black"], (side * 0.77, 0.0, 1.06), (0.15, 0.15, 0.15))
        disc(f"Arm_{tag}", col, m["white"], (side * 0.99, -0.03, 0.73),
             (math.radians(8), -side * math.radians(30), 0), 0.17, 0.52, bevel=0.6)
        sphere(f"Hand_{tag}", col, m["black"], (side * 1.11, -0.06, 0.41), (0.15, 0.15, 0.16),
               rotation=(0, -side * math.radians(30), 0))


def build_robot():
    col = get_collection()
    m = make_materials()
    build_head(col, m)
    build_body(col, m)
    build_arms(col, m)
    root = bpy.data.objects.new("CuteRobot_Root", None)
    col.objects.link(root)
    for obj in col.objects:
        if obj is not root:
            obj.parent = root
    return root


# ---------------------------------------------------------------- cena/render

def setup_scene():
    scene = bpy.context.scene
    for name in ("Cube", "Light", "Camera"):
        if name in bpy.data.objects:
            bpy.data.objects.remove(bpy.data.objects[name], do_unlink=True)
    col = bpy.data.collections[COLLECTION_NAME]

    # Mundo: cinza liso para a câmera, luz de estúdio suave para os reflexos
    world = scene.world or bpy.data.worlds.new("World")
    scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    mix = nt.nodes.new("ShaderNodeMixShader")
    lp = nt.nodes.new("ShaderNodeLightPath")
    bg_cam = nt.nodes.new("ShaderNodeBackground")
    bg_cam.inputs["Color"].default_value = (0.105, 0.108, 0.115, 1)
    bg_env = nt.nodes.new("ShaderNodeBackground")
    bg_env.inputs["Color"].default_value = (0.35, 0.36, 0.38, 1)
    bg_env.inputs["Strength"].default_value = 0.8
    nt.links.new(lp.outputs["Is Camera Ray"], mix.inputs[0])
    nt.links.new(bg_env.outputs[0], mix.inputs[1])
    nt.links.new(bg_cam.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs["Surface"])

    target = bpy.data.objects.new("LookAt", None)
    target.location = (0, 0, 1.47)
    col.objects.link(target)

    def area(name, loc, energy, size, color=(1, 1, 1)):
        light = bpy.data.lights.new(name, "AREA")
        light.energy, light.size, light.color = energy, size, color
        obj = bpy.data.objects.new(name, light)
        obj.location = loc
        obj.constraints.new("TRACK_TO").target = target
        col.objects.link(obj)

    area("Key", (-1.5, -4.5, 7.0), 1500, 3.5)
    area("Fill_L", (-6.0, -3.0, 2.0), 400, 4.0, (0.9, 0.95, 1.0))
    area("Fill_R", (6.0, -3.0, 2.0), 400, 4.0, (0.9, 0.95, 1.0))
    area("Rim", (0.0, 5.0, 5.0), 700, 4.0, (0.8, 0.88, 1.0))

    cam_data = bpy.data.cameras.new("Camera")
    cam_data.lens = 128
    cam = bpy.data.objects.new("Camera", cam_data)
    col.objects.link(cam)
    cam.constraints.new("TRACK_TO").target = target
    scene.camera = cam

    scene.render.engine = "CYCLES"
    scene.cycles.samples = 128
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1340
    scene.render.resolution_y = 1208
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
    setup_bloom(scene)
    return cam


def setup_bloom(scene):
    try:
        ng = bpy.data.node_groups.new("RobotComp", "CompositorNodeTree")
        ng.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
        rl = ng.nodes.new("CompositorNodeRLayers")
        glare = ng.nodes.new("CompositorNodeGlare")
        glare.inputs["Type"].default_value = "Bloom"
        glare.inputs["Threshold"].default_value = 4.0
        glare.inputs["Strength"].default_value = 0.5
        glare.inputs["Size"].default_value = 0.6
        out = ng.nodes.new("NodeGroupOutput")
        ng.links.new(rl.outputs["Image"], glare.inputs["Image"])
        ng.links.new(glare.outputs["Image"], out.inputs[0])
        scene.compositing_node_group = ng
    except (AttributeError, KeyError, TypeError, RuntimeError) as exc:  # versões antigas
        print("Bloom não configurado:", exc)


def render_views(prefix):
    cam = setup_scene()
    views = {
        "front": (0.0, -14.0, 2.3),
        "three_quarter": (6.5, -12.4, 2.8),
        "side": (14.0, -0.8, 2.3),
        "back": (0.0, 14.0, 2.6),
    }
    for name, loc in views.items():
        cam.location = loc
        bpy.context.scene.render.filepath = f"{prefix}_{name}.png"
        bpy.ops.render.render(write_still=True)
    cam.location = views["front"]


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    build_robot()
    if "--render" in argv:
        render_views(argv[argv.index("--render") + 1])
    elif "--save" in argv:
        setup_scene()
    if "--save" in argv:
        bpy.ops.wm.save_as_mainfile(filepath=bpy.path.abspath(argv[argv.index("--save") + 1]))

"""Separa o robô do .glb (uma malha única) em peças independentes.

Cada face recebe uma peça conforme a posição e a cor da textura; depois os
rótulos são suavizados, a malha é cortada, os buracos dos cortes são tapados
e cada peça ganha pivô e hierarquia prontos para posar/animar:

  Robot (Empty)
  ├── Body_White ── Body_Black, Base_Glow, Neck
  ├── Head ──────── Visor (com olhos/boca da textura), Ear_L, Ear_R
  ├── Shoulder_L ── Arm_L ── Hand_L
  └── Shoulder_R ── Arm_R ── Hand_R

Olhos, boca e logo são pintura na textura (sem geometria própria), por isso
ficam no Visor e no Body_White.

Uso:
  - Blender MCP: rode antes o import_robot_glb.py e depois cole este arquivo
    em `execute_blender_code`.
  - Linha de comando (importa, separa e salva):
      blender -b -P blender/separate_robot_parts.py -- blender/models/robot_ai.glb \
          --save blender/robot_parts.blend --render blender/renders/parts
"""

import math
import os
import sys
from collections import Counter

import bpy  # noqa: I001 - bpy precisa vir antes de bmesh fora do Blender
import bmesh
from mathutils import Matrix, Vector

SOURCE_COLLECTION = "RobotGLB"
SMOOTH_ITERATIONS = 3


# ---------------------------------------------------------------- rótulos

def color_class(r, g, b):
    """Classe da cor (sRGB) da textura numa face."""
    if b > 0.9 and g > 0.43 and b - r > 0.2:
        return "glow"
    if max(r, g, b) < 0.3:
        return "dark"
    if b > 0.45 and b - max(r, g) > 0.3:
        return "darkblue"
    return "white"


def part_for(p, c):
    """Peça de uma face a partir do centro p (mundo; frente = -Y) e da cor c.

    Os limites valem para o robô com 2.9 de altura, apoiado em Z = 0.
    """
    x, y, z = p
    ax = abs(x)
    side = "L" if x > 0 else "R"   # convenção do Blender: .L fica em +X
    if z >= 1.37:
        if ax > 0.86 and (y - 0.1) ** 2 + (z - 2.02) ** 2 < 0.47 ** 2 and (c != "white" or ax > 0.97):
            return f"Ear_{side}"
        if y < -0.45 and 1.45 < z < 2.8 and ax < 0.85 and c != "white":
            return "Visor"
        return "Head"
    if z >= 1.29:
        return "Neck"
    if ax > 0.73 or (ax > 0.58 and z > 0.85 and c == "dark"):
        if c in ("dark", "darkblue"):
            return f"Shoulder_{side}" if z > 0.75 else f"Hand_{side}"
        return f"Arm_{side}"
    if z < 0.2 or (c == "glow" and z < 0.35):
        return "Base_Glow"
    if c in ("dark", "darkblue") and z < 0.65:
        return "Body_Black"
    return "Body_White"


def texture_sampler(mat):
    img = next((n.image for n in mat.node_tree.nodes if n.type == "TEX_IMAGE" and n.image), None)
    if img is None:
        return lambda uv: (1.0, 1.0, 1.0)
    w, h = img.size
    px = img.pixels[:]

    def sample(uv):
        x = int((uv.x % 1.0) * w) % w
        y = int((uv.y % 1.0) * h) % h
        i = (y * w + x) * 4
        return px[i], px[i + 1], px[i + 2]
    return sample


def smooth_labels(bm, labels, iterations):
    """Troca o rótulo de faces isoladas pelo da maioria dos vizinhos."""
    for _ in range(iterations):
        new = dict(labels)
        for f in bm.faces:
            neigh = [labels[o.index] for e in f.edges for o in e.link_faces if o is not f]
            if not neigh:
                continue
            best, count = Counter(neigh).most_common(1)[0]
            if best != labels[f.index] and count >= 2:
                new[f.index] = best
        labels = new
    return labels


# ---------------------------------------------------------------- corte

def extract(bm_src, face_ids, name, mat, cap_mat, col):
    bm = bm_src.copy()
    keep = set(face_ids)
    drop = [f for i, f in enumerate(bm.faces) if i not in keep]
    bmesh.ops.delete(bm, geom=drop, context="FACES")
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    boundary = [e for e in bm.edges if e.is_boundary]
    if boundary:
        # Tampa os cortes com plástico preto liso (vira o "encaixe" da peça)
        filled = bmesh.ops.holes_fill(bm, edges=boundary, sides=0)["faces"]
        caps = bmesh.ops.triangulate(bm, faces=filled, quad_method="BEAUTY",
                                     ngon_method="BEAUTY")["faces"]
        for f in bm.faces:
            f.smooth = True
        for f in caps:
            f.material_index = 1
            f.smooth = False
    else:
        for f in bm.faces:
            f.smooth = True
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(mat)
    mesh.materials.append(cap_mat)
    obj = bpy.data.objects.new(name, mesh)
    col.objects.link(obj)
    return obj


_PIVOTS = {}


def set_pivot(obj, pivot, parent=None):
    """Move a origem do objeto para `pivot` (mundo) e aplica o parentesco."""
    obj.data.transform(Matrix.Translation(-pivot))
    obj.parent = parent
    obj.location = pivot - (_PIVOTS.get(parent.name, Vector()) if parent else Vector())
    _PIVOTS[obj.name] = pivot.copy()


def centroid(obj, where=lambda co: True):
    pts = [v.co for v in obj.data.vertices if where(v.co)]
    return sum(pts, Vector()) / len(pts)


def separate():
    bpy.context.view_layer.update()   # garante matrix_world atualizada após o import
    col = bpy.data.collections[SOURCE_COLLECTION]
    src = next(o for o in col.objects if o.type == "MESH")
    mat = src.data.materials[0]

    bm = bmesh.new()
    bm.from_mesh(src.data)
    bm.transform(src.matrix_world)
    # o glTF duplica vértices nas costuras de UV; junta para ter vizinhança
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=1e-5)
    bm.faces.ensure_lookup_table()

    sample = texture_sampler(mat)
    uv_layer = bm.loops.layers.uv.active
    labels = {}
    bm.faces.index_update()
    for f in bm.faces:
        uv = sum((lp[uv_layer].uv for lp in f.loops), Vector((0, 0))) / len(f.loops)
        labels[f.index] = part_for(f.calc_center_median(), color_class(*sample(uv)))
    labels = smooth_labels(bm, labels, SMOOTH_ITERATIONS)

    groups = {}
    for idx, name in labels.items():
        groups.setdefault(name, []).append(idx)
    cap_mat = bpy.data.materials.get("Robot_Joint") or bpy.data.materials.new("Robot_Joint")
    cap_mat.use_nodes = True
    cap_bsdf = cap_mat.node_tree.nodes["Principled BSDF"]
    cap_bsdf.inputs["Base Color"].default_value = (0.012, 0.012, 0.015, 1)
    cap_bsdf.inputs["Roughness"].default_value = 0.45
    parts = {name: extract(bm, ids, name, mat, cap_mat, col)
             for name, ids in sorted(groups.items())}
    bm.free()

    # Remove o objeto original e os Empties do import
    old_roots = {o for o in col.objects if o.type == "EMPTY" and o.name != "LookAt"}
    bpy.data.objects.remove(src, do_unlink=True)
    for o in old_roots:
        bpy.data.objects.remove(o, do_unlink=True)

    root = bpy.data.objects.new("Robot", None)
    col.objects.link(root)
    bpy.context.view_layer.update()

    body = parts["Body_White"]
    set_pivot(body, Vector((0, 0, 0.7)), root)
    for name in ("Body_Black", "Base_Glow", "Neck"):
        if name in parts:
            set_pivot(parts[name], Vector((0, 0, 0.7)), body)
    head = parts["Head"]
    set_pivot(head, Vector((0, 0, 1.33)), root)
    for name in ("Visor", "Ear_L", "Ear_R"):
        if name in parts:
            set_pivot(parts[name], centroid(parts[name]), head)
    for side in ("L", "R"):
        shoulder = parts.get(f"Shoulder_{side}")
        arm = parts.get(f"Arm_{side}")
        hand = parts.get(f"Hand_{side}")
        joint = centroid(shoulder) if shoulder else centroid(arm)
        if shoulder:
            set_pivot(shoulder, joint, root)
        if arm:
            set_pivot(arm, joint, shoulder or root)
        if hand:
            top = max(v.co.z for v in hand.data.vertices)
            wrist = centroid(hand, lambda co, t=top: co.z > t - 0.1)
            set_pivot(hand, wrist, arm or root)
    return root, parts


def render_exploded(prefix, parts):
    """Render com as peças afastadas, para conferir a separação."""
    offsets = {
        "Head": (0, 0, 0.45), "Visor": (0, -0.35, 0), "Ear_L": (0.4, 0, 0), "Ear_R": (-0.4, 0, 0),
        "Neck": (0, 0, 0.2), "Base_Glow": (0, 0, -0.3), "Body_Black": (0, 0, -0.15),
        "Shoulder_L": (0.25, 0, 0.1), "Shoulder_R": (-0.25, 0, 0.1),
        "Arm_L": (0.2, 0, -0.05), "Arm_R": (-0.2, 0, -0.05),
        "Hand_L": (0.15, 0, -0.2), "Hand_R": (-0.15, 0, -0.2),
    }
    saved = {n: o.location.copy() for n, o in parts.items()}
    for name, off in offsets.items():
        if name in parts:
            parts[name].location += Vector(off)
    scene = bpy.context.scene
    cam = scene.camera
    cam_loc, lens = cam.location.copy(), cam.data.lens
    cam.data.lens = 105
    for view, loc in {"exploded_front": (0.0, -14.0, 2.3),
                      "exploded_three_quarter": (6.5, -12.4, 2.8)}.items():
        cam.location = loc
        scene.render.filepath = f"{prefix}_{view}.png"
        bpy.ops.render.render(write_still=True)
    for name, loc in saved.items():
        parts[name].location = loc
    cam.location, cam.data.lens = cam_loc, lens


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    glb = next((a for i, a in enumerate(argv) if a.endswith(".glb")), None)
    if glb:
        import importlib.util
        here = os.path.dirname(os.path.abspath(__file__))
        spec = importlib.util.spec_from_file_location(
            "import_robot_glb", os.path.join(here, "import_robot_glb.py"))
        importer = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(importer)
        importer.main(glb)
    _, parts = separate()
    print("Peças:", ", ".join(sorted(parts)))
    if "--render" in argv:
        render_exploded(argv[argv.index("--render") + 1], parts)
    if "--save" in argv:
        bpy.ops.file.pack_all()
        bpy.ops.wm.save_as_mainfile(filepath=bpy.path.abspath(argv[argv.index("--save") + 1]))

"""Importa o robô gerado por IA (.glb) e deixa pronto para render no Blender.

- vira o modelo de frente para a câmera (-Y) e o coloca em pé sobre Z = 0;
- suaviza o sombreamento;
- deixa o plástico brilhante (coat) e faz os olhos, anéis dos fones e a base
  emitirem luz de verdade, usando uma máscara de cor tirada da própria textura;
- monta estúdio (luzes, fundo cinza, câmera, bloom).

Uso:
  - Blender MCP: ajuste GLB_PATH abaixo e cole o arquivo em `execute_blender_code`.
  - Linha de comando:
      blender -b -P blender/import_robot_glb.py -- blender/models/robot_ai.glb \
          --render blender/renders/glb --save blender/robot_glb.blend
"""

import math
import sys

import bpy
from mathutils import Vector

GLB_PATH = "blender/models/robot_ai.glb"
TARGET_HEIGHT = 2.9          # altura final do robô (unidades do Blender)
FRONT_ROTATION_Z = math.radians(90)   # o .glb vem com a frente para -X
GLOW_STRENGTH = 4.5
COLLECTION_NAME = "RobotGLB"


def import_glb(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    col = bpy.data.collections.get(COLLECTION_NAME) or bpy.data.collections.new(COLLECTION_NAME)
    if col.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(col)
    for o in new:
        for c in o.users_collection:
            c.objects.unlink(o)
        col.objects.link(o)
    return new


def place(objects):
    """Gira, escala e apoia o modelo no chão, usando um Empty como raiz."""
    root = bpy.data.objects.new("RobotGLB_Root", None)
    bpy.data.collections[COLLECTION_NAME].objects.link(root)
    for o in objects:
        if o.parent is None:
            o.parent = root
    root.rotation_euler.z = FRONT_ROTATION_Z
    bpy.context.view_layer.update()

    meshes = [o for o in objects if o.type == "MESH"]
    corners = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
    lo = Vector(map(min, *corners)) if len(corners) > 1 else corners[0]
    hi = Vector(map(max, *corners)) if len(corners) > 1 else corners[0]
    scale = TARGET_HEIGHT / (hi.z - lo.z)
    root.scale = (scale,) * 3
    center = (lo + hi) / 2
    root.location = (-center.x * scale, -center.y * scale, -lo.z * scale)
    return root, meshes


def upgrade_material(mat):
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    tex_link = bsdf.inputs["Base Color"].links
    bsdf.inputs["Roughness"].default_value = 0.3
    bsdf.inputs["Metallic"].default_value = 0.0
    bsdf.inputs["Coat Weight"].default_value = 0.8
    bsdf.inputs["Coat Roughness"].default_value = 0.05
    for inp in ("Roughness", "Metallic"):
        for link in list(bsdf.inputs[inp].links):
            nt.links.remove(link)
    if not tex_link:
        return
    color = tex_link[0].from_socket

    # Máscara de brilho: azul-ciano claro (olhos, anéis, base), mas não o
    # azul escuro do logo/fones nem o branco do corpo.
    sep = nt.nodes.new("ShaderNodeSeparateColor")
    nt.links.new(color, sep.inputs[0])

    def ramp(socket, lo, hi):
        node = nt.nodes.new("ShaderNodeMapRange")
        node.clamp = True
        node.inputs["From Min"].default_value = lo
        node.inputs["From Max"].default_value = hi
        nt.links.new(socket, node.inputs["Value"])
        return node.outputs["Result"]

    def math_node(op, a, b):
        node = nt.nodes.new("ShaderNodeMath")
        node.operation = op
        for i, v in enumerate((a, b)):
            if isinstance(v, float):
                node.inputs[i].default_value = v
            else:
                nt.links.new(v, node.inputs[i])
        return node.outputs[0]

    blue = ramp(sep.outputs["Blue"], 0.70, 0.80)
    green = ramp(sep.outputs["Green"], 0.12, 0.18)
    b_minus_r = math_node("SUBTRACT", sep.outputs["Blue"], sep.outputs["Red"])
    not_white = ramp(b_minus_r, 0.25, 0.35)
    mask = math_node("MULTIPLY", math_node("MULTIPLY", blue, green), not_white)
    nt.links.new(color, bsdf.inputs["Emission Color"])
    nt.links.new(math_node("MULTIPLY", mask, GLOW_STRENGTH), bsdf.inputs["Emission Strength"])


def prepare(meshes):
    for o in meshes:
        o.data.polygons.foreach_set("use_smooth", [True] * len(o.data.polygons))
        o.data.update()
        for mat in o.data.materials:
            if mat and mat.use_nodes:
                upgrade_material(mat)


def setup_studio():
    scene = bpy.context.scene
    col = bpy.data.collections[COLLECTION_NAME]
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
    target.location = (0, 0, TARGET_HEIGHT * 0.5)
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

    cam = bpy.data.objects.new("Camera", bpy.data.cameras.new("Camera"))
    cam.data.lens = 128
    col.objects.link(cam)
    cam.constraints.new("TRACK_TO").target = target
    scene.camera = cam

    scene.render.engine = "CYCLES"
    scene.cycles.samples = 128
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = 1340, 1208
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
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
    except (AttributeError, KeyError, TypeError, RuntimeError) as exc:
        print("Bloom não configurado:", exc)
    return cam


def render_views(cam, prefix):
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


def main(path, render_prefix=None, save_path=None):
    for name in ("Cube", "Light", "Camera"):
        if name in bpy.data.objects:
            bpy.data.objects.remove(bpy.data.objects[name], do_unlink=True)
    objects = import_glb(bpy.path.abspath(path))
    _, meshes = place(objects)
    prepare(meshes)
    cam = setup_studio()
    cam.location = (0.0, -14.0, 2.3)
    if render_prefix:
        render_views(cam, render_prefix)
    if save_path:
        bpy.ops.file.pack_all()
        bpy.ops.wm.save_as_mainfile(filepath=bpy.path.abspath(save_path))


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    positional = [a for i, a in enumerate(argv)
                  if not a.startswith("--") and (i == 0 or argv[i - 1] not in ("--render", "--save"))]
    main(positional[0] if positional else GLB_PATH,
         argv[argv.index("--render") + 1] if "--render" in argv else None,
         argv[argv.index("--save") + 1] if "--save" in argv else None)

"""
Builds the 7 low-poly portfolio models headlessly and saves one .blend + one .glb each.

Run:  blender --background --python assets-src/build_models.py
      (or: npm run models:build, which also Draco-compresses into public/models)

Conventions
- Blender axes: +X right, -Y front (faces the viewer), +Z up. Real-world scale in metres.
- Root object origin at the base centre. Moving parts are child objects with the
  origin on their hinge (Box_Lid, Mailbox_Door, Mailbox_Flag).
- Two shared materials: "Palette" (lit, vertex colours) and "Glow" (emissive, vertex colours).
- No image textures. A soft height gradient is baked into the vertex colours.
"""
import bpy, bmesh, math, os, random
from mathutils import Matrix, Vector, Euler

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "export")
os.makedirs(OUT, exist_ok=True)


# ---------------------------------------------------------------- palette
def _lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hexc(h):
    h = h.lstrip("#")
    return tuple(_lin(int(h[i:i + 2], 16) / 255.0) for i in (0, 2, 4)) + (1.0,)


C = {k: hexc(v) for k, v in {
    # warm
    "cream": "#ffe2b0", "paper": "#f3d9a8", "orange": "#ff9d3c", "deep": "#e8622a",
    "red": "#d6304a", "gold": "#f2b441", "kraft": "#c8935e", "kraft_d": "#9a6b40",
    "wood": "#8a5a3c", "wood_d": "#5b3a2a", "beige": "#d6cdb6", "beige_d": "#a9a089",
    # cool
    "navy": "#1f2a52", "navy_d": "#141a33", "slate": "#39476f", "steel": "#5e78b8",
    "sky": "#8fb7ff", "teal": "#3fb7b0", "white": "#e8ecff", "violet": "#7a5cc7",
    # glow
    "g_warm": "#ffc46b", "g_hot": "#fff0c2", "g_orange": "#ff8a2a", "g_amber": "#ffab3d",
    "g_cyan": "#7fe3ff", "g_pink": "#ff6fa3", "g_green": "#8dffb0", "g_screen": "#bfe9ff",
}.items()}


# ---------------------------------------------------------------- mesh builder
class Builder:
    """Collects coloured primitives into one bmesh."""

    def __init__(self):
        self.bm = bmesh.new()
        self.col = self.bm.loops.layers.float_color.new("Col")
        self.uv = self.bm.loops.layers.uv.new("UVMap")

    def _merge(self, tmp, color, glow, loc, rot):
        col = tmp.loops.layers.float_color.new("Col")
        tmp.loops.layers.uv.new("UVMap")
        for f in tmp.faces:
            f.material_index = 1 if glow else 0
            for l in f.loops:
                l[col] = color
        m = Matrix.Translation(Vector(loc)) @ Euler(tuple(math.radians(a) for a in rot)).to_matrix().to_4x4()
        bmesh.ops.transform(tmp, matrix=m, verts=tmp.verts)
        me = bpy.data.meshes.new("_tmp")
        tmp.to_mesh(me)
        tmp.free()
        self.bm.from_mesh(me)
        bpy.data.meshes.remove(me)

    def box(self, size, loc, color, rot=(0, 0, 0), bevel=0.0, glow=False):
        """Box centred on loc."""
        tmp = bmesh.new()
        bmesh.ops.create_cube(tmp, size=1.0)
        bmesh.ops.scale(tmp, vec=Vector(size), verts=tmp.verts)
        if bevel > 0:
            bmesh.ops.bevel(tmp, geom=tmp.edges[:], offset=bevel, segments=1, affect='EDGES', profile=0.5)
        self._merge(tmp, color, glow, loc, rot)

    def cyl(self, r1, r2, depth, loc, color, segs=12, rot=(0, 0, 0), glow=False, caps=True):
        """Cylinder / cone frustum along local Z, centred on loc. r1 = bottom, r2 = top."""
        tmp = bmesh.new()
        bmesh.ops.create_cone(tmp, cap_ends=caps, cap_tris=False, segments=segs,
                              radius1=r1, radius2=r2, depth=depth)
        self._merge(tmp, color, glow, loc, rot)

    def sphere(self, r, loc, color, segs=10, rings=6, scale=(1, 1, 1), glow=False):
        tmp = bmesh.new()
        bmesh.ops.create_uvsphere(tmp, u_segments=segs, v_segments=rings, radius=r)
        bmesh.ops.scale(tmp, vec=Vector(scale), verts=tmp.verts)
        self._merge(tmp, color, glow, loc, (0, 0, 0))

    def prism(self, profile_yz, thickness, x, color, glow=False):
        """Extrudes a (y, z) outline along X, centred at x."""
        tmp = bmesh.new()
        a = [tmp.verts.new((-thickness / 2, y, z)) for y, z in profile_yz]
        b = [tmp.verts.new((thickness / 2, y, z)) for y, z in profile_yz]
        n = len(a)
        tmp.faces.new(a)
        tmp.faces.new(list(reversed(b)))
        for i in range(n):
            j = (i + 1) % n
            tmp.faces.new((a[j], a[i], b[i], b[j]))
        bmesh.ops.recalc_face_normals(tmp, faces=tmp.faces[:])
        self._merge(tmp, color, glow, (x, 0, 0), (0, 0, 0))

    def screen(self, w, h, loc, color, rot=(0, 0, 0)):
        """Single glowing quad facing -Y with 0..1 UVs (for runtime screen textures)."""
        tmp = bmesh.new()
        pts = [(-w / 2, 0, -h / 2), (w / 2, 0, -h / 2), (w / 2, 0, h / 2), (-w / 2, 0, h / 2)]
        uvs = [(0, 0), (1, 0), (1, 1), (0, 1)]
        f = tmp.faces.new([tmp.verts.new(p) for p in pts])
        col = tmp.loops.layers.float_color.new("Col")
        uv = tmp.loops.layers.uv.new("UVMap")
        f.material_index = 1
        for l, t in zip(f.loops, uvs):
            l[col] = color
            l[uv].uv = t
        m = Matrix.Translation(Vector(loc)) @ Euler(tuple(math.radians(a) for a in rot)).to_matrix().to_4x4()
        bmesh.ops.transform(tmp, matrix=m, verts=tmp.verts)
        me = bpy.data.meshes.new("_tmp")
        tmp.to_mesh(me)
        tmp.free()
        self.bm.from_mesh(me)
        bpy.data.meshes.remove(me)

    def bake_gradient(self, z0, z1, strength=0.3):
        """Fake ambient occlusion: darken and cool the lit faces toward the base."""
        col = self.bm.loops.layers.float_color["Col"]
        span = max(z1 - z0, 1e-6)
        for f in self.bm.faces:
            if f.material_index == 1:
                continue
            down = max(0.0, -f.normal.z) * 0.25
            for l in f.loops:
                t = min(max((l.vert.co.z - z0) / span, 0.0), 1.0)
                k = 1.0 - strength * (1.0 - t) ** 1.5 - down
                c = l[col]
                l[col] = (c[0] * k * 0.97, c[1] * k * 0.99, c[2] * k * 1.0 + 0.004 * (1 - t), 1.0)


# ---------------------------------------------------------------- materials / objects
def get_materials():
    def make(name, emissive):
        mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
        mat.use_nodes = True
        nt = mat.node_tree
        bsdf = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if bsdf is None:
            return mat
        attr = nt.nodes.new("ShaderNodeVertexColor")
        attr.layer_name = "Col"
        attr.location = (-320, 200)
        nt.links.new(attr.outputs["Color"], bsdf.inputs["Base Color"])
        bsdf.inputs["Roughness"].default_value = 0.85
        if emissive:
            for key in ("Emission Color", "Emission"):
                if key in bsdf.inputs:
                    nt.links.new(attr.outputs["Color"], bsdf.inputs[key])
                    break
            if "Emission Strength" in bsdf.inputs:
                bsdf.inputs["Emission Strength"].default_value = 2.0
        return mat
    return make("Palette", False), make("Glow", True)


def make_object(name, builder, parent=None, origin=(0, 0, 0), bake=None):
    """Writes the builder into a named mesh object. `origin` is where the object's
    origin sits (world space); geometry is shifted so transforms stay applied."""
    bm = builder.bm
    if bake:
        builder.bake_gradient(*bake)
    bmesh.ops.translate(bm, vec=-Vector(origin), verts=bm.verts)
    bm.normal_update()
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    pal, glow = get_materials()
    me.materials.append(pal)
    me.materials.append(glow)
    try:
        me.color_attributes.active_color = me.color_attributes["Col"]
        me.color_attributes.render_color_index = me.color_attributes.find("Col")
    except Exception:
        pass
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    if parent is not None:
        ob.parent = parent
        ob.location = Vector(origin) - parent.matrix_world.translation
    else:
        ob.location = origin
    bpy.context.view_layer.update()
    return ob


# ---------------------------------------------------------------- the seven assets
def build_box():
    """Software package box, 0.40 x 0.40 x 0.30 m, lid hinged at the back."""
    W, D, H, T = 0.40, 0.40, 0.30, 0.012
    b = Builder()
    b.box((W, D, T), (0, 0, T / 2), C["kraft_d"])                                # floor
    b.box((W, T, H), (0, -D / 2 + T / 2, H / 2), C["kraft"])                      # front
    b.box((W, T, H), (0, D / 2 - T / 2, H / 2), C["kraft"])                       # back
    b.box((T, D - 2 * T, H), (-W / 2 + T / 2, 0, H / 2), C["kraft"])              # left
    b.box((T, D - 2 * T, H), (W / 2 - T / 2, 0, H / 2), C["kraft"])               # right
    b.box((0.07, 0.004, H), (0, -D / 2 - 0.002, H / 2), C["gold"])                # tape, front
    b.box((0.07, 0.004, H), (0, D / 2 + 0.002, H / 2), C["gold"])                 # tape, back
    b.box((0.15, 0.004, 0.10), (-0.105, -D / 2 - 0.002, 0.11), C["white"])        # label
    b.box((0.15, 0.005, 0.022), (-0.105, -D / 2 - 0.003, 0.149), C["steel"])      # label header
    b.box((0.09, 0.005, 0.010), (-0.125, -D / 2 - 0.003, 0.115), C["slate"])      # label text
    b.box((0.06, 0.005, 0.010), (-0.140, -D / 2 - 0.003, 0.095), C["slate"])
    b.box((0.05, 0.005, 0.05), (0.125, -D / 2 - 0.003, 0.085), C["navy"])         # "this way up"
    b.cyl(0.0, 0.016, 0.022, (0.125, -D / 2 - 0.006, 0.092), C["gold"], segs=3, rot=(90, 0, 0))
    b.box((W - 2 * T, D - 2 * T, 0.004), (0, 0, T + 0.05), C["g_warm"], glow=True)  # glowing contents
    b.box((0.16, 0.16, 0.08), (-0.05, 0.02, T + 0.09), C["g_hot"], rot=(0, 0, 18), glow=True)
    b.box((0.10, 0.12, 0.05), (0.09, -0.05, T + 0.075), C["g_amber"], rot=(0, 0, -12), glow=True)
    root = make_object("Box", b, bake=(0, H, 0.28))

    lid = Builder()
    LT = 0.014
    LD, LY = D + 0.018, -0.003                       # lid depth / centre: hinge edge at the back wall
    lid.box((W + 0.024, LD, LT), (0, LY, H + LT / 2), C["kraft"])
    lid.box((W + 0.024, 0.010, 0.04), (0, -D / 2 - 0.007, H - 0.012), C["kraft_d"])       # front lip, outside the wall + tape
    lid.box((0.010, LD, 0.04), (-W / 2 - 0.007, LY, H - 0.012), C["kraft_d"])             # side lips, outside the walls
    lid.box((0.010, LD, 0.04), (W / 2 + 0.007, LY, H - 0.012), C["kraft_d"])
    lid.box((0.07, LD + 0.002, 0.004), (0, LY, H + LT + 0.002), C["gold"])                # tape
    lid.box((0.072, 0.004, 0.042), (0, -D / 2 - 0.014, H - 0.012), C["gold"])
    make_object("Box_Lid", lid, parent=root, origin=(0, D / 2 + 0.006, H))
    return root


def build_lantern():
    """Paper sky lantern, about 0.36 m wide and 0.62 m tall including the tassel."""
    b = Builder()
    z0 = 0.16                                   # paper starts above the tassel
    rings = [(0.00, 0.085), (0.07, 0.135), (0.17, 0.168), (0.27, 0.168), (0.36, 0.135), (0.42, 0.095)]
    cols = ["g_hot", "g_warm", "g_amber", "g_orange", "g_orange"]
    for i in range(len(rings) - 1):
        (za, ra), (zb, rb) = rings[i], rings[i + 1]
        b.cyl(ra, rb, zb - za, (0, 0, z0 + (za + zb) / 2), C[cols[i]], segs=10, glow=True, caps=False)
    b.cyl(0.090, 0.090, 0.022, (0, 0, z0 - 0.008), C["gold"], segs=10)             # bottom ring
    b.cyl(0.100, 0.100, 0.022, (0, 0, z0 + 0.43), C["gold"], segs=10)              # top ring
    b.cyl(0.171, 0.171, 0.008, (0, 0, z0 + 0.22), C["deep"], segs=10, caps=False)  # belly band
    probe = bmesh.new()                                                            # where the cone's edges are
    bmesh.ops.create_cone(probe, cap_ends=False, segments=10, radius1=1, radius2=1, depth=1)
    probe.verts.ensure_lookup_table()
    phase = math.atan2(probe.verts[0].co.y, probe.verts[0].co.x)
    probe.free()
    for k in range(5):                                                             # ribs hug the paper, segment by segment
        a = phase + k * math.tau / 5
        for i in range(len(rings) - 1):
            (za, ra), (zb, rb) = rings[i], rings[i + 1]
            rm = (ra + rb) / 2 + 0.003
            tilt = math.degrees(math.atan2(rb - ra, zb - za))
            b.box((0.007, 0.009, math.hypot(zb - za, rb - ra) + 0.004),
                  (math.cos(a) * rm, math.sin(a) * rm, z0 + (za + zb) / 2), C["gold"], rot=(0, tilt, math.degrees(a)))
    b.cyl(0.03, 0.0, 0.07, (0, 0, z0 + 0.06), C["g_hot"], segs=6, glow=True)       # flame
    b.cyl(0.035, 0.035, 0.012, (0, 0, z0 + 0.012), C["wood_d"], segs=6)            # burner
    b.cyl(0.004, 0.004, 0.06, (0, 0, z0 + 0.47), C["gold"], segs=5)                # top loop stem
    b.sphere(0.018, (0, 0, z0 + 0.51), C["gold"], segs=6, rings=4)
    b.cyl(0.004, 0.004, 0.06, (0, 0, z0 - 0.045), C["gold"], segs=5)               # tassel string
    b.sphere(0.02, (0, 0, z0 - 0.075), C["gold"], segs=6, rings=4)
    b.cyl(0.012, 0.026, 0.085, (0, 0, 0.0425), C["red"], segs=6)                   # tassel
    return make_object("Lantern", b, bake=(0, 0.66, 0.2))


def build_monitor():
    """Retro CRT monitor (0.42 m wide) with a separate keyboard in front."""
    b = Builder()
    base = 0.0
    b.box((0.26, 0.24, 0.03), (0, 0.03, base + 0.015), C["beige_d"], bevel=0.006)       # foot
    b.cyl(0.07, 0.055, 0.05, (0, 0.03, base + 0.055), C["beige_d"], segs=8)             # neck
    zc = base + 0.08 + 0.17
    b.box((0.42, 0.14, 0.34), (0, -0.09, zc), C["beige"], bevel=0.012)                  # front shell
    b.box((0.36, 0.22, 0.28), (0, 0.07, zc + 0.005), C["beige_d"], bevel=0.02)          # tube housing
    b.box((0.26, 0.10, 0.20), (0, 0.21, zc + 0.01), C["beige_d"], bevel=0.02)           # back
    b.box((0.345, 0.012, 0.255), (0, -0.160, zc + 0.022), C["navy_d"], bevel=0.004)     # bezel
    b.box((0.05, 0.008, 0.012), (-0.13, -0.163, zc - 0.135), C["slate"])                # badge
    b.box((0.016, 0.01, 0.016), (0.12, -0.163, zc - 0.135), C["beige_d"])               # knobs
    b.box((0.016, 0.01, 0.016), (0.15, -0.163, zc - 0.135), C["beige_d"])
    b.box((0.012, 0.006, 0.006), (0.085, -0.164, zc - 0.135), C["g_green"], glow=True)  # power LED
    b.box((0.20, 0.14, 0.006), (0, 0.085, zc + 0.148), C["beige_d"])                    # vent plate
    for i in range(4):                                                                  # vent slats on top of it
        b.box((0.18, 0.012, 0.004), (0, 0.03 + i * 0.035, zc + 0.153), C["navy_d"])
    root = make_object("Monitor", b, bake=(0, 0.42, 0.26))

    s = Builder()
    s.screen(0.305, 0.220, (0, -0.1675, zc + 0.022), C["g_screen"])
    make_object("Monitor_Screen", s, parent=root, origin=(0, -0.1675, zc + 0.022))

    k = Builder()
    ky = -0.36
    k.box((0.40, 0.15, 0.022), (0, ky, 0.011), C["beige"], bevel=0.005)
    rnd = random.Random(7)
    for r in range(4):
        for c in range(13):
            col = C["white"] if rnd.random() > 0.18 else C["beige_d"]
            if r == 0 and c in (0, 12):
                col = C["orange"]
            k.box((0.024, 0.024, 0.010), (-0.174 + c * 0.029, ky + 0.055 - r * 0.028, 0.026), col)
    k.box((0.17, 0.020, 0.010), (0, ky - 0.058, 0.026), C["white"])                     # space bar
    make_object("Monitor_Keyboard", k, parent=root, origin=(0, ky, 0), bake=(0, 0.05, 0.15))
    return root


def build_arcade():
    """Arcade cabinet, 0.70 x 0.80 x 1.78 m."""
    b = Builder()
    side = [(-0.34, 0.0), (0.40, 0.0), (0.40, 1.78), (-0.24, 1.78), (-0.30, 1.52), (-0.17, 1.46),
            (-0.10, 1.00), (-0.40, 0.94), (-0.40, 0.84), (-0.34, 0.78)]
    for x in (-0.335, 0.335):
        b.prism(side, 0.03, x, C["navy"])
    inner = [(y * 0.97 + 0.006, z * 0.985 + 0.004) for y, z in side]
    b.prism(inner, 0.64, 0.0, C["slate"])                                               # body core
    for x in (-0.352, 0.352):                                                           # side art
        b.box((0.004, 0.50, 0.10), (x, 0.06, 0.52), C["orange"], rot=(22, 0, 0))
        b.box((0.004, 0.50, 0.05), (x, 0.06, 0.40), C["red"], rot=(22, 0, 0))
        b.box((0.004, 0.50, 0.03), (x, 0.06, 0.31), C["gold"], rot=(22, 0, 0))
    b.box((0.62, 0.02, 0.20), (0, -0.262, 1.65), C["g_pink"], rot=(-13, 0, 0), glow=True)   # marquee
    b.box((0.64, 0.03, 0.03), (0, -0.300, 1.535), C["navy_d"])
    b.box((0.60, 0.02, 0.44), (0, -0.125, 1.235), C["navy_d"], rot=(-8.5, 0, 0))            # screen bezel
    b.box((0.64, 0.30, 0.03), (0, -0.25, 0.975), C["navy_d"], rot=(11, 0, 0))               # control deck
    b.cyl(0.012, 0.012, 0.09, (-0.16, -0.26, 1.03), C["white"], segs=6, rot=(11, 0, 0))     # joystick
    b.sphere(0.032, (-0.16, -0.268, 1.085), C["red"], segs=8, rings=5)
    for i, col in enumerate(("g_cyan", "g_warm", "g_pink", "g_green")):
        b.cyl(0.024, 0.024, 0.016, (0.02 + (i % 2) * 0.09 + (i // 2) * 0.04, -0.28 + (i // 2) * 0.07, 1.004 + (i // 2) * 0.013),
              C[col], segs=8, rot=(11, 0, 0), glow=True)
    b.box((0.26, 0.012, 0.30), (0, -0.336, 0.44), C["navy_d"], bevel=0.004)                 # coin door
    b.box((0.05, 0.014, 0.08), (-0.05, -0.340, 0.50), C["g_amber"], glow=True)
    b.box((0.05, 0.014, 0.08), (0.05, -0.340, 0.50), C["g_amber"], glow=True)
    b.box((0.72, 0.84, 0.03), (0, 0.03, 0.015), C["navy_d"])                                # plinth
    root = make_object("Arcade", b, bake=(0, 1.78, 0.34))

    s = Builder()
    s.screen(0.50, 0.36, (0, -0.139, 1.237), C["g_screen"], rot=(-8.5, 0, 0))
    make_object("Arcade_Screen", s, parent=root, origin=(0, -0.139, 1.237))
    return root


def build_phone():
    """Smartphone standing upright, 72 x 152 x 9 mm."""
    W, H, T = 0.072, 0.152, 0.009
    b = Builder()
    b.box((W, T, H), (0, 0, H / 2), C["navy"], bevel=0.003)
    b.box((W - 0.004, 0.0012, H - 0.004), (0, -T / 2 - 0.0004, H / 2), C["navy_d"])         # glass
    b.box((0.026, 0.003, 0.026), (-0.016, T / 2 + 0.001, H - 0.022), C["slate"], bevel=0.001)  # camera
    b.cyl(0.006, 0.006, 0.002, (-0.021, T / 2 + 0.003, H - 0.017), C["navy_d"], segs=8, rot=(90, 0, 0))
    b.cyl(0.006, 0.006, 0.002, (-0.011, T / 2 + 0.003, H - 0.027), C["navy_d"], segs=8, rot=(90, 0, 0))
    b.box((0.002, 0.004, 0.022), (W / 2 + 0.0006, 0, H * 0.68), C["steel"])                 # buttons
    b.box((0.002, 0.004, 0.012), (W / 2 + 0.0006, 0, H * 0.52), C["gold"])
    root = make_object("Phone", b, bake=(0, H, 0.2))

    s = Builder()
    s.screen(W - 0.008, H - 0.010, (0, -T / 2 - 0.0014, H / 2), C["g_screen"])
    make_object("Phone_Screen", s, parent=root, origin=(0, -T / 2 - 0.0014, H / 2))
    return root


def build_bookshelf():
    """Small bookshelf with books and scrolls, 0.80 x 0.28 x 1.02 m."""
    W, D, H, T = 0.80, 0.28, 1.0, 0.03
    b = Builder()
    b.box((T, D, H), (-W / 2 + T / 2, 0, H / 2), C["wood"])
    b.box((T, D, H), (W / 2 - T / 2, 0, H / 2), C["wood"])
    b.box((W + 0.04, D + 0.03, T), (0, -0.005, H + T / 2), C["wood_d"], bevel=0.006)        # top
    b.box((W, D, 0.06), (0, 0, 0.03), C["wood_d"])                                          # plinth
    b.box((W - 2 * T, 0.012, H - 0.06), (0, D / 2 - 0.006, 0.06 + (H - 0.06) / 2), C["wood_d"])  # back
    shelves = [0.06, 0.37, 0.68]
    for z in shelves[1:]:
        b.box((W - 2 * T, D - 0.012, 0.022), (0, -0.006, z), C["wood"])
    rnd = random.Random(42)
    book_cols = ["red", "steel", "teal", "gold", "violet", "cream", "deep", "sky", "navy", "orange"]
    inner_l, inner_r = -W / 2 + T + 0.006, W / 2 - T - 0.006

    def row(z, x0, x1, lean_last=True):
        x = x0
        while True:
            w = rnd.uniform(0.026, 0.05)
            if x + w > x1:
                break
            h = rnd.uniform(0.19, 0.265)
            d = rnd.uniform(0.15, 0.20)
            col = C[rnd.choice(book_cols)]
            b.box((w, d, h), (x + w / 2, -0.03 + (0.2 - d) / 2, z + h / 2), col)
            if rnd.random() > 0.45:
                b.box((w + 0.001, 0.004, 0.018), (x + w / 2, -0.03 + (0.2 - d) / 2 - d / 2, z + h * 0.78), C["gold"])
            x += w + 0.003
        return x

    # bottom shelf: books, then a leaning book
    end = row(shelves[0], inner_l, 0.03)
    b.box((0.035, 0.18, 0.24), (end + 0.062, -0.03, shelves[0] + 0.122), C["teal"], rot=(0, -20, 0))
    b.box((0.16, 0.16, 0.03), (0.27, -0.03, shelves[0] + 0.016), C["cream"])                # lying books
    b.box((0.15, 0.17, 0.035), (0.27, -0.03, shelves[0] + 0.049), C["red"], rot=(0, 0, 8))
    # middle shelf: scroll stack + books
    zs = shelves[1] + 0.011
    for (sx, sz) in ((-0.30, 0.032), (-0.235, 0.032), (-0.17, 0.032), (-0.2675, 0.088), (-0.2025, 0.088), (-0.235, 0.144)):
        b.cyl(0.031, 0.031, 0.22, (sx, -0.02, zs + sz), C["paper"], segs=8, rot=(90, 0, 0))
        b.cyl(0.033, 0.033, 0.03, (sx, -0.02, zs + sz), C["red"], segs=8, rot=(90, 0, 0))
        b.cyl(0.012, 0.012, 0.24, (sx, -0.02, zs + sz), C["wood_d"], segs=6, rot=(90, 0, 0))
    row(zs, -0.10, inner_r)
    # top shelf: books, small glowing lamp
    zt = shelves[2] + 0.011
    row(zt, inner_l, 0.12)
    b.box((0.09, 0.09, 0.012), (0.25, -0.03, zt + 0.006), C["wood_d"])
    b.box((0.07, 0.07, 0.11), (0.25, -0.03, zt + 0.067), C["g_warm"], glow=True)
    b.box((0.09, 0.09, 0.012), (0.25, -0.03, zt + 0.128), C["wood_d"])
    # on top: a scroll and a small stack
    b.cyl(0.03, 0.03, 0.30, (-0.16, -0.01, H + T + 0.03), C["paper"], segs=8, rot=(90, 0, 75))
    b.cyl(0.032, 0.032, 0.035, (-0.16, -0.01, H + T + 0.03), C["red"], segs=8, rot=(90, 0, 75))
    b.box((0.17, 0.13, 0.03), (0.2, -0.01, H + T + 0.015), C["steel"], rot=(0, 0, -10))
    b.box((0.15, 0.12, 0.025), (0.2, -0.01, H + T + 0.0425), C["gold"], rot=(0, 0, 6))
    return make_object("Bookshelf", b, bake=(0, 1.1, 0.3))


def build_mailbox():
    """Post-mounted mailbox, 1.22 m tall, with a hinged door and a raisable flag."""
    b = Builder()
    b.box((0.34, 0.34, 0.05), (0, 0, 0.025), C["slate"], bevel=0.01)                        # base
    b.box((0.09, 0.09, 0.95), (0, 0, 0.05 + 0.475), C["wood"])                              # post
    b.box((0.09, 0.30, 0.07), (0, -0.03, 0.90), C["wood_d"], rot=(-35, 0, 0))               # brace
    b.box((0.26, 0.50, 0.03), (0, -0.03, 1.005), C["wood_d"])                               # platform
    L, R, Z = 0.46, 0.115, 1.02
    yc = -0.03
    b.box((2 * R, L, 0.12), (0, yc, Z + 0.06), C["steel"])                                  # lower shell
    b.cyl(R, R, L, (0, yc, Z + 0.12), C["steel"], segs=14, rot=(90, 0, 0))                  # rounded top
    b.box((2 * R + 0.006, 0.02, 0.012), (0, yc - L / 2 + 0.04, Z + 0.004), C["navy"])       # trim
    b.box((2 * R - 0.03, 0.004, 0.10), (0, yc - L / 2 - 0.002, Z + 0.065), C["g_warm"], glow=True)   # inner glow
    b.box((0.12, 0.002, 0.07), (0.0, yc - L / 2 - 0.0055, Z + 0.065), C["cream"], rot=(0, 14, 0))    # letter, seen when the door opens
    b.box((2 * R + 0.004, 0.10, 0.03), (0, yc + 0.02, Z + 0.118), C["sky"])                 # stripe
    b.cyl(0.012, 0.012, 0.012, (R + 0.006, yc + 0.08, Z + 0.10), C["gold"], segs=8, rot=(0, 90, 0))  # flag pivot
    root = make_object("Mailbox", b, bake=(0, 1.26, 0.3))

    d = Builder()
    fy = yc - L / 2 - 0.016                          # door clears the glow panel and letter behind it
    d.box((2 * R, 0.014, 0.12), (0, fy, Z + 0.06), C["sky"])
    d.cyl(R, R, 0.014, (0, fy, Z + 0.12), C["sky"], segs=14, rot=(90, 0, 0))
    d.box((0.05, 0.02, 0.02), (0, fy - 0.014, Z + 0.185), C["gold"])                        # handle
    make_object("Mailbox_Door", d, parent=root, origin=(0, fy, Z))

    f = Builder()                                                                           # flag lies forward (down)
    px, py, pz = R + 0.014, yc + 0.08, Z + 0.10
    f.box((0.008, 0.20, 0.018), (px, py - 0.10, pz), C["red"])
    f.box((0.008, 0.09, 0.07), (px, py - 0.185, pz + 0.026), C["red"])
    make_object("Mailbox_Flag", f, parent=root, origin=(px, py, pz))
    return root


ASSETS = [("box", build_box), ("lantern", build_lantern), ("monitor", build_monitor),
          ("arcade", build_arcade), ("phone", build_phone), ("bookshelf", build_bookshelf),
          ("mailbox", build_mailbox)]


def tri_count():
    n = 0
    for ob in bpy.context.scene.objects:
        if ob.type == 'MESH':
            ob.data.calc_loop_triangles()
            n += len(ob.data.loop_triangles)
    return n


def export_glb(path):
    props = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
    kw = dict(filepath=path, export_format='GLB', export_apply=True, export_yup=True,
              export_animations=False, export_cameras=False, export_lights=False)
    if 'export_vertex_color' in props:
        kw['export_vertex_color'] = 'ACTIVE'
    if 'export_all_vertex_colors' in props:
        kw['export_all_vertex_colors'] = False
    if 'export_active_vertex_color_when_no_material' in props:
        kw['export_active_vertex_color_when_no_material'] = True
    if 'export_colors' in props:
        kw['export_colors'] = True
    bpy.ops.export_scene.gltf(**kw)


for name, fn in ASSETS:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    fn()
    tris = tri_count()
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, name + ".blend"), compress=True)
    export_glb(os.path.join(OUT, name + ".glb"))
    print(f"ASSET {name}: {tris} triangles")

print("MODELS DONE")

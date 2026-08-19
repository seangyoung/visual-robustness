"""Generate the Mission Control workbench as an editable Blend and WebXR GLB.

Run with:
  Blender --background --python scripts/blender/create_mission_control_workbench.py

The exported controls use named pivot nodes plus glTF extras. Three.js can read the
extras from Object3D.userData after loading with GLTFLoader.
"""

from __future__ import annotations

import math
from pathlib import Path

import bpy
from mathutils import Vector


PROJECT_ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = PROJECT_ROOT / "assets" / "models"
PUBLIC_MODEL_DIR = PROJECT_ROOT / "public" / "assets" / "models"
BLEND_PATH = OUTPUT_DIR / "mission-control-workbench.blend"
GLB_PATH = PUBLIC_MODEL_DIR / "mission-control-workbench.glb"
PREVIEW_PATH = OUTPUT_DIR / "mission-control-workbench-preview.png"

DECK_TILT = math.radians(6)
SCREEN_TILT = DECK_TILT + math.radians(30)
ARC_ANGLES = (-26, -13, 0, 13, 26)
ARC_RADIUS = 2.18
ARC_START = -34
ARC_END = 34
SHELL_INNER_RADIUS = 1.82
SHELL_OUTER_RADIUS = 2.52


def reset_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for datablock in list(datablocks):
            if datablock.users == 0:
                datablocks.remove(datablock)


def material(name, base_color, metallic=0.0, roughness=0.5, emission=None, alpha=1.0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*base_color, alpha)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*base_color, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
        bsdf.inputs["Emission Strength"].default_value = 2.0
    if alpha < 1.0:
        bsdf.inputs["Alpha"].default_value = alpha
        mat.surface_render_method = "DITHERED"
    return mat


def empty(name, parent=None, location=(0, 0, 0), rotation=(0, 0, 0), props=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = 0.08
    obj.parent = parent
    obj.location = location
    obj.rotation_euler = rotation
    for key, value in (props or {}).items():
        obj[key] = value
    return obj


def rounded_box(name, size, mat, parent=None, location=(0, 0, 0), rotation=(0, 0, 0), bevel=0.025):
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        modifier = obj.modifiers.new("Edge softening", "BEVEL")
        modifier.width = min(bevel, min(size) * 0.24)
        modifier.segments = 3
        modifier.affect = "EDGES"
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.data.materials.append(mat)
    obj.parent = parent
    obj.location = location
    obj.rotation_euler = rotation
    return obj


def cylinder(name, radius, depth, mat, parent=None, location=(0, 0, 0), rotation=(0, 0, 0), vertices=48, bevel=0.01):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth)
    obj = bpy.context.object
    obj.name = name
    if bevel:
        modifier = obj.modifiers.new("Edge softening", "BEVEL")
        modifier.width = bevel
        modifier.segments = 3
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.data.materials.append(mat)
    obj.parent = parent
    obj.location = location
    obj.rotation_euler = rotation
    return obj


def torus(name, major_radius, minor_radius, mat, parent=None, location=(0, 0, 0), rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major_radius, minor_radius=minor_radius, major_segments=64, minor_segments=10)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    obj.parent = parent
    obj.location = location
    obj.rotation_euler = rotation
    return obj


def textured_plane(name, width, height, mat, parent=None, location=(0, 0, 0), rotation=(0, 0, 0)):
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(
        [
            (-width / 2, -height / 2, 0),
            (width / 2, -height / 2, 0),
            (width / 2, height / 2, 0),
            (-width / 2, height / 2, 0),
        ],
        [],
        [(0, 1, 2, 3)],
    )
    mesh.update()
    uv_layer = mesh.uv_layers.new(name="UVMap")
    for loop_index, uv in zip(mesh.polygons[0].loop_indices, [(0, 0), (1, 0), (1, 1), (0, 1)]):
        uv_layer.data[loop_index].uv = uv
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    obj.parent = parent
    obj.location = location
    obj.rotation_euler = rotation
    return obj


def add_text_mesh(name, body, mat, parent, location, size=0.05):
    bpy.ops.object.text_add()
    obj = bpy.context.object
    obj.name = name
    obj.data.body = body
    obj.data.align_x = "CENTER"
    obj.data.align_y = "CENTER"
    obj.data.size = size
    obj.data.extrude = 0.002
    obj.data.bevel_depth = 0.0006
    obj.data.materials.append(mat)
    obj.parent = parent
    obj.location = location
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    return obj


def curved_shell(
    name,
    inner_radius,
    outer_radius,
    inner_bottom,
    outer_bottom,
    inner_top,
    outer_top,
    mat,
    parent,
    bevel=0.025,
    segments=64,
):
    """Create one clean, closed annular-sector solid with a gently sloped top."""
    vertices = []
    faces = []
    for step in range(segments + 1):
        angle = math.radians(ARC_START + (ARC_END - ARC_START) * step / segments)
        sin_angle = math.sin(angle)
        cos_angle = math.cos(angle)
        inner_x = inner_radius * sin_angle
        inner_y = inner_radius * cos_angle - ARC_RADIUS
        outer_x = outer_radius * sin_angle
        outer_y = outer_radius * cos_angle - ARC_RADIUS
        vertices.extend(
            [
                (inner_x, inner_y, inner_bottom),
                (inner_x, inner_y, inner_top),
                (outer_x, outer_y, outer_bottom),
                (outer_x, outer_y, outer_top),
            ]
        )

    for step in range(segments):
        current = step * 4
        following = (step + 1) * 4
        faces.extend(
            [
                (current, following, following + 1, current + 1),
                (current + 2, current + 3, following + 3, following + 2),
                (current + 1, following + 1, following + 3, current + 3),
                (current, current + 2, following + 2, following),
            ]
        )
    last = segments * 4
    faces.append((0, 1, 3, 2))
    faces.append((last, last + 2, last + 3, last + 1))

    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    obj.data.materials.append(mat)
    for polygon in obj.data.polygons:
        polygon.use_smooth = polygon.index < segments * 4

    if bevel:
        modifier = obj.modifiers.new("Continuous edge softening", "BEVEL")
        modifier.width = bevel
        modifier.segments = 3
        modifier.affect = "EDGES"
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        obj.select_set(False)
    return obj


def module_transform(angle_degrees):
    angle = math.radians(angle_degrees)
    x = ARC_RADIUS * math.sin(angle)
    y = -ARC_RADIUS * (1.0 - math.cos(angle))
    return (x, y, 0.84), -angle


def create_control_station(root, index, angle_degrees):
    location, yaw = module_transform(angle_degrees)
    return empty(
        f"Control_Station_{index + 1:02d}",
        root,
        location,
        (0, 0, yaw),
        {"role": "control_station", "station_index": index + 1},
    )


def create_knob_station(root):
    return empty(
        "Control_Station_Knob",
        root,
        (-1.00, -0.10, 0.84),
        (0, 0, math.radians(24)),
        {"role": "control_station", "station_index": "knob"},
    )


def create_screen(name, screen_id, parent, x, y, width, mats, height=0.145):
    frame = rounded_box(
        f"{name}_Frame",
        (width + 0.045, height + 0.04, 0.03),
        mats["black"],
        parent,
        (x, y, 0.124),
        (SCREEN_TILT, 0, 0),
        bevel=0.018,
    )
    screen_mat = material(
        f"MAT_{name}",
        (0.006, 0.025, 0.032),
        metallic=0.05,
        roughness=0.22,
        emission=(0.015, 0.22, 0.28),
    )
    screen = textured_plane(
        name,
        width,
        height,
        screen_mat,
        parent,
        (x, y - 0.004, 0.149),
        (SCREEN_TILT, 0, 0),
    )
    screen["role"] = "screen"
    screen["screen_id"] = screen_id
    screen["addressable"] = True
    screen["default_material"] = screen_mat.name
    frame["screen_id"] = screen_id
    return screen


def create_knob(module, mats):
    create_screen("Screen_Knob", "knob-feedback", module, 0.015, 0.125, 0.40, mats, height=0.117)
    pivot = empty(
        "Control_Knob_Main",
        module,
        (0, -0.105, 0.102),
        (DECK_TILT, 0, 0),
        {
            "role": "interactive_control",
            "interaction": "rotary",
            "control_id": "knob-main",
            "axis": "Y",
            "min_degrees": -135.0,
            "max_degrees": 135.0,
            "step_degrees": 15.0,
            "screen_id": "knob-feedback",
        },
    )
    torus("Knob_Main_Radial_Ring", 0.148, 0.010, mats["cyan"], pivot, (0, 0, 0.010))
    cylinder("Knob_Main_Base", 0.136, 0.026, mats["black"], pivot, (0, 0, 0.014))
    knob = cylinder("Knob_Main_Grip", 0.106, 0.052, mats["metal"], pivot, (0, 0, 0.050), bevel=0.012)
    knob["hit_target"] = True
    hit_target = rounded_box("Knob_Main_Touch_Target", (0.36, 0.012, 0.36), mats["hit"], pivot, (0, 0.065, 0), bevel=0.01)
    hit_target["hit_target"] = True
    rounded_box("Knob_Main_Indicator", (0.011, 0.068, 0.007), mats["cyan"], pivot, (0, 0.031, 0.079), bevel=0.003)
    return pivot


def create_radio_button(parent, index, group_index, option_index, x, mats):
    pivot = empty(
        f"Control_Radio_{index:02d}",
        parent,
        (x, -0.105, 0.102),
        (DECK_TILT, 0, 0),
        {
            "role": "interactive_control",
            "interaction": "radio_button",
            "control_id": f"radio-{index:02d}",
            "radio_group": f"radio-group-{group_index:02d}",
            "option_index": option_index,
            "axis": "Y",
            "travel_meters": 0.014,
            "default_selected": option_index == 1,
        },
    )
    cylinder(f"Radio_{index:02d}_Bezel", 0.064, 0.022, mats["black"], pivot, (0, 0, 0.007), bevel=0.009)
    cap = cylinder(
        f"Radio_{index:02d}_Cap",
        0.047,
        0.034,
        mats["switch"],
        pivot,
        (0, 0, 0.029),
        bevel=0.010,
    )
    cap["hit_target"] = True
    cylinder(
        f"Radio_{index:02d}_Indicator",
        0.018,
        0.005,
        mats["cyan"] if option_index == 1 else mats["metal"],
        pivot,
        (0, 0, 0.049),
        vertices=32,
        bevel=0.002,
    )
    return pivot


def create_submit_button(module, mats):
    pivot = empty(
        "Control_Button_Submit",
        module,
        (0, -0.15, 0.104),
        (DECK_TILT, 0, 0),
        {
            "role": "interactive_control",
            "interaction": "momentary_button",
            "control_id": "submit",
            "axis": "Y",
            "travel_meters": 0.018,
            "event": "submit",
        },
    )
    cylinder("Button_Submit_Bezel", 0.136, 0.025, mats["black"], pivot, (0, 0, 0.008), bevel=0.012)
    cap = cylinder("Button_Submit_Cap", 0.108, 0.046, mats["amber"], pivot, (0, 0, 0.038), bevel=0.014)
    cap["hit_target"] = True
    add_text_mesh("Button_Submit_Label", "Submit", mats["label"], pivot, (0, 0, 0.066), size=0.043)
    return pivot


def create_guarded_button(module, mats):
    button = empty(
        "Control_Button_Guarded",
        module,
        (0, 0.16, 0.104),
        (DECK_TILT, 0, 0),
        {
            "role": "interactive_control",
            "interaction": "momentary_button",
            "control_id": "guarded-secondary",
            "axis": "Y",
            "travel_meters": 0.014,
            "requires_control": "guard-cover",
            "requires_state": "open",
        },
    )
    cylinder("Button_Guarded_Bezel", 0.088, 0.022, mats["black"], button, (0, 0, 0.007), bevel=0.01)
    cap = cylinder("Button_Guarded_Cap", 0.058, 0.038, mats["amber"], button, (0, 0, 0.032), bevel=0.011)
    cap["hit_target"] = True

    guard = empty(
        "Control_Guard_Cover",
        module,
        (0, 0.265, 0.132),
        (DECK_TILT + math.radians(-76), 0, 0),
        {
            "role": "interactive_control",
            "interaction": "hinged_cover",
            "control_id": "guard-cover",
            "axis": "X",
            "closed_degrees": 0.0,
            "open_degrees": -76.0,
            "default_state": "open",
        },
    )
    cover = rounded_box(
        "Guard_Cover_Clear_Shell",
        (0.23, 0.235, 0.052),
        mats["guard_glass"],
        guard,
        (0, -0.105, 0.028),
        bevel=0.025,
    )
    cover["hit_target"] = True
    rounded_box("Guard_Cover_Front_Rail", (0.23, 0.025, 0.065), mats["guard_frame"], guard, (0, -0.215, 0.028), bevel=0.008)
    rounded_box("Guard_Cover_Left_Rail", (0.025, 0.215, 0.065), mats["guard_frame"], guard, (-0.103, -0.105, 0.028), bevel=0.008)
    rounded_box("Guard_Cover_Right_Rail", (0.025, 0.215, 0.065), mats["guard_frame"], guard, (0.103, -0.105, 0.028), bevel=0.008)
    cylinder("Guard_Cover_Hinge_Barrel", 0.023, 0.26, mats["metal"], guard, (0, 0, 0), (0, math.radians(90), 0), bevel=0.005)
    rounded_box("Guard_Hinge_Mount_Left", (0.055, 0.055, 0.038), mats["black"], module, (-0.105, 0.265, 0.118), (DECK_TILT, 0, 0), bevel=0.010)
    rounded_box("Guard_Hinge_Mount_Right", (0.055, 0.055, 0.038), mats["black"], module, (0.105, 0.265, 0.118), (DECK_TILT, 0, 0), bevel=0.010)
    return button, guard


def add_pedestal(name, module, mats):
    rounded_box(name, (0.48, 0.52, 0.78), mats["body"], module, (0, 0.05, -0.58), bevel=0.08)
    rounded_box(f"{name}_Foot", (0.54, 0.56, 0.08), mats["black"], module, (0, 0.05, -0.98), bevel=0.035)


def create_asset():
    reset_scene()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    PUBLIC_MODEL_DIR.mkdir(parents=True, exist_ok=True)

    mats = {
        "body": material("MAT_Body_Charcoal", (0.035, 0.043, 0.048), metallic=0.18, roughness=0.36),
        "panel": material("MAT_Panel_Dark", (0.055, 0.062, 0.066), metallic=0.08, roughness=0.42),
        "metal": material("MAT_Brushed_Metal", (0.34, 0.36, 0.37), metallic=0.82, roughness=0.27),
        "black": material("MAT_Control_Black", (0.012, 0.014, 0.016), metallic=0.12, roughness=0.31),
        "switch": material("MAT_Radio_Button", (0.10, 0.11, 0.115), metallic=0.18, roughness=0.28),
        "cyan": material("MAT_Cyan_Accent", (0.015, 0.20, 0.24), metallic=0.15, roughness=0.24, emission=(0.02, 0.45, 0.55)),
        "amber": material("MAT_Amber_Accent", (0.95, 0.42, 0.045), metallic=0.12, roughness=0.24, emission=(0.60, 0.13, 0.01)),
        "label": material("MAT_Submit_Label", (0.025, 0.018, 0.01), metallic=0.0, roughness=0.5),
        "hit": material("MAT_Invisible_Hit_Target", (0.0, 0.0, 0.0), alpha=0.0),
        "guard_glass": material("MAT_Guard_Clear_Amber", (0.42, 0.18, 0.035), metallic=0.02, roughness=0.12, alpha=0.46),
        "guard_frame": material("MAT_Guard_Frame", (0.23, 0.08, 0.018), metallic=0.45, roughness=0.25),
    }

    root = empty(
        "Mission_Control_Workbench",
        props={
            "asset_version": "2.0.0",
            "units": "meters",
            "up_axis": "Y after glTF export",
            "target_runtime": "Three.js WebXR",
        },
    )

    curved_shell(
        "Workbench_Continuous_Body",
        SHELL_INNER_RADIUS,
        SHELL_OUTER_RADIUS,
        0.56,
        0.56,
        0.82,
        0.94,
        mats["body"],
        root,
        bevel=0.045,
    )
    curved_shell(
        "Workbench_Continuous_Deck",
        SHELL_INNER_RADIUS - 0.015,
        SHELL_OUTER_RADIUS + 0.015,
        0.81,
        0.93,
        0.85,
        0.97,
        mats["panel"],
        root,
        bevel=0.024,
    )
    curved_shell(
        "Workbench_Front_Trim",
        SHELL_INNER_RADIUS - 0.035,
        SHELL_INNER_RADIUS + 0.015,
        0.77,
        0.77,
        0.84,
        0.85,
        mats["metal"],
        root,
        bevel=0.012,
    )

    stations = [create_control_station(root, index, angle) for index, angle in enumerate(ARC_ANGLES)]
    knob_station = create_knob_station(root)
    add_pedestal("Pedestal_Left", stations[0], mats)
    add_pedestal("Pedestal_Right", stations[4], mats)
    create_knob(knob_station, mats)

    radio_number = 1
    for group_index, station in enumerate(stations[1:4], start=1):
        rounded_box(
            f"Radio_Group_{group_index:02d}_Inset",
            (0.61, 0.58, 0.012),
            mats["black"],
            station,
            (0, 0.015, 0.088),
            (DECK_TILT, 0, 0),
            bevel=0.025,
        )
        screen = create_screen(
            f"Screen_Group_{group_index:02d}",
            f"group-{group_index:02d}",
            station,
            0,
            0.20,
            0.50,
            mats,
        )
        screen["control_group"] = group_index
        for option_index, x in enumerate((-0.17, 0, 0.17), start=1):
            radio = create_radio_button(station, radio_number, group_index, option_index, x, mats)
            radio["control_group"] = group_index
            radio_number += 1

    create_submit_button(stations[4], mats)
    create_guarded_button(stations[4], mats)

    # Studio-only rendering setup. Cameras and lights are excluded from GLB export.
    bpy.ops.object.camera_add(location=(0, -5.05, 2.65))
    camera = bpy.context.object
    camera.name = "Preview_Camera"
    camera.data.lens = 44
    point_camera(camera, Vector((0, -0.12, 0.55)))
    bpy.context.scene.camera = camera

    add_area_light("Key_Light", (0, -2.2, 4.2), 340, 4.0, (0.72, 0.84, 0.95), Vector((0, 0, 0.5)))
    add_area_light("Fill_Light", (-3.2, -1.0, 2.2), 150, 3.0, (0.28, 0.50, 0.68), Vector((0, 0, 0.6)))
    add_area_light("Rim_Light", (3.0, 1.3, 2.8), 260, 3.0, (1.0, 0.42, 0.12), Vector((0.3, 0, 0.8)))

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1600
    scene.render.resolution_y = 1000
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(PREVIEW_PATH)
    scene.render.film_transparent = False
    scene.world.color = (0.008, 0.012, 0.016)
    scene.view_settings.look = "AgX - Medium High Contrast"

    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
    bpy.ops.render.render(write_still=True)

    # Export only the asset hierarchy, with custom properties available as userData.
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for child in root.children_recursive:
        child.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(
        filepath=str(GLB_PATH),
        export_format="GLB",
        use_selection=True,
        export_extras=True,
        export_cameras=False,
        export_lights=False,
        export_apply=True,
    )
    print(f"Saved {BLEND_PATH}")
    print(f"Saved {GLB_PATH}")
    print(f"Saved {PREVIEW_PATH}")


def point_camera(obj, target):
    direction = target - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def add_area_light(name, location, energy, size, color, target):
    bpy.ops.object.light_add(type="AREA", location=location)
    light = bpy.context.object
    light.name = name
    light.data.energy = energy
    light.data.shape = "DISK"
    light.data.size = size
    light.data.color = color
    point_camera(light, target)
    return light


if __name__ == "__main__":
    create_asset()

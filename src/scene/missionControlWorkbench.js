import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const AXES = {
  X: new THREE.Vector3(1, 0, 0),
  Y: new THREE.Vector3(0, 1, 0),
  Z: new THREE.Vector3(0, 0, 1),
};
const DEFAULT_MODEL_URL = `${import.meta.env.BASE_URL}assets/models/mission-control-workbench.glb`;

/**
 * Load and control the named, articulated Mission Control workbench GLB.
 *
 * The GLB stores interaction metadata in glTF extras. GLTFLoader exposes those
 * values as Object3D.userData, so the model remains usable without this helper.
 */
export async function loadMissionControlWorkbench({
  url = DEFAULT_MODEL_URL,
  onControl = () => {},
} = {}) {
  const gltf = await new GLTFLoader().loadAsync(url);
  return new MissionControlWorkbench(gltf.scene, onControl);
}

export class MissionControlWorkbench {
  constructor(root, onControl = () => {}) {
    this.root = root;
    this.onControl = onControl;
    this.controls = new Map();
    this.screens = new Map();
    this.radioGroups = new Map();
    this.disabledControls = new Set();
    this.activeTweens = [];

    root.traverse((object) => {
      if (object.userData?.role === "interactive_control") {
        const id = object.userData.control_id;
        object.userData.restPosition = object.position.clone();
        object.userData.restQuaternion = object.quaternion.clone();
        object.userData.value = defaultControlValue(object.userData);
        this.controls.set(id, object);
        if (object.userData.interaction === "radio_button") {
          object.traverse((child) => {
            if (child.isMesh && child.name.endsWith("_Indicator") && child.material) {
              child.material = child.material.clone();
              object.userData.indicatorMesh = child;
            }
          });
          const groupId = object.userData.radio_group;
          const group = this.radioGroups.get(groupId) ?? [];
          group.push(object);
          this.radioGroups.set(groupId, group);
        }
      }

      if (object.userData?.role === "screen") {
        const id = object.userData.screen_id;
        if (object.material) {
          object.material = object.material.clone();
          object.material.side = THREE.DoubleSide;
          object.material.toneMapped = false;
        }
        this.screens.set(id, object);
      }
    });

    for (const [groupId, controls] of this.radioGroups) {
      const selected = controls.find((control) => control.userData.default_selected) ?? controls[0];
      this.setRadioSelected(groupId, selected.userData.control_id, { emit: false, animate: false });
    }

    root.traverse((object) => {
      if (!object.isMesh) return;
      const control = this.resolveControl(object);
      if (!control) return;
      object.userData.kind = "mission-control";
      object.userData.controlId = `mission-control:${control.userData.control_id}`;
      object.userData.missionControlId = control.userData.control_id;
    });
  }

  getControl(id) {
    return this.controls.get(id) ?? null;
  }

  getScreen(id) {
    return this.screens.get(id) ?? null;
  }

  getInteractiveMeshes() {
    const meshes = [];
    this.root.traverse((object) => {
      if (object.isMesh && this.resolveControl(object)) meshes.push(object);
    });
    return meshes;
  }

  resolveControl(object) {
    let current = object;
    while (current && current !== this.root.parent) {
      if (current.userData?.role === "interactive_control") return current;
      current = current.parent;
    }
    return null;
  }

  activateFromObject(object) {
    const control = this.resolveControl(object);
    if (!control) return false;
    return this.activate(control.userData.control_id);
  }

  controlIdFromObject(object) {
    const control = this.resolveControl(object);
    return control?.userData.control_id ?? null;
  }

  activate(id) {
    const control = this.getControl(id);
    if (!control || this.disabledControls.has(id)) return false;

    const { interaction } = control.userData;
    if (interaction === "radio_button") {
      this.setRadioSelected(control.userData.radio_group, id);
    } else if (interaction === "momentary_button") {
      if (!this.canActivate(control)) return false;
      this.pressButton(id);
    } else if (interaction === "hinged_cover") {
      this.setGuardOpen(id, control.userData.value !== "open");
    } else if (interaction === "rotary") {
      this.nudgeKnob(id, 1);
    } else {
      return false;
    }
    return true;
  }

  canActivate(control) {
    if (this.disabledControls.has(control.userData.control_id)) return false;
    const requiredId = control.userData.requires_control;
    if (!requiredId) return true;
    const required = this.getControl(requiredId);
    return required?.userData.value === control.userData.requires_state;
  }

  setControlDisabled(id, disabled) {
    const nextDisabled = Boolean(disabled);
    if (this.disabledControls.has(id) === nextDisabled) return;
    if (nextDisabled) this.disabledControls.add(id);
    else this.disabledControls.delete(id);
    const control = this.getControl(id);
    if (!control) return;
    control.traverse((object) => {
      object.userData.disabled = nextDisabled;
      if (!object.isMesh || !object.material) return;
      object.material = object.material.clone();
      object.material.opacity = nextDisabled ? 0.42 : 1;
      object.material.transparent = nextDisabled;
      object.material.needsUpdate = true;
    });
  }

  setRadioSelected(groupId, selectedId, { emit = true, animate = true } = {}) {
    const group = this.radioGroups.get(groupId);
    if (!group?.some((control) => control.userData.control_id === selectedId)) return false;

    for (const control of group) {
      const selected = control.userData.control_id === selectedId;
      const axis = localAxis(control).applyQuaternion(control.userData.restQuaternion);
      const travel = Number(control.userData.travel_meters ?? 0.012);
      const target = control.userData.restPosition.clone().addScaledVector(axis, selected ? -travel : 0);
      if (animate) this.tweenPosition(control, target, selected ? 0.07 : 0.10);
      else control.position.copy(target);
      const indicator = control.userData.indicatorMesh;
      if (indicator?.material) {
        indicator.material.color.set(selected ? "#3fd8ed" : "#69747a");
        indicator.material.emissive.set(selected ? "#1595aa" : "#000000");
        indicator.material.emissiveIntensity = selected ? 1.8 : 0;
      }
      control.userData.value = selected;
    }

    const selectedControl = this.getControl(selectedId);
    if (emit) this.emit(selectedControl, true, { group: groupId });
    return true;
  }

  setGuardOpen(id = "guard-cover", open, { emit = true } = {}) {
    const control = this.getControl(id);
    if (!control || control.userData.interaction !== "hinged_cover") return;
    const openDegrees = Number(control.userData.open_degrees);
    const closedDegrees = Number(control.userData.closed_degrees);
    const targetDegrees = open ? openDegrees : closedDegrees;
    const defaultDegrees = control.userData.default_state === "open" ? openDegrees : closedDegrees;
    this.tweenLocalRotation(control, targetDegrees - defaultDegrees, 0.2);
    control.userData.value = open ? "open" : "closed";
    if (emit) this.emit(control, control.userData.value);
  }

  pressButton(id, { emit = true } = {}) {
    const control = this.getControl(id);
    if (!control || control.userData.interaction !== "momentary_button" || !this.canActivate(control)) return false;

    const axis = localAxis(control).applyQuaternion(control.userData.restQuaternion);
    const travel = Number(control.userData.travel_meters ?? 0.012);
    const pressed = control.userData.restPosition.clone().addScaledVector(axis, -travel);
    this.tweenPosition(control, pressed, 0.055, () => {
      this.tweenPosition(control, control.userData.restPosition, 0.11);
    });
    control.userData.value = "pressed";
    if (emit) this.emit(control, "pressed");
    return true;
  }

  setKnobNormalized(id = "knob-main", normalized, { emit = true, animate = true } = {}) {
    const control = this.getControl(id);
    if (!control || control.userData.interaction !== "rotary") return;
    const value = THREE.MathUtils.clamp(normalized, 0, 1);
    const min = Number(control.userData.min_degrees);
    const max = Number(control.userData.max_degrees);
    const degrees = THREE.MathUtils.lerp(min, max, value);
    if (animate) this.tweenLocalRotation(control, degrees, 0.08);
    else {
      this.activeTweens = this.activeTweens.filter((item) => item.owner !== control);
      this.setLocalRotation(control, degrees);
    }
    control.userData.value = value;
    if (emit) this.emit(control, value, { degrees });
  }

  setKnobFromWorldPoint(id = "knob-main", worldPoint, { emit = true, animate = true, steps = 0 } = {}) {
    const control = this.getControl(id);
    if (!control || control.userData.interaction !== "rotary" || !worldPoint) return false;
    const local = restLocalPointFromWorldPoint(control, worldPoint);
    const { u, v } = controlPlaneCoordinates(control, local);
    const radius = Math.hypot(u, v);
    if (radius < 0.025) return false;
    const min = Number(control.userData.min_degrees);
    const max = Number(control.userData.max_degrees);
    const degrees = THREE.MathUtils.clamp(-THREE.MathUtils.radToDeg(Math.atan2(u, v)), min, max);
    let normalized = (degrees - min) / (max - min);
    if (steps > 1) normalized = Math.round(normalized * (steps - 1)) / (steps - 1);
    this.setKnobNormalized(id, normalized, { emit, animate });
    return true;
  }

  controlPlane(id) {
    const control = this.getControl(id);
    if (!control) return null;
    const parentWorldQuaternion = control.parent.getWorldQuaternion(new THREE.Quaternion());
    const restWorldQuaternion = parentWorldQuaternion.multiply(control.userData.restQuaternion);
    const normal = localAxis(control).applyQuaternion(restWorldQuaternion).normalize();
    const origin = control.parent.localToWorld(control.userData.restPosition.clone());
    return new THREE.Plane().setFromNormalAndCoplanarPoint(normal, origin);
  }

  nudgeKnob(id = "knob-main", direction = 1, { emit = true } = {}) {
    const control = this.getControl(id);
    if (!control || control.userData.interaction !== "rotary") return;
    const min = Number(control.userData.min_degrees);
    const max = Number(control.userData.max_degrees);
    const step = Number(control.userData.step_degrees);
    const currentDegrees = THREE.MathUtils.lerp(min, max, Number(control.userData.value));
    const nextDegrees = THREE.MathUtils.clamp(currentDegrees + Math.sign(direction) * step, min, max);
    this.setKnobNormalized(id, (nextDegrees - min) / (max - min), { emit });
  }

  setScreenTexture(id, texture, { colorSpace = THREE.SRGBColorSpace } = {}) {
    const screen = this.getScreen(id);
    if (!screen) throw new Error(`Unknown workbench screen: ${id}`);
    const oldMap = screen.material.map;
    texture.colorSpace = colorSpace;
    texture.flipY = false;
    texture.anisotropy = 16;
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    screen.material.map = texture;
    screen.material.emissiveMap = texture;
    screen.material.side = THREE.DoubleSide;
    screen.material.toneMapped = false;
    screen.material.color.set("white");
    screen.material.emissive.set("white");
    screen.material.emissiveIntensity = 1.35;
    screen.material.needsUpdate = true;
    if (oldMap && oldMap !== texture) oldMap.dispose();
  }

  setScreenCanvas(id, canvas) {
    this.setScreenTexture(id, new THREE.CanvasTexture(canvas));
  }

  setScreenColor(id, color, emissiveIntensity = 1.5) {
    const screen = this.getScreen(id);
    if (!screen) throw new Error(`Unknown workbench screen: ${id}`);
    const oldMap = screen.material.map;
    screen.material.map = null;
    screen.material.emissiveMap = null;
    screen.material.side = THREE.DoubleSide;
    screen.material.toneMapped = false;
    screen.material.color.set(color);
    screen.material.emissive.set(color);
    screen.material.emissiveIntensity = emissiveIntensity;
    screen.material.needsUpdate = true;
    if (oldMap) oldMap.dispose();
  }

  update(deltaSeconds) {
    for (let index = this.activeTweens.length - 1; index >= 0; index -= 1) {
      const tween = this.activeTweens[index];
      tween.elapsed += deltaSeconds;
      const t = THREE.MathUtils.clamp(tween.elapsed / tween.duration, 0, 1);
      tween.apply(t * t * (3 - 2 * t));
      if (t >= 1) {
        this.activeTweens.splice(index, 1);
        tween.complete?.();
      }
    }
  }

  emit(control, value, detail = {}) {
    this.onControl({
      id: control.userData.control_id,
      interaction: control.userData.interaction,
      value,
      ...detail,
    });
  }

  tweenLocalRotation(control, degrees, duration) {
    const start = control.quaternion.clone();
    const target = this.localRotationQuaternion(control, degrees);
    this.replaceTween(control, {
      owner: control,
      elapsed: 0,
      duration,
      apply: (t) => control.quaternion.slerpQuaternions(start, target, t),
    });
  }

  setLocalRotation(control, degrees) {
    control.quaternion.copy(this.localRotationQuaternion(control, degrees));
  }

  localRotationQuaternion(control, degrees) {
    const offset = new THREE.Quaternion().setFromAxisAngle(localAxis(control), THREE.MathUtils.degToRad(degrees));
    return control.userData.restQuaternion.clone().multiply(offset);
  }

  tweenPosition(control, target, duration, complete) {
    const start = control.position.clone();
    this.replaceTween(control, {
      owner: control,
      elapsed: 0,
      duration,
      apply: (t) => control.position.lerpVectors(start, target, t),
      complete,
    });
  }

  replaceTween(control, tween) {
    this.activeTweens = this.activeTweens.filter((item) => item.owner !== control);
    this.activeTweens.push(tween);
  }
}

function localAxis(control) {
  return (AXES[control.userData.axis] ?? AXES.Z).clone();
}

function restLocalPointFromWorldPoint(control, worldPoint) {
  control.parent.updateWorldMatrix(true, false);
  const parentLocal = control.parent.worldToLocal(worldPoint.clone());
  const offset = parentLocal.sub(control.userData.restPosition);
  return offset.applyQuaternion(control.userData.restQuaternion.clone().invert());
}

function controlPlaneCoordinates(control, local) {
  const axis = control.userData.axis;
  if (axis === "X") return { u: local.z, v: local.y };
  if (axis === "Y") return { u: local.x, v: -local.z };
  return { u: local.x, v: local.y };
}

function defaultControlValue(data) {
  if (data.interaction === "radio_button") return false;
  if (data.interaction === "hinged_cover") return data.default_state;
  if (data.interaction === "rotary") {
    const min = Number(data.min_degrees);
    const max = Number(data.max_degrees);
    return (0 - min) / (max - min);
  }
  return "idle";
}

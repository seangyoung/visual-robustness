import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const MODEL_URL = new URL("../../assets/models/mission-control-workbench.glb", import.meta.url).href;
const AXES = {
  X: new THREE.Vector3(1, 0, 0),
  Y: new THREE.Vector3(0, 1, 0),
  Z: new THREE.Vector3(0, 0, 1),
};
const DEFAULT_SCREEN_COLOR = "#52c7d5";

export async function loadMissionControlWorkbench({ onControl } = {}) {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(MODEL_URL);
  const root = gltf.scene;
  const controls = new Map();
  const controlByObject = new Map();
  const screens = new Map();
  const interactiveMeshes = [];
  const screenMaterials = new Map();

  root.traverse((object) => {
    const extras = object.userData ?? {};
    if (extras.role === "interactive_control" && extras.control_id) {
      const control = createControlRuntime(object, extras, onControl);
      controls.set(extras.control_id, control);
      object.traverse((child) => {
        if (!child.isMesh) return;
        child.userData.missionControlId = extras.control_id;
        child.userData.controlId = `mission-control:${extras.control_id}`;
        child.userData.kind = "mission-control";
        controlByObject.set(child, control);
        interactiveMeshes.push(child);
      });
    }

    if (extras.role === "screen" && extras.screen_id && object.isMesh) {
      object.material = object.material.clone();
      object.material.color?.set(DEFAULT_SCREEN_COLOR);
      object.material.emissive?.set("#102a2e");
      object.material.emissiveIntensity = 0.35;
      object.material.toneMapped = false;
      screens.set(extras.screen_id, object);
      screenMaterials.set(extras.screen_id, object.material);
    }
  });

  root.traverse((object) => {
    if (!object.isMesh || !object.userData?.hit_target) return;
    const control = findAncestorControl(object, controls);
    if (!control || controlByObject.has(object)) return;
    object.userData.missionControlId = control.id;
    object.userData.controlId = `mission-control:${control.id}`;
    object.userData.kind = "mission-control";
    controlByObject.set(object, control);
    interactiveMeshes.push(object);
  });

  root.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
  });

  return {
    root,
    controls,
    getInteractiveMeshes: () => interactiveMeshes,
    controlFromObject: (object) => {
      let current = object;
      while (current) {
        const direct = controlByObject.get(current);
        if (direct) return direct;
        current = current.parent;
      }
      return null;
    },
    activateFromObject(object) {
      const control = this.controlFromObject(object);
      if (!control || control.disabled) return null;
      control.activate();
      return control.id;
    },
    setControlDisabled(id, disabled) {
      const control = controls.get(id);
      if (control) control.disabled = Boolean(disabled);
    },
    setKnobNormalized(value) {
      const control = controls.get("knob-main");
      if (!control) return;
      control.setNormalized(value);
    },
    setToggle(id, value) {
      const control = controls.get(id);
      if (!control) return;
      control.setToggle(Boolean(value), { emit: false });
    },
    setGuardOpen(open) {
      const control = controls.get("guard-cover");
      if (!control) return;
      control.setOpen(Boolean(open), { emit: false });
    },
    setScreenCanvas(id, canvas) {
      const material = screenMaterials.get(id);
      if (!material) return;
      const oldMap = material.map;
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 4;
      material.map = texture;
      material.color?.set("#ffffff");
      material.needsUpdate = true;
      if (oldMap) oldMap.dispose();
    },
    setScreenColor(id, color) {
      const material = screenMaterials.get(id);
      if (!material) return;
      if (material.map) {
        material.map.dispose();
        material.map = null;
      }
      material.color?.set(color);
      material.needsUpdate = true;
    },
    update(deltaSeconds) {
      controls.forEach((control) => control.update(deltaSeconds));
    },
  };
}

function createControlRuntime(object, extras, onControl) {
  const id = extras.control_id;
  const axis = AXES[extras.axis] ?? AXES.Z;
  const baseQuaternion = object.quaternion.clone();
  const runtime = {
    id,
    object,
    interaction: extras.interaction,
    extras,
    disabled: false,
    value: defaultControlValue(extras),
    pressTimer: 0,
    update(deltaSeconds) {
      if (this.pressTimer <= 0) return;
      this.pressTimer = Math.max(0, this.pressTimer - deltaSeconds);
      if (this.pressTimer === 0 && this.interaction === "momentary_button") {
        setObjectOffset(object, baseQuaternion, axis, 0, 0);
      }
    },
    activate() {
      if (this.disabled) return;
      if (this.interaction === "toggle") {
        this.setToggle(!this.value, { emit: true });
        return;
      }
      if (this.interaction === "hinged_cover") {
        this.setOpen(this.value !== "open", { emit: true });
        return;
      }
      if (this.interaction === "rotary") {
        const step = Number(extras.step_degrees) || 15;
        const min = Number(extras.min_degrees) || -135;
        const max = Number(extras.max_degrees) || 135;
        const nextDegrees = Math.min(max, Math.max(min, this.degrees + step));
        const wrapped = nextDegrees >= max ? min : nextDegrees;
        this.setDegrees(wrapped, { emit: true });
        return;
      }
      if (this.interaction === "momentary_button") {
        this.press({ emit: true });
      }
    },
    setToggle(value, { emit = true } = {}) {
      this.value = Boolean(value);
      const degrees = this.value ? Number(extras.on_degrees) : Number(extras.off_degrees);
      setObjectOffset(object, baseQuaternion, axis, THREE.MathUtils.degToRad(degrees), 0);
      if (emit) onControl?.({ id, type: "toggle", value: this.value });
    },
    setOpen(open, { emit = true } = {}) {
      this.value = open ? "open" : "closed";
      const key = open ? "open_degrees" : "closed_degrees";
      setObjectOffset(object, baseQuaternion, axis, THREE.MathUtils.degToRad(Number(extras[key]) || 0), 0);
      if (emit) onControl?.({ id, type: "hinged_cover", value: this.value });
    },
    setNormalized(value, { emit = false } = {}) {
      const normalized = THREE.MathUtils.clamp(Number(value) || 0, 0, 1);
      const min = Number(extras.min_degrees) || -135;
      const max = Number(extras.max_degrees) || 135;
      this.setDegrees(min + normalized * (max - min), { emit });
    },
    setDegrees(degrees, { emit = true } = {}) {
      const min = Number(extras.min_degrees) || -135;
      const max = Number(extras.max_degrees) || 135;
      this.degrees = THREE.MathUtils.clamp(Number(degrees) || 0, min, max);
      this.value = (this.degrees - min) / (max - min);
      setObjectOffset(object, baseQuaternion, axis, THREE.MathUtils.degToRad(this.degrees), 0);
      if (emit) onControl?.({ id, type: "rotary", value: this.value, degrees: this.degrees });
    },
    press({ emit = true } = {}) {
      if (extras.requires_control === "guard-cover" && extras.requires_state === "open") {
        // The physical guard is decorative in this prototype; the runtime check remains for future mappings.
      }
      const travel = Number(extras.travel_meters) || 0.016;
      setObjectOffset(object, baseQuaternion, axis, 0, -travel);
      this.pressTimer = 0.18;
      if (emit) onControl?.({ id, type: "momentary_button", value: true });
    },
  };

  if (runtime.interaction === "toggle") runtime.setToggle(Boolean(extras.default_state), { emit: false });
  if (runtime.interaction === "hinged_cover") runtime.setOpen(extras.default_state !== "closed", { emit: false });
  if (runtime.interaction === "rotary") runtime.setDegrees(Number(extras.min_degrees) || -135, { emit: false });
  return runtime;
}

function defaultControlValue(extras) {
  if (extras.interaction === "toggle") return Boolean(extras.default_state);
  if (extras.interaction === "hinged_cover") return extras.default_state ?? "closed";
  return 0;
}

function setObjectOffset(object, baseQuaternion, axis, radians, translation) {
  object.quaternion.copy(baseQuaternion);
  if (radians) object.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(axis, radians));
  object.position.copy(object.userData.basePosition ?? object.position);
  if (!object.userData.basePosition) object.userData.basePosition = object.position.clone();
  if (translation) object.position.add(axis.clone().multiplyScalar(translation));
}

function findAncestorControl(object, controls) {
  let current = object.parent;
  while (current) {
    const id = current.userData?.control_id;
    if (id && controls.has(id)) return controls.get(id);
    current = current.parent;
  }
  return null;
}

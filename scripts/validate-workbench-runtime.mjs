import assert from "node:assert/strict";
import * as THREE from "three";
import { MissionControlWorkbench } from "../src/scene/missionControlWorkbench.js";

const root = new THREE.Group();
const control = new THREE.Group();
control.name = "Control_Knob_Main";
control.userData = {
  role: "interactive_control",
  interaction: "rotary",
  control_id: "knob-main",
  axis: "Y",
  min_degrees: -135,
  max_degrees: 135,
  step_degrees: 15,
  push_travel_meters: 0.012,
  push_event: "reset",
};

const grip = new THREE.Object3D();
grip.userData.press_part = true;
control.add(grip);
const ring = new THREE.Mesh(
  new THREE.TorusGeometry(0.04, 0.005),
  new THREE.MeshStandardMaterial({ emissive: "#0a6775", emissiveIntensity: 1.5 }),
);
ring.name = "Knob_Main_Radial_Ring";
control.add(ring);
root.add(control);

const handle = new THREE.Group();
handle.userData = {
  role: "workbench_grab_handle",
  interaction: "translate",
  control_id: "workbench-grab-handle",
};
const handleHitTarget = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.1, 0.1));
handleHitTarget.userData.hit_target = true;
handle.add(handleHitTarget);
root.add(handle);

const events = [];
const workbench = new MissionControlWorkbench(root, (event) => events.push(event));
assert.equal(workbench.getGrabHandleMeshes().length, 1, "The workbench should expose one grab-handle hit target");
assert.equal(handleHitTarget.userData.kind, "workbench-grab-handle", "The grab handle must be tagged for runtime input");
assert.equal(
  Math.round(workbench.knobDegreesFromWorldPoint("knob-main", new THREE.Vector3(0.03, 0, 0))),
  -90,
  "A fingertip on the right side of the knob should resolve to its dial angle",
);
assert.equal(workbench.setKnobGrabbed("knob-main", true), true, "The knob should accept grab feedback");
assert(ring.scale.x > 1, "The knob ring should expand while grabbed");
assert(ring.material.emissiveIntensity >= 3.5, "The knob ring should brighten while grabbed");
workbench.setKnobGrabbed("knob-main", false);
assert.equal(ring.scale.x, 1, "The knob ring should return to its resting scale after release");
assert.equal(ring.material.emissiveIntensity, 1.5, "The knob ring should restore its resting brightness");
assert.equal(workbench.pressRotary("knob-main"), true, "The rotary control should accept a push");
workbench.setKnobNormalized("knob-main", 0, { emit: false });

workbench.update(0.04);
assert(control.userData.pressOffset < 0, "The knob should visibly depress");
assert.notDeepEqual(control.quaternion.toArray(), control.userData.restQuaternion.toArray(), "The knob should rotate while depressed");

for (let index = 0; index < 8; index += 1) workbench.update(0.04);
assert(Math.abs(control.userData.pressOffset) < 0.0001, "The knob should return after being pressed");
assert.equal(control.userData.value, 0, "The knob should finish at the baseline detent");
assert.equal(events[0]?.gesture, "push", "The knob should emit a push gesture");
assert.equal(events[0]?.event, "reset", "The knob push should emit the reset event");

console.log("Validated push-to-reset knob runtime behavior");

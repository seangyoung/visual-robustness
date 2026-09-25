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
root.add(control);

const events = [];
const workbench = new MissionControlWorkbench(root, (event) => events.push(event));
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

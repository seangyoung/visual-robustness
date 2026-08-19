import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const modelUrl = new URL("../public/assets/models/mission-control-workbench.glb", import.meta.url);
const bytes = await readFile(modelUrl);

assert.equal(bytes.toString("ascii", 0, 4), "glTF", "File is not a binary glTF");
assert.equal(bytes.readUInt32LE(4), 2, "Expected glTF 2.0");

const jsonChunkLength = bytes.readUInt32LE(12);
const jsonChunkType = bytes.toString("ascii", 16, 20);
assert.equal(jsonChunkType, "JSON", "The first GLB chunk must be JSON");

const gltf = JSON.parse(bytes.toString("utf8", 20, 20 + jsonChunkLength).trim());
const nodes = new Map((gltf.nodes ?? []).map((node) => [node.name, node]));

const requiredControls = [
  ["Control_Knob_Main", "knob-main", "rotary", "Y"],
  ...Array.from({ length: 9 }, (_, index) => [
    `Control_Radio_${String(index + 1).padStart(2, "0")}`,
    `radio-${String(index + 1).padStart(2, "0")}`,
    "radio_button",
    "Y",
  ]),
  ["Control_Button_Submit", "submit", "momentary_button", "Y"],
  ["Control_Guard_Cover", "guard-cover", "hinged_cover", "X"],
  ["Control_Button_Guarded", "guarded-secondary", "momentary_button", "Y"],
];

for (const [nodeName, controlId, interaction, axis] of requiredControls) {
  const node = nodes.get(nodeName);
  assert(node, `Missing control node ${nodeName}`);
  assert.equal(node.extras?.role, "interactive_control", `${nodeName} has the wrong role`);
  assert.equal(node.extras?.control_id, controlId, `${nodeName} has the wrong control_id`);
  assert.equal(node.extras?.interaction, interaction, `${nodeName} has the wrong interaction type`);
  assert.equal(node.extras?.axis, axis, `${nodeName} has the wrong local motion axis`);
}

for (const shellName of ["Workbench_Continuous_Body", "Workbench_Continuous_Deck", "Workbench_Front_Trim"]) {
  assert(nodes.has(shellName), `Missing continuous shell node ${shellName}`);
}
assert(
  ![...nodes.keys()].some((name) => /^Module_\d+_(Body|Deck|Trim)$/.test(name)),
  "Legacy overlapping module shells must not remain in the model",
);

for (let groupIndex = 1; groupIndex <= 3; groupIndex += 1) {
  const groupId = `radio-group-${String(groupIndex).padStart(2, "0")}`;
  const group = requiredControls
    .map(([nodeName]) => nodes.get(nodeName))
    .filter((node) => node?.extras?.radio_group === groupId);
  assert.equal(group.length, 3, `${groupId} must contain exactly three buttons`);
  assert.equal(
    group.filter((node) => node.extras?.default_selected).length,
    1,
    `${groupId} must have exactly one default selection`,
  );
}

const requiredScreens = [
  ["Screen_Knob", "knob-feedback"],
  ["Screen_Group_01", "group-01"],
  ["Screen_Group_02", "group-02"],
  ["Screen_Group_03", "group-03"],
];

const screenMaterials = new Set();
for (const [nodeName, screenId] of requiredScreens) {
  const node = nodes.get(nodeName);
  assert(node, `Missing screen node ${nodeName}`);
  assert.equal(node.extras?.role, "screen", `${nodeName} has the wrong role`);
  assert.equal(node.extras?.screen_id, screenId, `${nodeName} has the wrong screen_id`);
  const primitive = gltf.meshes?.[node.mesh]?.primitives?.[0];
  assert(primitive, `${nodeName} is missing its renderable mesh`);
  screenMaterials.add(primitive.material);
}
assert.equal(screenMaterials.size, requiredScreens.length, "Each screen must use a separate material");

const guardedButton = nodes.get("Control_Button_Guarded");
assert.equal(guardedButton.extras?.requires_control, "guard-cover");
assert.equal(guardedButton.extras?.requires_state, "open");

console.log(`Validated ${fileURLToPath(modelUrl)}`);
console.log(`${requiredControls.length} articulated controls, 3 exclusive radio groups, ${requiredScreens.length} addressable screens`);

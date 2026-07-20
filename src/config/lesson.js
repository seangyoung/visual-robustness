export const MODULE_TITLE = "Visual Robustness";
export const MODULE_SUBTITLE = "Module 1: Perceptual Accessibility in Data Visualization";

export const moduleScenes = [
  {
    id: "orientation",
    sceneNumber: 0,
    title: "Visualization Workbench",
    shortTitle: "Orientation",
    type: "orientation",
    duration: "1 min",
    prompt:
      "Inspect the workbench. Use normal pointer, touch, or headset movement to examine the figures, then use the workbench controls to test the design.",
    task:
      "No accessibility judgment yet. Learn the interaction pattern you will reuse across the module.",
    status: "Orientation: practice workbench controls before the visualization stress tests.",
    workbenchTitle: "Interaction rehearsal",
    defaultWorkbench: { robustness: 0, revealRedesign: false },
  },
  {
    id: "color-dependence",
    sceneNumber: 1,
    title: "Color Dependence",
    shortTitle: "Color",
    type: "color",
    duration: "3 min",
    prompt:
      "A land-cover map looks easy to read when the hue categories are separable. Which category dominates the watershed?",
    task:
      "Move the Robustness Test slightly. Notice when the answer becomes less certain, then reveal the redesign.",
    status: "Scene 1: hue-only encoding is being stress-tested.",
    workbenchTitle: "Watershed land-cover map",
    defaultWorkbench: { robustness: 0, revealRedesign: false },
    answer: "Wetland dominates the watershed.",
    reveal:
      "The redesign keeps color, but does not depend on color alone: patterns, labels, ordered value, and figure-ground separation make Wetland easier to recover.",
  },
  {
    id: "contrast-hierarchy",
    sceneNumber: 2,
    title: "Contrast and Hierarchy",
    shortTitle: "Contrast",
    type: "contrast",
    duration: "2 min",
    prompt:
      "A multivariate figure asks you to notice priority areas first. What information reaches your eye before the details?",
    task:
      "Increase the Robustness Test to flatten contrast and hierarchy. Then reveal a version with clearer grouping and value separation.",
    status: "Scene 2: contrast and hierarchy determine what becomes visible first.",
    workbenchTitle: "Priority areas and supporting context",
    defaultWorkbench: { robustness: 0, revealRedesign: false },
    reveal:
      "Hierarchy is not decoration. The robust version separates priority areas, supporting context, and labels so attention has a reliable path.",
  },
  {
    id: "robust-comparison",
    sceneNumber: 3,
    title: "Robust Design Comparison",
    shortTitle: "Rank",
    type: "comparison",
    duration: "3 min",
    prompt:
      "Three designs show the same message with different levels of perceptual robustness.",
    task:
      "Rank the designs. Browser: drag cards. VR: use A/B/C earlier or later, then Check.",
    status: "Scene 3: rank designs by robustness and inspect why each one succeeds or fails.",
    workbenchTitle: "Ranking bench",
    defaultWorkbench: { robustness: 55, revealRedesign: true },
  },
  {
    id: "reflection",
    sceneNumber: 4,
    title: "Reflection Notebook",
    shortTitle: "Reflect",
    type: "reflection",
    duration: "2 min",
    prompt:
      "Robust visualization design is a practical habit: meaning should survive changes in perception, display, and context.",
    task:
      "Answer the notebook prompts. You can download the responses locally or copy them into the course tool.",
    status: "Scene 4: connect the experience to your own visualization practice.",
    workbenchTitle: "Observation notebook",
    defaultWorkbench: { robustness: 0, revealRedesign: true },
  },
];

export const lessonSteps = moduleScenes;

export const landCoverCategories = [
  {
    id: "wetland",
    label: "Wetland",
    area: 38,
    shape: "circle",
    baseline: "#168f8a",
    compressed: "#8fa89a",
    redesign: "#0b6d68",
    note: "Dominant class",
  },
  {
    id: "forest",
    label: "Upland forest",
    area: 22,
    shape: "triangle",
    baseline: "#3c9f57",
    compressed: "#92a794",
    redesign: "#27764b",
    note: "Similar hue family",
  },
  {
    id: "developed",
    label: "Developed",
    area: 16,
    shape: "square",
    baseline: "#d46655",
    compressed: "#b39181",
    redesign: "#c84a3d",
    note: "High contrast in redesign",
  },
  {
    id: "agriculture",
    label: "Agriculture",
    area: 10,
    shape: "diamond",
    baseline: "#e1b64b",
    compressed: "#b5a174",
    redesign: "#d0a126",
    note: "Value cue added",
  },
  {
    id: "grassland",
    label: "Grassland",
    area: 8,
    shape: "hex",
    baseline: "#86b94e",
    compressed: "#9ca787",
    redesign: "#6c963d",
    note: "Often confused with forest",
  },
  {
    id: "water",
    label: "Open water",
    area: 6,
    shape: "wave",
    baseline: "#4979b8",
    compressed: "#8a9ea6",
    redesign: "#315f9f",
    note: "Separated by label and texture",
  },
];

export const watershedZones = [
  { id: "A", name: "Upper Fork", category: "forest", weight: 8 },
  { id: "B", name: "North Marsh", category: "wetland", weight: 12 },
  { id: "C", name: "Mill Creek", category: "wetland", weight: 9 },
  { id: "D", name: "West Fields", category: "agriculture", weight: 7 },
  { id: "E", name: "Town Edge", category: "developed", weight: 9 },
  { id: "F", name: "South Marsh", category: "wetland", weight: 10 },
  { id: "G", name: "Oak Slope", category: "grassland", weight: 5 },
  { id: "H", name: "Industrial Bend", category: "developed", weight: 7 },
  { id: "I", name: "Reservoir", category: "water", weight: 5 },
  { id: "J", name: "Delta Flats", category: "wetland", weight: 7 },
];

export const comparisonDesigns = [
  {
    id: "redundant",
    title: "Redundant encodings",
    label: "A",
    summary: "Colorblind-safe ramp, labels, patterns, and ordered value.",
    reason: "Meaning survives when hue is unreliable because multiple cues carry the class.",
  },
  {
    id: "simplified",
    title: "Fewer classes",
    label: "B",
    summary: "A reduced classification scheme lowers comparison burden.",
    reason: "Fewer groups help, but some meaning is still carried by hue and legend lookup.",
  },
  {
    id: "hue-only",
    title: "Hue-only categories",
    label: "C",
    summary: "Many similarly valued hues with a distant legend.",
    reason: "It is efficient in ideal conditions but fragile under color or contrast shifts.",
  },
];

export const recommendedComparisonRanking = ["redundant", "simplified", "hue-only"];

export const reflectionPrompts = [
  {
    id: "surprise",
    label: "What design decision surprised you most?",
    placeholder: "Example: I expected the original colors to be enough until the categories compressed.",
  },
  {
    id: "change",
    label: "What will you change in your own visualizations?",
    placeholder: "Example: I will add direct labels or texture when a category carries the argument.",
  },
  {
    id: "question",
    label: "What guideline would you now question?",
    placeholder: "Example: I would question using more categories just because the data supports them.",
  },
];

export const galleryCopy = {
  sideNote:
    "Perception varies across people, displays, lighting, fatigue, print/export workflows, and presentation rooms. Robust design preserves meaning when those conditions shift.",
  textEquivalent:
    "The module presents a visualization workbench with five scenes: orientation, color dependence, contrast and hierarchy, robust design comparison, and reflection. In Scene 1, a land-cover map begins as a hue-dependent design. The robustness control compresses color distinctions. The redesign uses labels, patterns, luminance, and stronger figure-ground separation.",
  assessment:
    "The app does not store identifiable student data. Course diagnostics, rubric scoring, and submitted reflections should be collected through the LMS, Qualtrics, or another approved external tool.",
};

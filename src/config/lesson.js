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
    prompt: "Practice the workbench controls before the design tasks begin.",
    task: "Inspect the figures. Use Next when ready.",
    status: "Orientation: practice the interaction pattern.",
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
    prompt: "Which land-cover category dominates the watershed?",
    task: "Move the Robustness Test, then reveal the redesign.",
    status: "Scene 1: color dependence.",
    workbenchTitle: "Watershed land-cover map",
    defaultWorkbench: { robustness: 0, revealRedesign: false },
    answer: "Wetland dominates the watershed.",
    reveal:
      "The redesign adds labels, patterns, value contrast, and stronger figure-ground separation.",
  },
  {
    id: "contrast-hierarchy",
    sceneNumber: 2,
    title: "Contrast and Hierarchy",
    shortTitle: "Contrast",
    type: "contrast",
    duration: "2 min",
    prompt: "What information reaches your eye first?",
    task: "Increase the Robustness Test, then reveal the redesign.",
    status: "Scene 2: contrast and hierarchy.",
    workbenchTitle: "Priority areas and supporting context",
    defaultWorkbench: { robustness: 0, revealRedesign: false },
    reveal:
      "The redesign separates priority areas, context, and labels.",
  },
  {
    id: "robust-comparison",
    sceneNumber: 3,
    title: "Robust Design Comparison",
    shortTitle: "Rank",
    type: "comparison",
    duration: "3 min",
    prompt: "Rank the three designs from most robust to least robust.",
    task: "Drag the cards into order, then Check.",
    status: "Scene 3: robust design comparison.",
    workbenchTitle: "Ranking bench",
    defaultWorkbench: { robustness: 55, revealRedesign: true },
  },
  {
    id: "reflection",
    sceneNumber: 4,
    title: "Course Reflection",
    shortTitle: "Close",
    type: "reflection",
    duration: "1 min",
    prompt: "Complete the reflection in the course tool after leaving the prototype.",
    task: "This app does not collect responses.",
    status: "Scene 4: external course reflection.",
    workbenchTitle: "Course handoff",
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

export const galleryCopy = {
  textEquivalent:
    "The module presents a visualization workbench with scenes on color dependence, contrast and hierarchy, robust design comparison, and an external course reflection handoff. The app does not collect student responses.",
};

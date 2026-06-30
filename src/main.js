import "./styles.css";
import { moduleScenes, reflectionPrompts } from "./config/lesson.js";
import { createGalleryApp } from "./scene/gallery.js";
import { createDomUi } from "./ui/dom.js";

const canvas = document.getElementById("xr-canvas");

const state = {
  sceneIndex: initialSceneIndex(),
  settings: {
    highContrast: false,
    reducedMotion: false,
  },
  workbench: {
    robustness: 0,
    revealRedesign: false,
  },
  ranking: ["redundant", "simplified", "hue-only"],
  reflections: Object.fromEntries(reflectionPrompts.map((prompt) => [prompt.id, ""])),
};

applySceneDefaults();
state.workbench = { ...state.workbench, ...initialWorkbenchOverrides() };

const ui = createDomUi({
  onAction(action, payload) {
    handleAction(action, payload);
  },
  onSettingsChange(settings) {
    state.settings = settings;
    render();
  },
  onWorkbenchChange(workbenchPatch) {
    state.workbench = { ...state.workbench, ...workbenchPatch };
    render();
  },
  onReflectionChange(reflectionPatch) {
    state.reflections = { ...state.reflections, ...reflectionPatch };
    render();
  },
});

const galleryApp = createGalleryApp({
  canvas,
  ui,
  onAction(action, payload) {
    handleAction(action, payload);
  },
});

ui.elements.enterVr.addEventListener("click", () => {
  galleryApp.enterVr();
});

render();

function handleAction(action, payload = {}) {
  if (action === "back") {
    state.sceneIndex = Math.max(0, state.sceneIndex - 1);
    applySceneDefaults();
  }

  if (action === "next") {
    state.sceneIndex = Math.min(moduleScenes.length - 1, state.sceneIndex + 1);
    applySceneDefaults();
  }

  if (action === "setRobustness") {
    state.workbench.robustness = clamp(Number(payload.value), 0, 100);
  }

  if (action === "adjustRobustness") {
    state.workbench.robustness = clamp(state.workbench.robustness + Number(payload.delta), 0, 100);
  }

  if (action === "toggleRedesign") {
    state.workbench.revealRedesign = !state.workbench.revealRedesign;
  }

  if (action === "setRedesign") {
    state.workbench.revealRedesign = Boolean(payload.value);
  }

  if (action === "moveRank") {
    moveRank(payload.id, payload.direction);
  }

  if (action === "exportReflection") {
    exportReflection();
  }

  syncUrl();
  render();
}

function render() {
  ui.render(state);
  galleryApp.renderState(state);
}

function applySceneDefaults() {
  const defaults = moduleScenes[state.sceneIndex]?.defaultWorkbench ?? {};

  state.workbench = {
    robustness: 0,
    revealRedesign: false,
    ...defaults,
  };
}

function moveRank(id, direction) {
  const index = state.ranking.indexOf(id);
  if (index < 0) return;
  const nextIndex = clamp(index + direction, 0, state.ranking.length - 1);
  if (nextIndex === index) return;
  const next = [...state.ranking];
  const [item] = next.splice(index, 1);
  next.splice(nextIndex, 0, item);
  state.ranking = next;
}

function exportReflection() {
  const scene = moduleScenes[state.sceneIndex];
  const lines = [
    MODULE_EXPORT_TITLE,
    `${scene.title}`,
    "",
    ...reflectionPrompts.flatMap((prompt) => [
      prompt.label,
      state.reflections[prompt.id]?.trim() || "[No response entered]",
      "",
    ]),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/plain" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "visual-robustness-reflection.txt";
  link.click();
  URL.revokeObjectURL(link.href);
}

function initialSceneIndex() {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get("scene") || params.get("step") || window.location.hash.replace("#", "");
  const byId = moduleScenes.findIndex((scene) => scene.id === requested);
  if (byId >= 0) return byId;
  const numeric = Number.parseInt(requested, 10);
  if (Number.isFinite(numeric)) return Math.max(0, Math.min(moduleScenes.length - 1, numeric));
  return 0;
}

function initialWorkbenchOverrides() {
  const params = new URLSearchParams(window.location.search);
  const overrides = {};
  const robustness = Number(params.get("robustness"));
  if (Number.isFinite(robustness)) overrides.robustness = clamp(robustness, 0, 100);
  if (params.has("reveal")) {
    overrides.revealRedesign = ["1", "true", "yes"].includes(params.get("reveal")?.toLowerCase());
  }
  return overrides;
}

function syncUrl() {
  const scene = moduleScenes[state.sceneIndex];
  const url = new URL(window.location.href);
  url.searchParams.delete("step");
  url.searchParams.delete("robustness");
  url.searchParams.delete("reveal");
  url.searchParams.set("scene", scene.id);
  window.history.replaceState({}, "", url);
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

const MODULE_EXPORT_TITLE = "Visual Robustness Reflection";

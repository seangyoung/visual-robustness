import "./styles.css";
import { moduleScenes, recommendedComparisonRanking } from "./config/lesson.js";
import {
  clampStressTestIndex,
  stressTestIndexById,
  stressTestIndexFromPercent,
} from "./config/stressTests.js";
import { createGalleryApp } from "./scene/gallery.js";
import { createDomUi } from "./ui/dom.js";
import { preloadVisualizationAssets } from "./visualizations/colorFragility.js";

const canvas = document.getElementById("xr-canvas");

const state = {
  sceneIndex: initialSceneIndex(),
  settings: {
    highContrast: false,
    reducedMotion: false,
  },
  workbench: {
    stressTestIndex: 0,
    revealRedesign: false,
  },
  ranking: ["hue-only", "redundant", "simplified"],
  rankingCheck: { attempts: 0, status: "idle" },
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
    state.workbench = { ...state.workbench, ...normalizeWorkbenchPatch(workbenchPatch) };
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
preloadVisualizationAssets()
  .then(render)
  .catch((error) => {
    ui.setStatus(error.message);
  });

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
    state.workbench.stressTestIndex = stressTestIndexFromPercent(payload.value);
  }

  if (action === "adjustRobustness") {
    const direction = Math.sign(Number(payload.delta));
    if (Number.isFinite(direction) && direction !== 0) {
      state.workbench.stressTestIndex = clampStressTestIndex(state.workbench.stressTestIndex + direction);
    }
  }

  if (action === "setStressTest") {
    state.workbench.stressTestIndex =
      payload.id !== undefined ? stressTestIndexById(payload.id) : clampStressTestIndex(payload.index);
  }

  if (action === "adjustStressTest") {
    const direction = Math.sign(Number(payload.delta));
    if (Number.isFinite(direction) && direction !== 0) {
      state.workbench.stressTestIndex = clampStressTestIndex(state.workbench.stressTestIndex + direction);
    }
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

  if (action === "setRanking") {
    setRanking(payload.ranking);
  }

  if (action === "checkRanking") {
    checkRanking();
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
    stressTestIndex: 0,
    revealRedesign: false,
    ...normalizeWorkbenchPatch(defaults),
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
  clearRankingFeedback();
}

function setRanking(ranking) {
  const validIds = new Set(state.ranking);
  const next = Array.isArray(ranking) ? ranking.filter((id) => validIds.has(id)) : [];
  if (next.length !== state.ranking.length) return;
  if (arraysEqual(next, state.ranking)) return;
  state.ranking = next;
  clearRankingFeedback();
}

function checkRanking() {
  const attempts = state.rankingCheck.attempts + 1;
  const isCorrect = arraysEqual(state.ranking, recommendedComparisonRanking);
  state.rankingCheck = {
    attempts,
    status: isCorrect ? "correct" : attempts >= 2 ? "reveal" : "hint",
  };
}

function clearRankingFeedback() {
  state.rankingCheck = { attempts: 0, status: "idle" };
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
  if (params.has("stress")) {
    const stress = params.get("stress");
    const numeric = Number(stress);
    overrides.stressTestIndex = Number.isFinite(numeric)
      ? clampStressTestIndex(numeric)
      : stressTestIndexById(stress);
  } else if (params.has("robustness")) {
    const robustness = Number(params.get("robustness"));
    if (Number.isFinite(robustness)) overrides.stressTestIndex = stressTestIndexFromPercent(robustness);
  }
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
  url.searchParams.delete("stress");
  url.searchParams.delete("reveal");
  url.searchParams.set("scene", scene.id);
  window.history.replaceState({}, "", url);
}

function normalizeWorkbenchPatch(workbench) {
  const patch = { ...workbench };
  if (patch.robustness !== undefined && patch.stressTestIndex === undefined) {
    patch.stressTestIndex = stressTestIndexFromPercent(patch.robustness);
  }
  delete patch.robustness;
  if (patch.stressTestIndex !== undefined) {
    patch.stressTestIndex = clampStressTestIndex(patch.stressTestIndex);
  }
  return patch;
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function arraysEqual(a, b) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

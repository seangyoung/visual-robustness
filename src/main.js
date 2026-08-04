import "./styles.css";
import { moduleScenes, recommendedComparisonRanking } from "./config/lesson.js";
import {
  MODULE_PHASES,
  allExamplesSubmitted,
  designSubmissionFeedback,
  modulePhaseFromParam,
} from "./config/moduleFlow.js";
import {
  defaultInterventions,
  interventionsFromParam,
  interventionsToParam,
  normalizeInterventions,
  setCueVariant,
  setLabelMode,
  setPaletteVariant,
  toggleIntervention,
} from "./config/interventions.js";
import {
  clampStressTestIndex,
  stressTestByIndex,
  stressTestIndexById,
  stressTestIndexFromPercent,
} from "./config/stressTests.js";
import {
  clampExampleIndex,
  nextVisualizationExampleIndex,
  visualizationExampleByIndex,
  visualizationExampleIndexById,
  visualizationExamples,
} from "./config/visualizationExamples.js";
import {
  randomTransferChallengeId,
  transferChallengeById,
  transferChallengeIdFromParam,
  transferChoiceById,
} from "./config/transferChallenges.js";
import { createGalleryApp } from "./scene/gallery.js";
import { createDomUi } from "./ui/dom.js";
import { preloadVisualizationAssets } from "./visualizations/colorFragility.js";

const canvas = document.getElementById("xr-canvas");

const state = {
  sceneIndex: initialSceneIndex(),
  modulePhase: initialModulePhase(),
  exampleIndex: initialExampleIndex(),
  challengeForced: initialChallengeForced(),
  selectedChallengeId: initialTransferChallengeId(),
  submittedExamples: initialSubmittedExamples(),
  exampleFeedback: {},
  transferAnswer: null,
  transferSubmitted: false,
  transferFeedback: null,
  settings: {
    highContrast: false,
    reducedMotion: false,
  },
  workbench: {
    stressTestIndex: 0,
    interventions: defaultInterventions(),
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
  if (action === "startModule") {
    startModule();
  }

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

  if (action === "toggleIntervention") {
    state.workbench.interventions = toggleIntervention(state.workbench.interventions, payload.key);
  }

  if (action === "setPaletteVariant") {
    state.workbench.interventions = setPaletteVariant(state.workbench.interventions, payload.variant);
  }

  if (action === "setCueVariant") {
    state.workbench.interventions = setCueVariant(state.workbench.interventions, payload.variant);
  }

  if (action === "setLabelMode") {
    state.workbench.interventions = setLabelMode(state.workbench.interventions, payload.mode);
  }

  if (action === "clearInterventions") {
    state.workbench.interventions = defaultInterventions();
  }

  if (action === "setExample") {
    state.exampleIndex = clampExampleIndex(payload.index);
    state.workbench.interventions = defaultInterventions();
  }

  if (action === "nextExample") {
    state.exampleIndex = nextVisualizationExampleIndex(state.exampleIndex);
    state.workbench.interventions = defaultInterventions();
  }

  if (action === "submitDesign") {
    submitCurrentDesign();
  }

  if (action === "continueToChallenge") {
    if (allExamplesSubmitted(state.submittedExamples, visualizationExamples)) {
      state.modulePhase = MODULE_PHASES.TRANSFER;
      state.transferAnswer = null;
      state.transferSubmitted = false;
      state.transferFeedback = null;
    }
  }

  if (action === "selectTransferAnswer") {
    const challenge = transferChallengeById(state.selectedChallengeId);
    const choice =
      payload.choiceId !== undefined
        ? transferChoiceById(challenge, payload.choiceId)
        : challenge.choices?.[Number(payload.choiceIndex)];
    if (!choice) return;
    state.transferAnswer = choice.id;
    if (state.transferSubmitted) {
      state.transferFeedback = transferFeedbackForChoice(challenge, choice.id);
    }
  }

  if (action === "submitTransferAnswer") {
    const challenge = transferChallengeById(state.selectedChallengeId);
    if (!transferChoiceById(challenge, state.transferAnswer)) return;
    state.transferSubmitted = true;
    state.transferFeedback = transferFeedbackForChoice(challenge, state.transferAnswer);
  }

  if (action === "continueToTakeaways") {
    if (state.transferSubmitted) state.modulePhase = MODULE_PHASES.TAKEAWAYS;
  }

  if (action === "restartModule") {
    restartModule();
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
    interventions: defaultInterventions(),
    ...normalizeWorkbenchPatch(defaults),
  };
}

function submitCurrentDesign() {
  const example = visualizationExampleByIndex(state.exampleIndex);

  state.exampleFeedback = {
    ...state.exampleFeedback,
    [example.id]: designSubmissionFeedback(example, state.workbench.interventions),
  };
  state.submittedExamples = {
    ...state.submittedExamples,
    [example.id]: true,
  };
}

function transferFeedbackForChoice(challenge, choiceId) {
  const choice = transferChoiceById(challenge, choiceId);
  if (!choice) return null;
  return {
    correct: choice.id === challenge.correctChoiceId,
    title: choice.id === challenge.correctChoiceId ? "That is the central issue." : "Look again at the encoding.",
    message: choice.feedback,
  };
}

function restartModule() {
  state.modulePhase = MODULE_PHASES.INTRO;
  state.sceneIndex = 0;
  state.exampleIndex = 0;
  state.submittedExamples = initialSubmittedExamples();
  state.exampleFeedback = {};
  state.transferAnswer = null;
  state.transferSubmitted = false;
  state.transferFeedback = null;
  if (!state.challengeForced) {
    state.selectedChallengeId = randomTransferChallengeId();
  }
  state.workbench = {
    stressTestIndex: 0,
    interventions: defaultInterventions(),
  };
}

function startModule() {
  state.modulePhase = MODULE_PHASES.EXAMPLES;
  state.sceneIndex = 0;
  state.exampleIndex = 0;
  state.workbench = {
    stressTestIndex: 0,
    interventions: defaultInterventions(),
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
  if (params.has("interventions")) {
    overrides.interventions = interventionsFromParam(params.get("interventions"));
  }
  return overrides;
}

function initialModulePhase() {
  const params = new URLSearchParams(window.location.search);
  return modulePhaseFromParam(params.get("phase"));
}

function initialChallengeForced() {
  const params = new URLSearchParams(window.location.search);
  return params.has("challenge");
}

function initialTransferChallengeId() {
  const params = new URLSearchParams(window.location.search);
  if (params.has("challenge")) {
    return transferChallengeIdFromParam(params.get("challenge"));
  }
  return randomTransferChallengeId();
}

function initialSubmittedExamples() {
  return Object.fromEntries(visualizationExamples.map((example) => [example.id, false]));
}

function initialExampleIndex() {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get("example");
  if (!requested) return 0;
  const numeric = Number.parseInt(requested, 10);
  if (Number.isFinite(numeric)) return clampExampleIndex(numeric - 1);
  return visualizationExampleIndexById(requested);
}

function syncUrl() {
  const scene = moduleScenes[state.sceneIndex];
  const example = visualizationExampleByIndex(state.exampleIndex);
  const url = new URL(window.location.href);
  url.searchParams.delete("step");
  url.searchParams.delete("robustness");
  url.searchParams.delete("stress");
  url.searchParams.delete("reveal");
  url.searchParams.delete("interventions");
  url.searchParams.delete("phase");
  if (!state.challengeForced) {
    url.searchParams.delete("challenge");
  }
  url.searchParams.set("scene", scene.id);
  if (state.modulePhase !== MODULE_PHASES.INTRO) {
    url.searchParams.set("phase", state.modulePhase);
  }
  if (state.challengeForced) {
    url.searchParams.set("challenge", state.selectedChallengeId);
  }
  if (state.exampleIndex === 0) {
    url.searchParams.delete("example");
  } else {
    url.searchParams.set("example", example.id);
  }
  const stressTestIndex = clampStressTestIndex(state.workbench.stressTestIndex);
  if (stressTestIndex > 0) {
    url.searchParams.set("stress", stressTestByIndex(stressTestIndex).id);
  }
  const interventionParam = interventionsToParam(state.workbench.interventions);
  if (interventionParam) {
    url.searchParams.set("interventions", interventionParam);
  }
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
  delete patch.revealRedesign;
  if (patch.interventions !== undefined) {
    patch.interventions = normalizeInterventions(patch.interventions);
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

import {
  comparisonDesigns,
  galleryCopy,
  moduleScenes,
  recommendedComparisonRanking,
} from "../config/lesson.js";
import {
  MODULE_PHASES,
  allExamplesSubmitted,
  confidenceOptions,
  finalTakeaways,
  introCopy,
} from "../config/moduleFlow.js";
import {
  INTERVENTION_KEYS,
  cueVariantFromInterventions,
  hasActiveInterventions,
  labelModeFromInterventions,
  normalizeInterventions,
  paletteVariantFromInterventions,
} from "../config/interventions.js";
import { clampStressTestIndex, stressTestByIndex, stressTests } from "../config/stressTests.js";
import {
  cueOptionsForExample,
  interventionMetadataForExample,
  labelOptionsForExample,
  paletteOptionsForExample,
  visualizationExampleByIndex,
  visualizationExamples,
} from "../config/visualizationExamples.js";
import {
  transferChallengeById,
  transferChoiceById,
} from "../config/transferChallenges.js";
import { createPanelTexture } from "../visualizations/colorFragility.js";

export function createDomUi({
  onAction,
  onWorkbenchChange,
}) {
  const elements = {
    body: document.body,
    modeLabel: document.getElementById("mode-label"),
    enterVr: document.getElementById("enter-vr"),
    browserWorkbench: document.getElementById("browser-workbench"),
    browserTaskKicker: document.getElementById("browser-task-kicker"),
    browserTaskTitle: document.getElementById("browser-task-title"),
    browserTaskLead: document.getElementById("browser-task-lead"),
    browserMapCanvas: document.getElementById("browser-map-canvas"),
    browserChartCanvas: document.getElementById("browser-chart-canvas"),
    stepKicker: document.getElementById("step-kicker"),
    stepTitle: document.getElementById("step-title"),
    stepPrompt: document.getElementById("step-prompt"),
    progressTrack: document.getElementById("progress-track"),
    progressFill: document.getElementById("progress-fill"),
    sceneNav: document.getElementById("scene-nav"),
    back: document.getElementById("back-step"),
    next: document.getElementById("next-step"),
    introControls: document.getElementById("intro-controls"),
    startModule: document.getElementById("start-module"),
    workbenchControls: document.getElementById("workbench-controls"),
    workbenchTitle: document.getElementById("workbench-title"),
    exampleControl: document.querySelector(".example-control"),
    exampleTabs: document.getElementById("example-tabs"),
    robustnessSlider: document.getElementById("robustness-slider"),
    robustnessValue: document.getElementById("robustness-value"),
    stressTestTicks: document.getElementById("stress-test-ticks"),
    originalDesign: document.getElementById("original-design"),
    interventionControls: document.getElementById("intervention-controls"),
    submissionPanel: document.getElementById("submission-panel"),
    confidenceControls: document.getElementById("confidence-controls"),
    submitDesign: document.getElementById("submit-design"),
    continueChallenge: document.getElementById("continue-challenge"),
    completionStatus: document.getElementById("completion-status"),
    transferControls: document.getElementById("transfer-controls"),
    transferChoices: document.getElementById("transfer-choices"),
    submitTransfer: document.getElementById("submit-transfer"),
    continueTakeaways: document.getElementById("continue-takeaways"),
    takeawayControls: document.getElementById("takeaway-controls"),
    restartModule: document.getElementById("restart-module"),
    rankingPanel: document.getElementById("ranking-panel"),
    rankingList: document.getElementById("ranking-list"),
    checkRanking: document.getElementById("check-ranking"),
    rankingFeedback: document.getElementById("ranking-feedback"),
    statusLine: document.getElementById("status-line"),
    textEquivalent: document.getElementById("text-equivalent"),
  };

  elements.back.addEventListener("click", () => onAction("back"));
  elements.next.addEventListener("click", () => onAction("next"));
  elements.startModule.addEventListener("click", () => onAction("startModule"));
  elements.robustnessSlider.addEventListener("input", (event) => {
    onWorkbenchChange({ stressTestIndex: Number(event.target.value) });
  });
  elements.originalDesign.addEventListener("click", () => onAction("clearInterventions"));
  elements.submitDesign.addEventListener("click", () => onAction("submitDesign"));
  elements.continueChallenge.addEventListener("click", () => onAction("continueToChallenge"));
  elements.submitTransfer.addEventListener("click", () => onAction("submitTransferAnswer"));
  elements.continueTakeaways.addEventListener("click", () => onAction("continueToTakeaways"));
  elements.restartModule.addEventListener("click", () => onAction("restartModule"));
  elements.checkRanking.addEventListener("click", () => onAction("checkRanking"));

  window.addEventListener("keydown", (event) => {
    if (event.altKey || event.metaKey || event.ctrlKey) return;
    const activeTag = document.activeElement?.tagName?.toLowerCase();
    if (activeTag === "input") return;
    if (event.key === "ArrowRight") onAction("next");
    if (event.key === "ArrowLeft") onAction("back");
  });

  elements.textEquivalent.textContent = galleryCopy.textEquivalent;
  elements.startModule.textContent = introCopy.startLabel;

  return {
    elements,
    render(state) {
      const scene = moduleScenes[state.sceneIndex];
      const phase = state.modulePhase ?? MODULE_PHASES.INTRO;
      const isIntroPhase = phase === MODULE_PHASES.INTRO;
      const isExamplePhase = phase === MODULE_PHASES.EXAMPLES;
      const isTransferPhase = phase === MODULE_PHASES.TRANSFER;
      const isTakeawayPhase = phase === MODULE_PHASES.TAKEAWAYS;
      const isLast = state.sceneIndex === moduleScenes.length - 1;
      const hasSceneNavigation = moduleScenes.length > 1;
      const supportsRobustness = isExamplePhase && scene.type !== "reflection";
      const supportsInterventions = isExamplePhase && scene.type === "color";
      const activeExample = visualizationExampleByIndex(state.exampleIndex);
      const showsWorkbenchControls = isExamplePhase && scene.type === "color";
      const prompt = scene.type === "color" ? activeExample.prompt : scene.prompt;
      const interventionCopy = isExamplePhase && scene.type === "color"
        ? feedbackOrInterventionExplanation(activeExample, state)
        : phaseCopyForTextEquivalent(state);
      elements.browserWorkbench.dataset.phase = phase;
      elements.body.dataset.phase = phase;
      renderBrowserWorkbench(elements, scene, state);

      elements.stepKicker.textContent = phaseKicker(state, scene);
      elements.stepTitle.textContent = scene.title;
      elements.stepPrompt.textContent = prompt;
      elements.progressTrack.hidden = !hasSceneNavigation;
      elements.progressFill.style.width = `${((state.sceneIndex + 1) / moduleScenes.length) * 100}%`;
      elements.sceneNav.hidden = !hasSceneNavigation;
      elements.back.disabled = state.sceneIndex === 0;
      elements.next.disabled = isLast;
      elements.next.textContent = isLast ? "Complete" : "Next";
      elements.statusLine.textContent = scene.status;
      elements.workbenchTitle.textContent =
        scene.type === "color" ? activeExample.workbenchTitle : scene.workbenchTitle;
      renderExampleTabs(elements, state, onAction);
      elements.exampleControl.hidden = !isExamplePhase || scene.type !== "color" || visualizationExamples.length < 2;

      elements.workbenchControls.hidden = !showsWorkbenchControls;
      elements.introControls.hidden = !isIntroPhase;
      elements.submissionPanel.hidden = !isExamplePhase;
      elements.transferControls.hidden = !isTransferPhase;
      elements.takeawayControls.hidden = !isTakeawayPhase;
      const stressTestIndex = clampStressTestIndex(state.workbench.stressTestIndex);
      const stressTest = stressTestByIndex(stressTestIndex);
      elements.robustnessSlider.min = "0";
      elements.robustnessSlider.max = String(stressTests.length - 1);
      elements.robustnessSlider.step = "1";
      elements.robustnessSlider.value = String(stressTestIndex);
      elements.robustnessSlider.setAttribute(
        "aria-valuetext",
        [stressTest.label, stressTest.frequency, stressTest.description].filter(Boolean).join(". "),
      );
      elements.robustnessValue.textContent = stressTestOutputLabel(stressTest);
      elements.robustnessValue.title = [stressTest.description, stressTest.frequency].filter(Boolean).join(" ");
      elements.robustnessSlider.disabled = !supportsRobustness;
      renderStressTestTicks(elements, stressTestIndex, supportsRobustness);

      renderInterventionControls(elements, activeExample, state.workbench.interventions, supportsInterventions, onAction);
      renderSubmissionControls(elements, activeExample, state, onAction);
      renderTransferControls(elements, state, onAction);
      renderTakeawayControls(elements);

      elements.rankingPanel.hidden = !isExamplePhase || scene.type !== "comparison";
      elements.checkRanking.disabled = scene.type !== "comparison";
      renderRanking(elements, state.ranking, onAction);
      renderRankingFeedback(elements, state.rankingCheck);

      elements.textEquivalent.textContent = [
        galleryCopy.textEquivalent,
        phaseTextEquivalent(state, scene),
        isExamplePhase ? prompt : "",
        isExamplePhase ? scene.task : "",
        interventionCopy,
      ]
        .filter(Boolean)
        .join(" ");
    },
    setVrMode(active) {
      elements.body.classList.toggle("is-immersive", active);
      elements.modeLabel.textContent = active ? "Immersive VR active" : "Browser learning module";
    },
    setStatus(text) {
      elements.statusLine.textContent = text;
    },
    getSettings: () => getSettings(elements),
  };
}

function renderBrowserWorkbench(elements, scene, state) {
  const phase = state.modulePhase ?? MODULE_PHASES.INTRO;
  const activeExample = visualizationExampleByIndex(state.exampleIndex);
  const chartFigure = elements.browserChartCanvas.closest(".browser-figure");
  const figures = elements.browserMapCanvas.closest(".browser-figures");

  figures.classList.remove("is-single", "is-intro");

  if (phase === MODULE_PHASES.INTRO) {
    chartFigure.hidden = true;
    figures.classList.add("is-single", "is-intro");
    elements.browserTaskKicker.textContent = introCopy.kicker;
    elements.browserTaskTitle.textContent = introCopy.title;
    elements.browserTaskLead.textContent = introCopy.goal;
    renderBrowserCanvas(elements.browserMapCanvas, "intro", scene, state);
    return;
  }

  if (phase === MODULE_PHASES.TRANSFER) {
    const challenge = transferChallengeById(state.selectedChallengeId);
    const feedback = state.transferFeedback;
    chartFigure.hidden = true;
    figures.classList.add("is-single");
    elements.browserTaskKicker.textContent = "Transfer challenge";
    elements.browserTaskTitle.textContent = challenge.title;
    elements.browserTaskLead.textContent = feedback
      ? `${feedback.title} ${feedback.message}`
      : challenge.question;
    renderBrowserCanvas(elements.browserMapCanvas, "map", scene, state);
    renderBrowserCanvas(elements.browserChartCanvas, "chart", scene, state);
    return;
  }

  if (phase === MODULE_PHASES.TAKEAWAYS) {
    chartFigure.hidden = true;
    figures.classList.add("is-single");
    elements.browserTaskKicker.textContent = "Final takeaways";
    elements.browserTaskTitle.textContent = "Color Fragility Takeaways";
    elements.browserTaskLead.textContent =
      "The strongest designs keep interpretation readable when hue becomes unreliable.";
    renderBrowserCanvas(elements.browserMapCanvas, "map", scene, state);
    renderBrowserCanvas(elements.browserChartCanvas, "chart", scene, state);
    return;
  }

  chartFigure.hidden = false;
  const lead =
    scene.type === "color"
      ? browserFeedbackOrInterventionSummary(activeExample, state)
      : hasActiveInterventions(state.workbench.interventions)
        ? scene.reveal
        : scene.task;

  elements.browserTaskKicker.textContent = activeExample.panelSubtitle ?? activeExample.shortTitle;
  elements.browserTaskTitle.textContent = scene.title;
  elements.browserTaskLead.textContent = lead || scene.task || "";

  renderBrowserCanvas(elements.browserMapCanvas, "map", scene, state);
  renderBrowserCanvas(elements.browserChartCanvas, "chart", scene, state);
}

function renderExampleTabs(elements, state, onAction) {
  elements.exampleTabs.replaceChildren(
    ...visualizationExamples.map((example, index) => {
      const active = index === state.exampleIndex;
      const submitted = Boolean(state.submittedExamples?.[example.id]);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "example-tab";
      button.setAttribute("role", "tab");
      button.setAttribute("aria-selected", String(active));
      button.dataset.submitted = String(submitted);
      button.textContent = example.panelSubtitle ?? example.shortTitle;
      button.addEventListener("click", () => onAction("setExample", { index }));
      return button;
    }),
  );
}

function renderSubmissionControls(elements, example, state, onAction) {
  const activeConfidence = state.confidenceByExample?.[example.id] ?? null;
  const submittedCount = visualizationExamples
    .filter((item) => Boolean(state.submittedExamples?.[item.id]))
    .length;
  const readyForChallenge = allExamplesSubmitted(state.submittedExamples, visualizationExamples);

  elements.confidenceControls.replaceChildren(
    ...confidenceOptions.map((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "confidence-choice";
      button.setAttribute("aria-pressed", String(activeConfidence === option.id));
      button.textContent = option.label;
      button.addEventListener("click", () => onAction("setConfidence", { confidence: option.id }));
      return button;
    }),
  );

  elements.submitDesign.disabled = !activeConfidence;
  elements.submitDesign.textContent = state.submittedExamples?.[example.id]
    ? "Resubmit Design"
    : "Submit Design";
  elements.continueChallenge.hidden = !readyForChallenge;
  elements.continueChallenge.disabled = !readyForChallenge;
  elements.completionStatus.textContent = readyForChallenge
    ? "All three examples submitted. You can revisit and resubmit before continuing."
    : `${submittedCount} of ${visualizationExamples.length} examples submitted.`;
}

function renderTransferControls(elements, state, onAction) {
  const challenge = transferChallengeById(state.selectedChallengeId);
  const selectedChoice = transferChoiceById(challenge, state.transferAnswer);

  elements.transferChoices.replaceChildren(
    ...challenge.choices.map((choice) => {
      const active = choice.id === selectedChoice?.id;
      const correct = state.transferSubmitted && choice.id === challenge.correctChoiceId;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "transfer-choice";
      button.setAttribute("aria-pressed", String(active));
      button.dataset.correct = String(correct);
      button.textContent = choice.label;
      button.addEventListener("click", () => onAction("selectTransferAnswer", { choiceId: choice.id }));
      return button;
    }),
  );

  elements.submitTransfer.disabled = !selectedChoice || state.transferSubmitted;
  elements.submitTransfer.textContent = state.transferSubmitted ? "Answer Submitted" : "Submit Answer";
  elements.continueTakeaways.hidden = !state.transferSubmitted;
  elements.continueTakeaways.disabled = !state.transferSubmitted;
}

function renderTakeawayControls(elements) {
  elements.restartModule.disabled = false;
}

function renderInterventionControls(elements, example, interventions, enabled, onAction) {
  const normalized = normalizeInterventions(interventions);
  const hasActive = hasActiveInterventions(normalized);
  const paletteOptions = paletteOptionsForExample(example);
  const cueOptions = cueOptionsForExample(example);
  const labelOptions = labelOptionsForExample(example);
  const cueControls = cueOptions.length > 2
    ? [
        createChoiceGroup({
          label: "Markers",
          options: cueOptions,
          activeId: cueVariantFromInterventions(normalized),
          enabled,
          onSelect: (variant) => onAction("setCueVariant", { variant }),
        }),
      ]
    : ["redundantCue"]
        .filter((key) => interventionMetadataForExample(example, key))
        .map((key) => createToggleButton({
          key,
          example,
          active: normalized[key],
          enabled,
          onAction,
        }));

  elements.originalDesign.disabled = !enabled;
  elements.originalDesign.setAttribute("aria-pressed", String(!hasActive));

  elements.interventionControls.replaceChildren(
    createChoiceGroup({
      label: "Color",
      options: paletteOptions,
      activeId: paletteVariantFromInterventions(normalized),
      enabled,
      onSelect: (variant) => onAction("setPaletteVariant", { variant }),
    }),
    ...cueControls,
    ...["annotation"]
      .filter((key) => interventionMetadataForExample(example, key))
      .map((key) => createToggleButton({
        key,
        example,
        active: normalized[key],
        enabled,
        onAction,
      })),
    createChoiceGroup({
      label: "Labels",
      options: labelOptions,
      activeId: labelModeFromInterventions(normalized),
      enabled,
      onSelect: (mode) => onAction("setLabelMode", { mode }),
    }),
  );
}

function createChoiceGroup({ label, options, activeId, enabled, onSelect }) {
  const group = document.createElement("div");
  group.className = "intervention-group";
  group.setAttribute("role", "group");
  group.setAttribute("aria-label", label);

  const heading = document.createElement("span");
  heading.className = "intervention-group-label";
  heading.textContent = label;
  group.append(heading);

  options.forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "intervention-choice";
    button.dataset.choice = option.id;
    button.disabled = !enabled;
    button.title = option.description ?? "";
    button.setAttribute("aria-pressed", String(option.id === activeId));
    button.textContent = option.label;
    button.addEventListener("click", () => onSelect(option.id));
    group.append(button);
  });

  return group;
}

function createToggleButton({ key, example, active, enabled, onAction }) {
  const metadata = interventionMetadataForExample(example, key);
  const button = document.createElement("button");
  button.type = "button";
  button.className = "intervention-toggle";
  button.dataset.intervention = key;
  button.disabled = !enabled;
  button.setAttribute("aria-pressed", String(Boolean(active)));
  button.title = metadata?.description ?? "";
  button.textContent = metadata?.label ?? key;
  button.addEventListener("click", () => onAction("toggleIntervention", { key }));
  return button;
}

function feedbackOrInterventionExplanation(example, state) {
  const feedback = state.exampleFeedback?.[example.id];
  if (!feedback) return interventionExplanation(example, state.workbench.interventions);
  return formatDesignFeedback(feedback);
}

function interventionExplanation(example, interventions) {
  const normalized = normalizeInterventions(interventions);
  const active = INTERVENTION_KEYS
    .filter((key) => normalized[key])
    .map((key) => interventionMetadataForExample(example, key))
    .filter(Boolean);

  if (active.length === 0) {
    return `${example.baselineLead} ${example.predictionPrompt}`;
  }

  return active
    .map((item) => `${item.label}: ${item.effect}`)
    .join(" ");
}

function browserFeedbackOrInterventionSummary(example, state) {
  const feedback = state.exampleFeedback?.[example.id];
  if (!feedback) return browserInterventionSummary(example, state.workbench.interventions);
  return formatDesignFeedback(feedback);
}

function browserInterventionSummary(example, interventions) {
  const normalized = normalizeInterventions(interventions);
  const active = INTERVENTION_KEYS
    .filter((key) => normalized[key])
    .map((key) => interventionMetadataForExample(example, key))
    .filter(Boolean);

  if (active.length === 0) {
    return example.baselineLead;
  }

  return active
    .map((item) => `${item.label}: ${item.effect}`)
    .join(" ");
}

function formatDesignFeedback(feedback) {
  return [
    feedback.title,
    feedback.message,
    ...(feedback.details ?? []),
    feedback.confidenceNote,
  ]
    .filter(Boolean)
    .join(" ");
}

function phaseKicker(state, scene) {
  const phase = state.modulePhase ?? MODULE_PHASES.INTRO;
  if (phase === MODULE_PHASES.INTRO) return "Start here";
  if (phase === MODULE_PHASES.TRANSFER) return "Transfer challenge";
  if (phase === MODULE_PHASES.TAKEAWAYS) return "Final takeaways";
  return `Scene ${scene.sceneNumber} of ${moduleScenes.length} • ${scene.duration}`;
}

function phaseTextEquivalent(state, scene) {
  const phase = state.modulePhase ?? MODULE_PHASES.INTRO;
  if (phase === MODULE_PHASES.INTRO) {
    return `Current phase: introduction. ${introCopy.title}. ${introCopy.lead} ${introCopy.goal}`;
  }
  if (phase === MODULE_PHASES.TRANSFER) {
    const challenge = transferChallengeById(state.selectedChallengeId);
    return `Current phase: transfer challenge. ${challenge.title}. ${challenge.question}`;
  }
  if (phase === MODULE_PHASES.TAKEAWAYS) {
    return `Current phase: final takeaways. ${finalTakeaways.join(" ")}`;
  }
  return `Current scene: ${scene.title}.`;
}

function phaseCopyForTextEquivalent(state) {
  const phase = state.modulePhase ?? MODULE_PHASES.INTRO;
  if (phase === MODULE_PHASES.INTRO) {
    return [...introCopy.mechanics, ...introCopy.flow].join(" ");
  }
  if (phase === MODULE_PHASES.TRANSFER) {
    const challenge = transferChallengeById(state.selectedChallengeId);
    const feedback = state.transferFeedback?.message;
    return [challenge.question, feedback].filter(Boolean).join(" ");
  }
  if (phase === MODULE_PHASES.TAKEAWAYS) return finalTakeaways.join(" ");
  return "";
}

function renderBrowserCanvas(target, kind, scene, state) {
  const source = createPanelTexture(kind, scene, state);
  const isMobile = window.matchMedia("(max-width: 840px)").matches;
  const mobileCanvasWidth = isMobile
    ? Math.max(260, Math.min(source.width, Math.round(window.innerWidth - 32)))
    : source.width;
  const mobileCanvasHeight = Math.round(mobileCanvasWidth * (source.height / source.width));

  if (target.width !== mobileCanvasWidth) target.width = mobileCanvasWidth;
  if (target.height !== mobileCanvasHeight) target.height = mobileCanvasHeight;
  if (isMobile) {
    target.style.setProperty("width", `${mobileCanvasWidth}px`, "important");
    target.style.setProperty("max-width", "100%", "important");
    target.style.setProperty("height", "auto");
  } else {
    target.style.removeProperty("width");
    target.style.removeProperty("max-width");
    target.style.removeProperty("height");
  }
  const ctx = target.getContext("2d");
  ctx.clearRect(0, 0, target.width, target.height);
  ctx.drawImage(source, 0, 0, target.width, target.height);
}

function renderStressTestTicks(elements, activeIndex, enabled) {
  elements.stressTestTicks.replaceChildren(
    ...stressTests.map((test, index) => {
      const tick = document.createElement("span");
      const position = stressTests.length <= 1 ? 0 : (index / (stressTests.length - 1)) * 100;
      tick.className = "stress-test-tick";
      tick.classList.toggle("is-active", index === activeIndex);
      tick.classList.toggle("is-disabled", !enabled);
      tick.style.left = `${position}%`;
      tick.title = stressTestOutputLabel(test);
      return tick;
    }),
  );
}

function stressTestOutputLabel(stressTest) {
  return [stressTest.shortLabel, stressTest.frequency].filter(Boolean).join(" · ");
}

function renderRanking(elements, ranking, onAction) {
  elements.rankingList.replaceChildren(
    ...ranking.map((id, index) => {
      const design = comparisonDesigns.find((item) => item.id === id);
      const item = document.createElement("li");
      item.className = "ranking-card";
      item.dataset.rankId = id;
      item.tabIndex = 0;
      item.setAttribute("role", "option");
      item.setAttribute(
        "aria-label",
        `${index + 1}. ${design.title}. Drag to reorder, or use arrow keys while focused.`,
      );

      const rank = document.createElement("span");
      rank.className = "rank-index";
      rank.textContent = String(index + 1);

      const thumb = createComparisonThumb(design.id);

      const copy = document.createElement("span");
      copy.className = "ranking-copy";
      copy.innerHTML = `<strong>${design.label}. ${design.title}</strong><small>${design.summary}</small>`;

      item.addEventListener("keydown", (event) => {
        if (event.key === "ArrowUp") {
          event.preventDefault();
          onAction("moveRank", { id, direction: -1 });
        }
        if (event.key === "ArrowDown") {
          event.preventDefault();
          onAction("moveRank", { id, direction: 1 });
        }
      });
      bindRankDrag(item, elements.rankingList, onAction);

      item.append(rank, thumb, copy);
      return item;
    }),
  );
}

function renderRankingFeedback(elements, rankingCheck) {
  const status = rankingCheck?.status ?? "idle";
  elements.rankingFeedback.hidden = status === "idle";
  elements.rankingFeedback.className = `ranking-feedback ranking-feedback--${status}`;

  if (status === "idle") {
    elements.rankingFeedback.replaceChildren();
    return;
  }

  const title = document.createElement("strong");
  const message = document.createElement("p");
  const details = document.createElement("ol");

  if (status === "correct") {
    title.textContent = "This ordering is well supported.";
    message.textContent =
      "The strongest design distributes meaning across multiple cues; the weakest asks hue and legend lookup to do most of the work.";
    details.append(...recommendedComparisonRanking.map((id) => feedbackDetail(id)));
  } else if (status === "reveal") {
    title.textContent = "Compare your order with this design rationale.";
    message.textContent =
      "This is not a score. It is a suggested reading based on redundancy, hierarchy, and dependence on hue.";
    details.append(...recommendedComparisonRanking.map((id) => feedbackDetail(id)));
  } else {
    title.textContent = "Try one more look.";
    message.textContent =
      "Which design still works when hue becomes unreliable? Which one simplifies the task but still leans on color? Which one asks viewers to keep returning to the legend?";
  }

  elements.rankingFeedback.replaceChildren(title, message);
  if (details.childElementCount > 0) elements.rankingFeedback.append(details);
}

function feedbackDetail(id) {
  const design = comparisonDesigns.find((item) => item.id === id);
  const item = document.createElement("li");
  const title = document.createElement("strong");
  const reason = document.createElement("span");

  title.textContent = `${design.label}. ${design.title}`;
  reason.textContent = design.reason;
  item.append(title, reason);

  return item;
}

function createComparisonThumb(id) {
  const thumb = document.createElement("span");
  thumb.className = `comparison-thumb comparison-thumb--${id}`;
  thumb.setAttribute("aria-hidden", "true");
  for (let index = 0; index < 7; index += 1) {
    const cell = document.createElement("span");
    cell.className = "comparison-thumb-cell";
    thumb.append(cell);
  }
  return thumb;
}

function bindRankDrag(item, list, onAction) {
  let dragging = false;

  item.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    dragging = true;
    item.classList.add("is-dragging");
    document.addEventListener("pointermove", moveDrag);
    document.addEventListener("pointerup", finishDrag);
    document.addEventListener("pointercancel", finishDrag);
    event.preventDefault();
  });

  function moveDrag(event) {
    if (!dragging) return;
    const afterElement = getDragAfterElement(list, event.clientY);
    if (afterElement) list.insertBefore(item, afterElement);
    else list.append(item);
  }

  function finishDrag() {
    if (!dragging) return;
    dragging = false;
    item.classList.remove("is-dragging");
    document.removeEventListener("pointermove", moveDrag);
    document.removeEventListener("pointerup", finishDrag);
    document.removeEventListener("pointercancel", finishDrag);
    const nextRanking = [...list.querySelectorAll("[data-rank-id]")].map((rankItem) => rankItem.dataset.rankId);
    onAction("setRanking", { ranking: nextRanking });
  }
}

function getDragAfterElement(list, pointerY) {
  const candidates = [...list.querySelectorAll("[data-rank-id]:not(.is-dragging)")];
  return candidates.find((candidate) => {
    const box = candidate.getBoundingClientRect();
    return pointerY < box.top + box.height / 2;
  });
}

function getSettings() {
  return {
    highContrast: false,
    reducedMotion: false,
  };
}

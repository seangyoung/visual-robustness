import {
  comparisonDesigns,
  galleryCopy,
  moduleScenes,
  recommendedComparisonRanking,
} from "../config/lesson.js";
import { clampStressTestIndex, stressTestByIndex, stressTests } from "../config/stressTests.js";
import {
  visualizationExampleByIndex,
  visualizationExamples,
} from "../config/visualizationExamples.js";
import { createPanelTexture } from "../visualizations/colorFragility.js";

export function createDomUi({
  onAction,
  onSettingsChange,
  onWorkbenchChange,
}) {
  const elements = {
    body: document.body,
    modeLabel: document.getElementById("mode-label"),
    enterVr: document.getElementById("enter-vr"),
    browserWorkbench: document.getElementById("browser-workbench"),
    browserTaskKicker: document.getElementById("browser-task-kicker"),
    browserTaskTitle: document.getElementById("browser-task-title"),
    browserTaskPrompt: document.getElementById("browser-task-prompt"),
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
    workbenchControls: document.getElementById("workbench-controls"),
    workbenchTitle: document.getElementById("workbench-title"),
    exampleControl: document.querySelector(".example-control"),
    exampleLabel: document.getElementById("example-label"),
    nextExample: document.getElementById("next-example"),
    robustnessSlider: document.getElementById("robustness-slider"),
    robustnessValue: document.getElementById("robustness-value"),
    stressTestTicks: document.getElementById("stress-test-ticks"),
    revealRedesign: document.getElementById("reveal-redesign"),
    revealRedesignLabel: document.getElementById("reveal-redesign-label"),
    rankingPanel: document.getElementById("ranking-panel"),
    rankingList: document.getElementById("ranking-list"),
    checkRanking: document.getElementById("check-ranking"),
    rankingFeedback: document.getElementById("ranking-feedback"),
    highContrast: document.getElementById("high-contrast"),
    reducedMotion: document.getElementById("reduced-motion"),
    statusLine: document.getElementById("status-line"),
    textEquivalent: document.getElementById("text-equivalent"),
  };

  elements.back.addEventListener("click", () => onAction("back"));
  elements.next.addEventListener("click", () => onAction("next"));
  elements.nextExample.addEventListener("click", () => onAction("nextExample"));
  elements.robustnessSlider.addEventListener("input", (event) => {
    onWorkbenchChange({ stressTestIndex: Number(event.target.value) });
  });
  elements.revealRedesign.addEventListener("change", (event) => {
    onWorkbenchChange({ revealRedesign: event.target.checked });
  });
  elements.checkRanking.addEventListener("click", () => onAction("checkRanking"));

  [elements.highContrast, elements.reducedMotion].forEach((input) => {
    input.addEventListener("change", () => {
      const settings = getSettings(elements);
      elements.body.classList.toggle("is-high-contrast", settings.highContrast);
      elements.body.classList.toggle("is-reduced-motion", settings.reducedMotion);
      onSettingsChange(settings);
    });
  });

  window.addEventListener("keydown", (event) => {
    if (event.altKey || event.metaKey || event.ctrlKey) return;
    const activeTag = document.activeElement?.tagName?.toLowerCase();
    if (activeTag === "input") return;
    if (event.key === "ArrowRight") onAction("next");
    if (event.key === "ArrowLeft") onAction("back");
  });

  elements.textEquivalent.textContent = galleryCopy.textEquivalent;

  return {
    elements,
    render(state) {
      const scene = moduleScenes[state.sceneIndex];
      const isLast = state.sceneIndex === moduleScenes.length - 1;
      const hasSceneNavigation = moduleScenes.length > 1;
      const supportsRedesign = scene.type === "color" || scene.type === "contrast";
      const supportsRobustness = scene.type !== "reflection";
      const activeExample = visualizationExampleByIndex(state.exampleIndex);
      const showsWorkbenchControls =
        scene.type === "orientation" || scene.type === "color" || scene.type === "contrast";
      const prompt = scene.type === "color" ? activeExample.prompt : scene.prompt;
      const revealCopy = scene.type === "color" ? activeExample.reveal : scene.reveal;
      renderBrowserWorkbench(elements, scene, state);

      elements.stepKicker.textContent = `Scene ${scene.sceneNumber} of ${moduleScenes.length} • ${scene.duration}`;
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
      elements.exampleLabel.textContent =
        `${activeExample.label} of ${visualizationExamples.length}: ${activeExample.shortTitle}`;
      elements.exampleControl.hidden = scene.type !== "color" || visualizationExamples.length < 2;

      elements.workbenchControls.hidden = !showsWorkbenchControls;
      const stressTestIndex = clampStressTestIndex(state.workbench.stressTestIndex);
      const stressTest = stressTestByIndex(stressTestIndex);
      elements.robustnessSlider.min = "0";
      elements.robustnessSlider.max = String(stressTests.length - 1);
      elements.robustnessSlider.step = "1";
      elements.robustnessSlider.value = String(stressTestIndex);
      elements.robustnessSlider.setAttribute(
        "aria-valuetext",
        `${stressTest.label}. ${stressTest.description}`,
      );
      elements.robustnessValue.textContent = stressTest.shortLabel;
      elements.robustnessValue.title = stressTest.description;
      elements.robustnessSlider.disabled = !supportsRobustness;
      renderStressTestTicks(elements, stressTestIndex, supportsRobustness);

      elements.revealRedesign.checked = state.workbench.revealRedesign;
      elements.revealRedesign.disabled = !supportsRedesign;
      elements.revealRedesignLabel.textContent = state.workbench.revealRedesign
        ? "Show original design"
        : "Show improved design";

      elements.rankingPanel.hidden = scene.type !== "comparison";
      elements.checkRanking.disabled = scene.type !== "comparison";
      renderRanking(elements, state.ranking, onAction);
      renderRankingFeedback(elements, state.rankingCheck);

      elements.textEquivalent.textContent = [
        galleryCopy.textEquivalent,
        `Current scene: ${scene.title}.`,
        prompt,
        scene.task,
        revealCopy && state.workbench.revealRedesign ? revealCopy : "",
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
  const activeExample = visualizationExampleByIndex(state.exampleIndex);
  const prompt = scene.type === "color" ? activeExample.prompt : scene.prompt;
  const lead =
    scene.type === "color"
      ? state.workbench.revealRedesign
        ? activeExample.reveal
        : activeExample.baselineLead
      : state.workbench.revealRedesign
        ? scene.reveal
        : scene.task;

  elements.browserTaskKicker.textContent = `Scene ${scene.sceneNumber} of ${moduleScenes.length} • ${scene.duration}`;
  elements.browserTaskTitle.textContent = scene.title;
  elements.browserTaskPrompt.textContent = prompt;
  elements.browserTaskLead.textContent = lead || scene.task || "";

  renderBrowserCanvas(elements.browserMapCanvas, "map", scene, state);
  renderBrowserCanvas(elements.browserChartCanvas, "chart", scene, state);
}

function renderBrowserCanvas(target, kind, scene, state) {
  const source = createPanelTexture(kind, scene, state);
  if (target.width !== source.width) target.width = source.width;
  if (target.height !== source.height) target.height = source.height;
  const ctx = target.getContext("2d");
  ctx.clearRect(0, 0, target.width, target.height);
  ctx.drawImage(source, 0, 0);
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
      tick.title = test.label;
      return tick;
    }),
  );
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

function getSettings(elements) {
  return {
    highContrast: elements.highContrast.checked,
    reducedMotion: elements.reducedMotion.checked,
  };
}

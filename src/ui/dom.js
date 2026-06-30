import {
  comparisonDesigns,
  galleryCopy,
  moduleScenes,
  reflectionPrompts,
} from "../config/lesson.js";

export function createDomUi({
  onAction,
  onSettingsChange,
  onWorkbenchChange,
  onReflectionChange,
}) {
  const elements = {
    body: document.body,
    modeLabel: document.getElementById("mode-label"),
    enterVr: document.getElementById("enter-vr"),
    stepKicker: document.getElementById("step-kicker"),
    stepTitle: document.getElementById("step-title"),
    stepPrompt: document.getElementById("step-prompt"),
    progressFill: document.getElementById("progress-fill"),
    back: document.getElementById("back-step"),
    next: document.getElementById("next-step"),
    workbenchTitle: document.getElementById("workbench-title"),
    robustnessSlider: document.getElementById("robustness-slider"),
    robustnessValue: document.getElementById("robustness-value"),
    revealRedesign: document.getElementById("reveal-redesign"),
    rankingPanel: document.getElementById("ranking-panel"),
    rankingList: document.getElementById("ranking-list"),
    notebookPanel: document.getElementById("notebook-panel"),
    reflectionFields: document.getElementById("reflection-fields"),
    exportReflection: document.getElementById("export-reflection"),
    highContrast: document.getElementById("high-contrast"),
    reducedMotion: document.getElementById("reduced-motion"),
    statusLine: document.getElementById("status-line"),
    contextNote: document.getElementById("context-note"),
    textEquivalent: document.getElementById("text-equivalent"),
  };

  createReflectionFields(elements, onReflectionChange);

  elements.back.addEventListener("click", () => onAction("back"));
  elements.next.addEventListener("click", () => onAction("next"));
  elements.robustnessSlider.addEventListener("input", (event) => {
    onWorkbenchChange({ robustness: Number(event.target.value) });
  });
  elements.revealRedesign.addEventListener("change", (event) => {
    onWorkbenchChange({ revealRedesign: event.target.checked });
  });
  elements.exportReflection.addEventListener("click", () => onAction("exportReflection"));

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
    if (activeTag === "textarea" || activeTag === "input") return;
    if (event.key === "ArrowRight") onAction("next");
    if (event.key === "ArrowLeft") onAction("back");
  });

  elements.textEquivalent.textContent = galleryCopy.textEquivalent;

  return {
    elements,
    render(state) {
      const scene = moduleScenes[state.sceneIndex];
      const isLast = state.sceneIndex === moduleScenes.length - 1;
      const supportsRedesign = scene.type === "color" || scene.type === "contrast";
      const supportsRobustness = scene.type !== "reflection";

      elements.stepKicker.textContent = `Scene ${scene.sceneNumber} of ${moduleScenes.length - 1} • ${scene.duration}`;
      elements.stepTitle.textContent = scene.title;
      elements.stepPrompt.textContent = scene.prompt;
      elements.progressFill.style.width = `${((state.sceneIndex + 1) / moduleScenes.length) * 100}%`;
      elements.back.disabled = state.sceneIndex === 0;
      elements.next.disabled = isLast;
      elements.next.textContent = isLast ? "Complete" : "Next";
      elements.statusLine.textContent = scene.status;
      elements.contextNote.textContent = contextCopyForScene(scene);
      elements.workbenchTitle.textContent = scene.workbenchTitle;

      elements.robustnessSlider.value = String(Math.round(state.workbench.robustness));
      elements.robustnessValue.textContent = `${Math.round(state.workbench.robustness)}%`;
      elements.robustnessSlider.disabled = !supportsRobustness;

      elements.revealRedesign.checked = state.workbench.revealRedesign;
      elements.revealRedesign.disabled = !supportsRedesign;

      elements.rankingPanel.hidden = scene.type !== "comparison";
      elements.notebookPanel.hidden = scene.type !== "reflection";
      renderRanking(elements, state.ranking, onAction);
      renderReflectionValues(elements, state.reflections);

      elements.textEquivalent.textContent = [
        galleryCopy.textEquivalent,
        `Current scene: ${scene.title}.`,
        scene.prompt,
        scene.task,
        scene.reveal && state.workbench.revealRedesign ? scene.reveal : "",
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

function createReflectionFields(elements, onReflectionChange) {
  elements.reflectionFields.replaceChildren(
    ...reflectionPrompts.map((prompt) => {
      const field = document.createElement("label");
      field.className = "reflection-field";
      field.setAttribute("for", `reflection-${prompt.id}`);

      const label = document.createElement("span");
      label.textContent = prompt.label;

      const textarea = document.createElement("textarea");
      textarea.id = `reflection-${prompt.id}`;
      textarea.name = prompt.id;
      textarea.rows = 3;
      textarea.placeholder = prompt.placeholder;
      textarea.addEventListener("input", (event) => {
        onReflectionChange({ [prompt.id]: event.target.value });
      });

      field.append(label, textarea);
      return field;
    }),
  );
}

function renderReflectionValues(elements, reflections) {
  reflectionPrompts.forEach((prompt) => {
    const textarea = elements.reflectionFields.querySelector(`#reflection-${prompt.id}`);
    if (textarea && textarea.value !== reflections[prompt.id]) textarea.value = reflections[prompt.id] ?? "";
  });
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

function contextCopyForScene(scene) {
  if (scene.type === "color") {
    return "This scene asks whether a viewer can still recover the dominant category when hue distinctions become less reliable.";
  }
  if (scene.type === "contrast") {
    return "This scene focuses on contrast and visual hierarchy: what the viewer notices first is part of the design, not decoration.";
  }
  if (scene.type === "comparison") {
    return "Rank the designs by how much meaning survives when color, contrast, and legend lookup become less dependable.";
  }
  if (scene.type === "reflection") {
    return "Use the notebook to translate the workbench observations into a design habit for your own visualizations.";
  }
  return "Stress-test maps and figures under changing perceptual conditions, then examine alternative designs that preserve interpretation.";
}

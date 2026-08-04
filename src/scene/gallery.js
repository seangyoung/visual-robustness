import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { XRControllerModelFactory } from "three/addons/webxr/XRControllerModelFactory.js";
import {
  INTERVENTION_KEYS,
  cueVariantFromInterventions,
  hasActiveInterventions,
  labelModeFromInterventions,
  normalizeInterventions,
  paletteVariantFromInterventions,
} from "../config/interventions.js";
import { comparisonDesigns, moduleScenes } from "../config/lesson.js";
import {
  MODULE_PHASES,
  allExamplesSubmitted,
  introCopy,
} from "../config/moduleFlow.js";
import { clampStressTestIndex, stressTestByIndex, stressTests } from "../config/stressTests.js";
import { transferChallengeById, transferChoiceById } from "../config/transferChallenges.js";
import {
  cueOptionsForExample,
  interventionMetadataForExample,
  labelOptionsForExample,
  paletteOptionsForExample,
  visualizationExampleByIndex,
  visualizationExamples,
} from "../config/visualizationExamples.js";
import {
  createButtonTexture,
  createComparisonCardTexture,
  createPanelTexture,
} from "../visualizations/colorFragility.js";

const PANEL_W = 3.3;
const PANEL_H = 2.28;
const SIDE_PANEL_X = 3.08;
const TASK_PANEL_W = 2.34;
const TASK_PANEL_H = 1.68;
const CONTROL_BUTTON_H = 0.19;
const LAYOUT = {
  desktopCameraZ: 6.2,
  desktopTargetZ: -3.15,
  floorZ: -2.7,
  wallZ: -5.9,
  workbenchY: 0.58,
  workbenchZ: -2.55,
  controlDeckY: 0.62,
  controlDeckZ: -1.35,
  controlDeckRotationX: -0.72,
  buttonY: 0.71,
  buttonZ: -1.96,
  panelY: 1.84,
  panelZ: -4.18,
  taskZ: -4.18,
};
const CONTROL_ROWS = {
  upper: 0.16,
  marker: -0.04,
  lower: -0.24,
  bottom: -0.43,
  stress: -0.12,
};
const WORKBENCH_WRAP_HALF_WIDTH = 1.38;
const WORKBENCH_WRAP_DEPTH = 0.2;
const WORKBENCH_WRAP_MAX_YAW = THREE.MathUtils.degToRad(13);
const SLIDER_X = -0.84;
const TASK_PANEL_CENTER_Y = LAYOUT.panelY - 0.08;
const EXAMPLE_BUTTON_Y_OFFSET = TASK_PANEL_H / 2 - 0.18;
const EXAMPLE_BUTTON_Z_OFFSET = 0.05;
const PANEL_BUTTON_Z_OFFSET = 0.06;
const BUTTON_FACE_Z_OFFSET = 0.026;
const INTRO_BUTTON_Y = LAYOUT.panelY - PANEL_H / 2 + 0.12;
const RESPONSE_BUTTON_Y = TASK_PANEL_CENTER_Y - TASK_PANEL_H / 2 + 0.02;
const TRANSFER_BUTTON_Y = LAYOUT.panelY - PANEL_H / 2 + 0.12;
const BUTTONS = [
  {
    id: "start-module",
    action: "startModule",
    label: introCopy.startLabel,
    x: 0,
    y: INTRO_BUTTON_Y,
    z: LAYOUT.panelZ + PANEL_BUTTON_Z_OFFSET,
    width: 0.92,
    height: 0.24,
    rotationX: 0,
    phases: [MODULE_PHASES.INTRO],
  },
  { id: "back", action: "back", label: "Back", x: -1.22, width: 0.42, deckY: CONTROL_ROWS.upper },
  { id: "next", action: "next", label: "Next", x: -0.8, width: 0.42, deckY: CONTROL_ROWS.upper },
  ...visualizationExamples.map((example, index) => ({
    id: `example-${index}`,
    action: "setExample",
    payload: { index },
    label: example.panelSubtitle ?? example.shortTitle,
    x: -0.76 + index * 0.76,
    y: TASK_PANEL_CENTER_Y + EXAMPLE_BUTTON_Y_OFFSET,
    z: LAYOUT.taskZ + EXAMPLE_BUTTON_Z_OFFSET,
    width: 0.68,
    height: 0.24,
    rotationX: 0,
    phases: [MODULE_PHASES.EXAMPLES],
  })),
  { id: "palette-original", action: "setPaletteVariant", payload: { variant: "original" }, label: "Palette\n1", x: 0.18, width: 0.3, deckY: CONTROL_ROWS.upper },
  { id: "palette", action: "setPaletteVariant", payload: { variant: "palette" }, label: "Palette\n2", x: 0.51, width: 0.3, deckY: CONTROL_ROWS.upper },
  { id: "palette-alt", action: "setPaletteVariant", payload: { variant: "paletteAlt" }, label: "Palette\n3", x: 0.84, width: 0.3, deckY: CONTROL_ROWS.upper },
  { id: "original", action: "clearInterventions", label: "Reset\nall", x: 1.24, width: 0.34, deckY: CONTROL_ROWS.upper },
  { id: "label-none", action: "setLabelMode", payload: { mode: "none" }, label: "No\nLabels", x: 0.18, width: 0.3, deckY: CONTROL_ROWS.lower },
  { id: "labels", action: "setLabelMode", payload: { mode: "labels" }, label: "Selected\nLabels", x: 0.51, width: 0.32, deckY: CONTROL_ROWS.lower },
  { id: "all-labels", action: "setLabelMode", payload: { mode: "allLabels" }, label: "All\nLabels", x: 0.84, width: 0.3, deckY: CONTROL_ROWS.lower },
  { id: "cue-none", action: "setCueVariant", payload: { variant: "none" }, label: "No\nMarkers", x: 0.18, width: 0.32, deckY: CONTROL_ROWS.marker },
  { id: "cue", action: "toggleIntervention", payload: { key: "redundantCue" }, label: "Cue", x: 0.54, width: 0.38, deckY: CONTROL_ROWS.marker },
  { id: "cue-alt", action: "setCueVariant", payload: { variant: "cueAlt" }, label: "Cue\n2", x: 0.94, width: 0.36, deckY: CONTROL_ROWS.marker },
  { id: "annotation", action: "toggleIntervention", payload: { key: "annotation" }, label: "Divider", x: 1.28, width: 0.38, deckY: CONTROL_ROWS.marker },
  {
    id: "submit-design",
    action: "submitDesign",
    label: "Submit\nDesign",
    x: 0.32,
    width: 0.68,
    height: 0.19,
    deckY: CONTROL_ROWS.bottom,
    phases: [MODULE_PHASES.EXAMPLES],
  },
  {
    id: "continue-challenge",
    action: "continueToChallenge",
    label: "Continue\nto Challenge",
    x: 1.12,
    width: 0.72,
    height: 0.19,
    deckY: CONTROL_ROWS.bottom,
    phases: [MODULE_PHASES.EXAMPLES],
  },
  ...[0, 1, 2, 3].map((choiceIndex) => transferChoiceHitArea(choiceIndex)),
  {
    id: "submit-transfer",
    action: "submitTransferAnswer",
    label: "Submit Answer",
    x: SIDE_PANEL_X - 0.44,
    y: TRANSFER_BUTTON_Y,
    z: LAYOUT.panelZ + PANEL_BUTTON_Z_OFFSET,
    width: 1.08,
    height: 0.28,
    rotationX: 0,
    rotationY: -0.15,
    phases: [MODULE_PHASES.TRANSFER],
  },
  {
    id: "continue-takeaways",
    action: "continueToTakeaways",
    label: "Continue",
    x: SIDE_PANEL_X + 0.46,
    y: TRANSFER_BUTTON_Y,
    z: LAYOUT.panelZ + PANEL_BUTTON_Z_OFFSET,
    width: 0.68,
    height: 0.2,
    rotationX: 0,
    rotationY: -0.15,
    phases: [MODULE_PHASES.TRANSFER],
  },
  {
    id: "restart-module",
    action: "restartModule",
    label: "Restart\nModule",
    x: 0,
    y: RESPONSE_BUTTON_Y - 0.21,
    z: LAYOUT.taskZ + PANEL_BUTTON_Z_OFFSET,
    width: 0.72,
    height: 0.22,
    rotationX: 0,
    phases: [MODULE_PHASES.TRANSFER, MODULE_PHASES.TAKEAWAYS],
  },
];
const CHECK_BUTTONS = [
  { id: "rank-check", action: "checkRanking", label: "Check", x: -2.62, y: 0.8, z: -3.35, width: 0.82 },
];
const SLIDER_WIDTH = 1.04;
const SLIDER_MIN_X = -SLIDER_WIDTH / 2;
const SLIDER_MAX_X = SLIDER_WIDTH / 2;
const SLIDER_CENTER = workbenchDeckPosition(SLIDER_X, CONTROL_ROWS.stress);
const SNAP_TURN_RADIANS = THREE.MathUtils.degToRad(30);
const SNAP_TURN_THRESHOLD = 0.72;
const SNAP_TURN_RESET_THRESHOLD = 0.35;
const SNAP_TURN_AXIS = new THREE.Vector3(0, 1, 0);
const TASK_SCROLL_THRESHOLD = 0.36;
const TASK_SCROLL_SPEED = 5.5;
const TASK_SCROLL_MAX = 360;
const WORKBENCH_TOUCH_RAY_LENGTH = 0.28;
const WORKBENCH_TOUCH_TIP_OFFSET = 0.12;
const WORKBENCH_TOUCH_DEPTH = 0.1;
const WORKBENCH_TOUCH_MARGIN = 0.035;
const FIGURE_INSPECTOR_W = 3.72;
const FIGURE_INSPECTOR_H = 2.54;
const FIGURE_INSPECTOR_Y = 1.82;
const FIGURE_INSPECTOR_Z = -2.78;
const FIGURE_INSPECTOR_TEXTURE_W = 1800;
const FIGURE_INSPECTOR_TEXTURE_H = 1228;
const FIGURE_INSPECTOR_MIN_ZOOM = 1;
const FIGURE_INSPECTOR_MAX_ZOOM = 5.2;
const FIGURE_INSPECTOR_ZOOM_SPEED = 0.035;
const RANK_CARD_W = 0.82;
const RANK_CARD_H = 1.22;
const RANK_CARD_Z = -3.54;
const RANK_CARD_Y = 1.76;
const RANK_CARD_SLOTS = [
  new THREE.Vector3(-3.62, RANK_CARD_Y, RANK_CARD_Z),
  new THREE.Vector3(-2.62, RANK_CARD_Y, RANK_CARD_Z),
  new THREE.Vector3(-1.62, RANK_CARD_Y, RANK_CARD_Z),
];

function workbenchDeckPosition(x, deckY = 0) {
  const wrapZ = workbenchWrapDepth(x);
  return new THREE.Vector3(
    x,
    LAYOUT.controlDeckY + Math.cos(LAYOUT.controlDeckRotationX) * deckY,
    LAYOUT.controlDeckZ + Math.sin(LAYOUT.controlDeckRotationX) * deckY + wrapZ,
  );
}

function workbenchWrapAmount(x) {
  return Math.min(1, Math.abs(x) / WORKBENCH_WRAP_HALF_WIDTH);
}

function workbenchWrapDepth(x) {
  return WORKBENCH_WRAP_DEPTH * workbenchWrapAmount(x) ** 1.35;
}

function workbenchControlYaw(x) {
  return -Math.sign(x) * WORKBENCH_WRAP_MAX_YAW * workbenchWrapAmount(x);
}

function isWorkbenchControl(control) {
  return control.deckY !== undefined && control.y === undefined && control.z === undefined;
}

function controlPosition(control) {
  if (control.y !== undefined && control.z !== undefined) {
    return new THREE.Vector3(control.x, control.y, control.z);
  }

  return workbenchDeckPosition(control.x, control.deckY ?? 0);
}

function positionControlFace(mesh, control) {
  mesh.position.copy(controlPosition(control));
  mesh.translateZ(BUTTON_FACE_Z_OFFSET);
}

function transferChoiceHitArea(choiceIndex) {
  const cardCanvasY = 196 + choiceIndex * 112;
  const cardHeight = 92;
  const canvasHeight = 980;
  const cardCenterY = cardCanvasY + cardHeight / 2;
  const panelLocalY = -((cardCenterY - canvasHeight / 2) / canvasHeight) * PANEL_H;

  return {
    id: `transfer-choice-${choiceIndex}`,
    action: "selectTransferAnswer",
    payload: { choiceIndex },
    label: `Choice ${choiceIndex + 1}`,
    x: SIDE_PANEL_X,
    y: LAYOUT.panelY + panelLocalY,
    z: LAYOUT.panelZ + PANEL_BUTTON_Z_OFFSET,
    width: 2.86,
    height: 0.22,
    rotationX: 0,
    rotationY: -0.15,
    phases: [MODULE_PHASES.TRANSFER],
    hitOnly: true,
  };
}

export function createGalleryApp({ canvas, ui, onAction }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#080d0f");

  const camera = new THREE.PerspectiveCamera(64, window.innerWidth / window.innerHeight, 0.05, 80);
  camera.position.set(0, 1.55, LAYOUT.desktopCameraZ);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.5, LAYOUT.desktopTargetZ);
  controls.enablePan = false;
  controls.enableZoom = true;
  controls.minDistance = 4.8;
  controls.maxDistance = 7.4;
  controls.rotateSpeed = 0.55;
  controls.minPolarAngle = Math.PI * 0.34;
  controls.maxPolarAngle = Math.PI * 0.58;
  controls.update();

  const stage = new THREE.Group();
  scene.add(stage);

  const world = createWorld(stage);
  const panels = createPanels(stage);
  const workbenchControlDeck = createWorkbenchControlDeck(stage);
  const mainButtons = createButtons(stage, BUTTONS);
  const exampleButton = mainButtons.find((button) => button.id === "example");
  const checkButtons = createButtons(stage, CHECK_BUTTONS, { width: 0.82, height: 0.2, rotationX: -0.18 });
  const inWorldButtons = [...mainButtons, ...checkButtons];
  const robustnessSlider = createRobustnessSlider(stage);
  const figureInspector = createFigureInspector(stage);
  const rankingSet = createRankingSet(stage);
  const controllers = createControllers(renderer, scene);
  const raycaster = new THREE.Raycaster();
  const touchRaycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const snapTurnPivot = new THREE.Vector3();
  const interactive = [
    ...inWorldButtons.map((button) => button.mesh),
    robustnessSlider.hitArea,
    robustnessSlider.handle,
    panels.map,
    panels.chart,
    figureInspector.surface,
    figureInspector.close,
    ...rankingSet.cards.map((card) => card.mesh),
  ];

  let hoverControl = null;
  let dragState = null;
  const directTouchStates = new Map();
  let figureInspection = {
    open: false,
    kind: "map",
    zoom: 1,
    panX: 0,
    panY: 0,
  };
  let taskScroll = 0;
  let taskScrollKey = "";
  let currentState = {
    sceneIndex: 0,
    modulePhase: MODULE_PHASES.INTRO,
    exampleIndex: 0,
    settings: ui.getSettings(),
    workbench: {
      stressTestIndex: 0,
      interventions: {
        palette: false,
        redundantCue: false,
        labels: false,
      },
    },
    ranking: [],
  };
  let currentSession = null;
  let snapTurnArmed = true;
  let figureInspectorCloseButtonArmed = true;

  function renderState(state) {
    currentState = state;
    resetTaskScrollIfNeeded(state);
    const sceneState = moduleScenes[state.sceneIndex];
    const isImmersive = Boolean(currentSession);
    const inWorldPanelState = panelStateWithScroll(state);
    updateInWorldControlVisibility(
      mainButtons,
      checkButtons,
      robustnessSlider,
      rankingSet,
      workbenchControlDeck,
      sceneState,
      isImmersive,
      state,
    );
    applyPanelLayout(panels, sceneState, state, isImmersive);
    updatePanel(panels.map, "map", sceneState, state);
    updatePanel(panels.task, "task", sceneState, inWorldPanelState);
    updatePanel(panels.chart, "chart", sceneState, state);
    updateFigureInspector(figureInspector, figureInspection, sceneState, state, isImmersive, hoverControl);
    updateInspectablePanelFrames(panels, hoverControl, figureInspection);
    updateButtonTextures(inWorldButtons, hoverControl, state);
    updateRobustnessSlider(robustnessSlider, state.workbench.stressTestIndex, hoverControl, dragState);
    updateRankingSet(rankingSet, state, hoverControl, dragState);
    world.accent.visible = !state.settings.highContrast;
  }

  function resetTaskScrollIfNeeded(state) {
    const example = visualizationExampleByIndex(state.exampleIndex ?? 0);
    const key = [
      state.modulePhase,
      state.sceneIndex,
      example.id,
      state.transferSubmitted ? "submitted" : "pending",
      state.transferAnswer ?? "",
      Object.keys(state.exampleFeedback ?? {}).join(","),
    ].join(":");
    if (key === taskScrollKey) return;
    taskScrollKey = key;
    taskScroll = 0;
  }

  function panelStateWithScroll(state) {
    return {
      ...state,
      vrTaskScroll: taskScroll,
    };
  }

  async function enterVr() {
    if (!navigator.xr) {
      ui.setStatus("WebXR is not available in this browser.");
      return;
    }
    try {
      const supported = await navigator.xr.isSessionSupported("immersive-vr");
      if (!supported) {
        ui.setStatus("No immersive VR headset was detected. Browser mode remains active.");
        return;
      }
      const session = await navigator.xr.requestSession("immersive-vr", {
        optionalFeatures: ["local-floor", "bounded-floor", "hand-tracking"],
      });
      currentSession = session;
      updateInWorldControlVisibility(
        mainButtons,
        checkButtons,
        robustnessSlider,
        rankingSet,
        workbenchControlDeck,
        moduleScenes[currentState.sceneIndex],
        true,
        currentState,
      );
      session.addEventListener("end", () => {
        currentSession = null;
        dragState = null;
        figureInspectorCloseButtonArmed = true;
        resetSnapTurn();
        setInWorldControlsVisible(inWorldButtons, false);
        robustnessSlider.group.visible = false;
        figureInspection.open = false;
        figureInspector.group.visible = false;
        rankingSet.group.visible = false;
        workbenchControlDeck.visible = false;
        applyPanelLayout(panels, moduleScenes[currentState.sceneIndex], currentState, false);
        ui.setVrMode(false);
        renderState(currentState);
      });
      await renderer.xr.setSession(session);
      ui.setVrMode(true);
    } catch (error) {
      ui.setStatus(`Could not start VR: ${error.message}`);
    }
  }

  function setVrButtonState() {
    if (!navigator.xr || !window.isSecureContext) {
      ui.elements.enterVr.disabled = true;
      ui.setStatus("WebXR needs HTTPS or localhost. Browser mode is ready.");
      return;
    }
    navigator.xr
      .isSessionSupported("immersive-vr")
      .then((supported) => {
        ui.elements.enterVr.disabled = !supported;
        ui.elements.modeLabel.textContent = supported
          ? "VR headset available"
          : "Browser learning module";
      })
      .catch(() => {
        ui.elements.enterVr.disabled = true;
      });
  }

  function selectAction(action, payload = {}) {
    onAction(action, payload);
  }

  function openVrFigureInspector(kind) {
    const sceneState = moduleScenes[currentState.sceneIndex];
    if (!isFigureInspectable(kind, sceneState, currentState)) return;
    figureInspection = {
      open: true,
      kind,
      zoom: 1,
      panX: 0,
      panY: 0,
    };
    hoverControl = null;
    dragState = null;
    updateFigureInspector(figureInspector, figureInspection, sceneState, currentState, Boolean(currentSession), hoverControl);
    updateInspectablePanelFrames(panels, hoverControl, figureInspection);
  }

  function closeVrFigureInspector() {
    figureInspection.open = false;
    hoverControl = null;
    dragState = null;
    figureInspectorCloseButtonArmed = false;
    figureInspector.group.visible = false;
    updateInspectablePanelFrames(panels, hoverControl, figureInspection);
  }

  function workbenchInteractiveObjects() {
    return [
      ...inWorldButtons.map((button) => button.mesh),
      robustnessSlider.hitArea,
      robustnessSlider.handle,
    ];
  }

  function workbenchTouchObjects() {
    return [
      ...inWorldButtons
        .filter((button) => button.deckY !== undefined)
        .map((button) => button.mesh),
      robustnessSlider.hitArea,
      robustnessSlider.handle,
    ];
  }

  function currentInteractiveObjects() {
    if (figureInspection.open) {
      return [
        figureInspector.surface,
        figureInspector.close,
        ...workbenchInteractiveObjects(),
      ];
    }
    return interactive;
  }

  function onPointerMove(event) {
    if (currentSession) return;
    if (!hasVisibleControls(inWorldButtons)) return;
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(getVisibleInteractiveObjects(interactive), false)[0];
    const nextHover = hit?.object.userData.controlId ?? null;
    if (nextHover !== hoverControl) {
      hoverControl = nextHover;
      updateButtonTextures(inWorldButtons, hoverControl, currentState);
      renderer.domElement.style.cursor = hoverControl ? "pointer" : "grab";
    }
  }

  function onPointerDown(event) {
    if (currentSession) return;
    if (!hasVisibleControls(inWorldButtons)) return;
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(getVisibleInteractiveObjects(interactive), false)[0];
    if (hit?.object.userData.disabled) return;
    if (hit?.object.userData.action) {
      selectAction(hit.object.userData.action, hit.object.userData.payload ?? {});
    }
  }

  function beginControllerInteraction(controller) {
    const hit = intersectController(controller, raycaster, getVisibleInteractiveObjects(currentInteractiveObjects()));
    const target = hit?.object;
    if (!target) return;
    if (target.userData.disabled) return;

    if (target.userData.kind === "figure-panel") {
      openVrFigureInspector(target.userData.figureKind ?? "map");
      pulseController(controller);
      return;
    }

    if (target.userData.kind === "figure-inspector-close") {
      closeVrFigureInspector();
      pulseController(controller);
      return;
    }

    if (target.userData.kind === "figure-inspector-surface") {
      dragState = {
        type: "figure-inspection",
        controller,
        lastPoint: controllerLocalPoint(controller, raycaster, figureInspector.surface),
      };
      hoverControl = target.userData.controlId;
      pulseController(controller);
      return;
    }

    if (target.userData.action) {
      pulseController(controller);
      selectAction(target.userData.action, target.userData.payload ?? {});
      return;
    }

    if (target.userData.kind === "slider") {
      dragState = { type: "slider", controller };
      hoverControl = target.userData.controlId;
      pulseController(controller);
      updateSliderFromController(controller);
      updateRobustnessSlider(robustnessSlider, currentState.workbench.stressTestIndex, hoverControl, dragState);
      return;
    }

    if (target.userData.kind === "rank-card") {
      const card = rankingSet.cardsById.get(target.userData.designId);
      if (!card) return;
      dragState = { type: "rank-card", controller, card };
      hoverControl = target.userData.controlId;
      pulseController(controller);
      updateDraggedRankCard(controller, card);
      updateRankingSet(rankingSet, currentState, hoverControl, dragState);
    }
  }

  function beginControllerSqueeze(controller) {
    if (figureInspection.open) {
      closeVrFigureInspector();
      pulseController(controller);
      return;
    }
    beginControllerInteraction(controller);
  }

  function updateWorkbenchDirectTouch() {
    if (!currentSession) {
      directTouchStates.clear();
      return null;
    }

    const touchObjects = getVisibleInteractiveObjects(workbenchTouchObjects());
    if (!touchObjects.length) {
      directTouchStates.clear();
      return null;
    }

    let activeControlId = null;
    controllers.forEach((controller) => {
      const controllerIndex = controller.userData.index ?? 0;
      if (!controller.visible) {
        directTouchStates.delete(controllerIndex);
        return;
      }

      const hit = intersectControllerTouch(controller, touchRaycaster, touchObjects);
      const target = hit?.object;
      if (!target || target.userData.disabled) {
        directTouchStates.delete(controllerIndex);
        return;
      }

      const controlId = target.userData.controlId ?? null;
      if (controlId && !activeControlId) activeControlId = controlId;

      if (target.userData.kind === "slider") {
        directTouchStates.set(controllerIndex, { controlId, kind: "slider" });
        if (updateSliderFromWorldPoint(hit.point)) pulseController(controller);
        return;
      }

      if (!target.userData.action) {
        directTouchStates.set(controllerIndex, { controlId, kind: target.userData.kind ?? "touch" });
        return;
      }

      const previous = directTouchStates.get(controllerIndex);
      if (previous?.controlId !== controlId) {
        pulseController(controller);
        selectAction(target.userData.action, target.userData.payload ?? {});
      }
      directTouchStates.set(controllerIndex, { controlId, kind: target.userData.kind ?? "button" });
    });

    return activeControlId;
  }

  function endControllerInteraction(controller) {
    if (!dragState || dragState.controller !== controller) return;
    const endedDrag = dragState;
    dragState = null;

    if (endedDrag.type === "rank-card") {
      const nextRanking = rankingAfterDrop(currentState.ranking, endedDrag.card.id, endedDrag.card.mesh.position.x);
      selectAction("setRanking", { ranking: nextRanking });
      return;
    }

    if (endedDrag.type === "figure-inspection") {
      updateFigureInspector(figureInspector, figureInspection, moduleScenes[currentState.sceneIndex], currentState, Boolean(currentSession), hoverControl);
      return;
    }

    updateRobustnessSlider(robustnessSlider, currentState.workbench.stressTestIndex, hoverControl, dragState);
  }

  function updateDragState(activeDrag) {
    if (activeDrag.type === "slider") {
      updateSliderFromController(activeDrag.controller);
      return;
    }
    if (activeDrag.type === "rank-card") {
      updateDraggedRankCard(activeDrag.controller, activeDrag.card);
      return;
    }
    if (activeDrag.type === "figure-inspection") {
      updateFigureInspectionPan(activeDrag);
    }
  }

  function updateSliderFromController(controller) {
    const point = controllerLocalPoint(controller, raycaster, robustnessSlider.group);
    if (!point) return;
    setSliderFromLocalX(point.x);
  }

  function updateSliderFromWorldPoint(worldPoint) {
    if (!worldPoint) return false;
    robustnessSlider.group.updateWorldMatrix(true, false);
    const point = robustnessSlider.group.worldToLocal(worldPoint.clone());
    return setSliderFromLocalX(point.x);
  }

  function setSliderFromLocalX(x) {
    const localX = clamp(x, SLIDER_MIN_X, SLIDER_MAX_X);
    const normalized = (localX - SLIDER_MIN_X) / SLIDER_WIDTH;
    const index = clampStressTestIndex(normalized * (stressTests.length - 1));
    if (index !== clampStressTestIndex(currentState.workbench.stressTestIndex)) {
      selectAction("setStressTest", { index });
      return true;
    }
    return false;
  }

  function updateDraggedRankCard(controller, card) {
    const point = controllerPlanePoint(controller, raycaster, RANK_CARD_Z + 0.16);
    if (!point) return;
    const minX = RANK_CARD_SLOTS[0].x;
    const maxX = RANK_CARD_SLOTS[RANK_CARD_SLOTS.length - 1].x;
    card.mesh.position.set(
      clamp(point.x, minX, maxX),
      clamp(point.y, RANK_CARD_Y - 0.2, RANK_CARD_Y + 0.2),
      RANK_CARD_Z + 0.16,
    );
  }

  function updateFigureInspectionPan(activeDrag) {
    const point = controllerLocalPoint(activeDrag.controller, raycaster, figureInspector.surface);
    if (!point) return;
    if (!activeDrag.lastPoint) {
      activeDrag.lastPoint = point;
      return;
    }

    const dx = point.x - activeDrag.lastPoint.x;
    const dy = point.y - activeDrag.lastPoint.y;
    activeDrag.lastPoint = point;
    figureInspection.panX += (dx / FIGURE_INSPECTOR_W) * FIGURE_INSPECTOR_TEXTURE_W;
    figureInspection.panY -= (dy / FIGURE_INSPECTOR_H) * FIGURE_INSPECTOR_TEXTURE_H;
    updateFigureInspector(figureInspector, figureInspection, moduleScenes[currentState.sceneIndex], currentState, Boolean(currentSession), hoverControl);
  }

  function updateFigureInspectionZoom() {
    if (!currentSession || !figureInspection.open) return false;
    const axis = getTaskScrollAxis(currentSession.inputSources);
    if (Math.abs(axis) < TASK_SCROLL_THRESHOLD) return false;
    const nextZoom = clamp(
      figureInspection.zoom - axis * FIGURE_INSPECTOR_ZOOM_SPEED,
      FIGURE_INSPECTOR_MIN_ZOOM,
      FIGURE_INSPECTOR_MAX_ZOOM,
    );
    if (Math.abs(nextZoom - figureInspection.zoom) < 0.001) return false;
    figureInspection.zoom = nextZoom;
    updateFigureInspector(figureInspector, figureInspection, moduleScenes[currentState.sceneIndex], currentState, true, hoverControl);
    return true;
  }

  function updateFigureInspectorCloseShortcut() {
    if (!currentSession) {
      figureInspectorCloseButtonArmed = true;
      return false;
    }

    const pressed = hasSecondaryFaceButtonPressed(currentSession.inputSources);
    if (!pressed) {
      figureInspectorCloseButtonArmed = true;
      return false;
    }

    if (!figureInspection.open || !figureInspectorCloseButtonArmed) {
      figureInspectorCloseButtonArmed = false;
      return false;
    }

    closeVrFigureInspector();
    return true;
  }

  function updateSnapTurn() {
    if (!currentSession) return;
    if (dragState) {
      snapTurnArmed = false;
      return;
    }

    const axis = getSnapTurnAxis(currentSession.inputSources);
    const magnitude = Math.abs(axis);
    if (magnitude < SNAP_TURN_RESET_THRESHOLD) {
      snapTurnArmed = true;
      return;
    }

    if (!snapTurnArmed || magnitude < SNAP_TURN_THRESHOLD) return;

    snapTurnArmed = false;
    applySnapTurn(axis > 0 ? SNAP_TURN_RADIANS : -SNAP_TURN_RADIANS);
  }

  function updateTaskPanelScroll() {
    if (figureInspection.open) return false;
    if (!currentSession || !panels.task.visible) return false;
    const axis = getTaskScrollAxis(currentSession.inputSources);
    if (Math.abs(axis) < TASK_SCROLL_THRESHOLD) return false;

    const next = clamp(taskScroll + axis * TASK_SCROLL_SPEED, 0, TASK_SCROLL_MAX);
    if (Math.abs(next - taskScroll) < 0.1) return false;
    taskScroll = next;
    return true;
  }

  function applySnapTurn(delta) {
    renderer.xr.getCamera(camera).getWorldPosition(snapTurnPivot);
    snapTurnPivot.y = 0;
    stage.position.sub(snapTurnPivot);
    stage.position.applyAxisAngle(SNAP_TURN_AXIS, delta);
    stage.position.add(snapTurnPivot);
    stage.rotateOnWorldAxis(SNAP_TURN_AXIS, delta);
    stage.updateMatrixWorld(true);
  }

  function resetSnapTurn() {
    stage.position.set(0, 0, 0);
    stage.rotation.set(0, 0, 0);
    stage.updateMatrixWorld(true);
    snapTurnArmed = true;
  }

  function onResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  function setVrHoverControl(controlId) {
    if (controlId === hoverControl) return;
    hoverControl = controlId;
    updateButtonTextures(inWorldButtons, hoverControl, currentState);
    updateFigureInspectorCloseTexture(figureInspector, hoverControl);
    updateInspectablePanelFrames(panels, hoverControl, figureInspection);
    updateRobustnessSlider(robustnessSlider, currentState.workbench.stressTestIndex, hoverControl, dragState);
    updateRankingSet(rankingSet, currentState, hoverControl, dragState);
  }

  renderer.domElement.addEventListener("pointermove", onPointerMove);
  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("resize", onResize);

  controllers.forEach((controller) => {
    controller.addEventListener("selectstart", () => beginControllerInteraction(controller));
    controller.addEventListener("selectend", () => endControllerInteraction(controller));
    controller.addEventListener("squeezestart", () => beginControllerSqueeze(controller));
    controller.addEventListener("squeezeend", () => endControllerInteraction(controller));
  });

  renderer.setAnimationLoop(() => {
    if (!currentSession) controls.update();
    else {
      updateSnapTurn();
      updateFigureInspectorCloseShortcut();
      updateFigureInspectionZoom();
    }
    if (dragState) updateDragState(dragState);
    applyPanelLayout(panels, moduleScenes[currentState.sceneIndex], currentState, Boolean(currentSession));
    if (updateTaskPanelScroll()) {
      updatePanel(panels.task, "task", moduleScenes[currentState.sceneIndex], panelStateWithScroll(currentState));
    }
    if (exampleButton?.mesh.visible) {
      exampleButton.mesh.position.y = panels.task.position.y + EXAMPLE_BUTTON_Y_OFFSET;
      exampleButton.mesh.position.z = panels.task.position.z + EXAMPLE_BUTTON_Z_OFFSET;
    }
    stage.updateMatrixWorld(true);
    const touchControl = updateWorkbenchDirectTouch();
    if (touchControl) setVrHoverControl(touchControl);
    else updateControllerHover(controllers, raycaster, currentInteractiveObjects(), setVrHoverControl);
    renderer.render(scene, camera);
  });

  setVrButtonState();

  return {
    renderState,
    enterVr,
    dispose() {
      renderer.setAnimationLoop(null);
      renderer.dispose();
      controls.dispose();
      window.removeEventListener("resize", onResize);
    },
  };
}

function getSnapTurnAxis(inputSources) {
  let strongestAxis = 0;
  for (const inputSource of inputSources) {
    const axes = inputSource.gamepad?.axes ?? [];
    for (let index = 0; index < axes.length; index += 2) {
      const axis = axes[index] ?? 0;
      if (Math.abs(axis) > Math.abs(strongestAxis)) {
        strongestAxis = axis;
      }
    }
  }
  return strongestAxis;
}

function getTaskScrollAxis(inputSources) {
  let strongestAxis = 0;
  for (const inputSource of inputSources) {
    const axes = inputSource.gamepad?.axes ?? [];
    for (let index = 1; index < axes.length; index += 2) {
      const axis = axes[index] ?? 0;
      if (Math.abs(axis) > Math.abs(strongestAxis)) {
        strongestAxis = axis;
      }
    }
  }
  return strongestAxis;
}

function hasSecondaryFaceButtonPressed(inputSources) {
  for (const inputSource of inputSources) {
    const buttons = inputSource.gamepad?.buttons ?? [];
    if (buttons[5]?.pressed) return true;
  }
  return false;
}

function createWorld(scene) {
  const room = new THREE.Group();
  scene.add(room);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 10),
    new THREE.MeshStandardMaterial({
      color: "#121719",
      roughness: 0.72,
      metalness: 0.04,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, LAYOUT.floorZ);
  room.add(floor);

  const grid = new THREE.GridHelper(10, 20, "#2b3e41", "#223034");
  grid.position.set(0, 0.01, LAYOUT.floorZ);
  room.add(grid);

  const backWall = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 3.6),
    new THREE.MeshStandardMaterial({ color: "#11191c", roughness: 0.82 }),
  );
  backWall.position.set(0, 1.8, LAYOUT.wallZ);
  room.add(backWall);

  const leftWall = new THREE.Mesh(
    new THREE.PlaneGeometry(9.2, 3.6),
    new THREE.MeshStandardMaterial({ color: "#0e1518", roughness: 0.86 }),
  );
  leftWall.position.set(-5, 1.8, -2.4);
  leftWall.rotation.y = Math.PI / 2;
  room.add(leftWall);

  const rightWall = leftWall.clone();
  rightWall.position.x = 5;
  rightWall.rotation.y = -Math.PI / 2;
  room.add(rightWall);

  const ceilingRail = new THREE.Mesh(
    new THREE.BoxGeometry(7.1, 0.06, 0.08),
    new THREE.MeshStandardMaterial({ color: "#202b2e", roughness: 0.5 }),
  );
  ceilingRail.position.set(0, 3.38, -3.85);
  room.add(ceilingRail);

  for (const x of [-2.6, 0, 2.6]) {
    const lightBar = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.06, 0.08),
      new THREE.MeshBasicMaterial({ color: "#f8f6ee" }),
    );
    lightBar.position.set(x, 3.24, -4.1);
    room.add(lightBar);
  }

  const hemi = new THREE.HemisphereLight("#f8f6ee", "#0b0f11", 1.8);
  scene.add(hemi);
  const key = new THREE.DirectionalLight("#ffffff", 2.2);
  key.position.set(0, 4, 2.2);
  scene.add(key);

  const accent = new THREE.Mesh(
    new THREE.PlaneGeometry(8.6, 0.08),
    new THREE.MeshBasicMaterial({ color: "#245f5b", transparent: true, opacity: 0.55 }),
  );
  accent.position.set(0, 0.02, -2.65);
  accent.rotation.x = -Math.PI / 2;
  room.add(accent);

  const workbenchTop = new THREE.Mesh(
    new THREE.BoxGeometry(3.8, 0.08, 1.02),
    new THREE.MeshStandardMaterial({ color: "#182124", roughness: 0.68, metalness: 0.08 }),
  );
  workbenchTop.position.set(0, LAYOUT.workbenchY, LAYOUT.workbenchZ);
  room.add(workbenchTop);

  const workbenchEdge = new THREE.Mesh(
    new THREE.BoxGeometry(3.92, 0.07, 1.14),
    new THREE.MeshStandardMaterial({ color: "#2b383b", roughness: 0.56 }),
  );
  workbenchEdge.position.set(0, LAYOUT.workbenchY - 0.06, LAYOUT.workbenchZ);
  room.add(workbenchEdge);

  return { room, accent };
}

function createPanels(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const map = panelMesh("map", [-SIDE_PANEL_X, LAYOUT.panelY, LAYOUT.panelZ], [0, 0.15, 0], PANEL_W, PANEL_H);
  const task = panelMesh("task", [0, TASK_PANEL_CENTER_Y, LAYOUT.taskZ], [0, 0, 0], TASK_PANEL_W, TASK_PANEL_H);
  const chart = panelMesh("chart", [SIDE_PANEL_X, LAYOUT.panelY, LAYOUT.panelZ], [0, -0.15, 0], PANEL_W, PANEL_H);
  map.userData.kind = "figure-panel";
  map.userData.controlId = "inspect-map";
  map.userData.figureKind = "map";
  chart.userData.kind = "figure-panel";
  chart.userData.controlId = "inspect-chart";
  chart.userData.figureKind = "chart";
  [map, task, chart].forEach((panel) => group.add(panel));
  return { group, map, task, chart };
}

function applyPanelLayout(panels, sceneState, state, isImmersive) {
  const phase = state?.modulePhase ?? MODULE_PHASES.INTRO;
  const introLayout = isImmersive && phase === MODULE_PHASES.INTRO;

  if (introLayout) {
    panels.map.visible = true;
    panels.map.position.set(0, LAYOUT.panelY, LAYOUT.panelZ);
    panels.map.rotation.set(0, 0, 0);
    panels.task.visible = false;
    panels.chart.visible = false;
    return;
  }

  panels.map.visible = !(isImmersive && sceneState.type === "comparison");
  panels.map.position.set(-SIDE_PANEL_X, LAYOUT.panelY, LAYOUT.panelZ);
  panels.map.rotation.set(0, 0.15, 0);
  panels.task.visible = true;
  panels.task.position.set(0, TASK_PANEL_CENTER_Y, LAYOUT.taskZ);
  panels.task.rotation.set(0, 0, 0);
  panels.chart.visible = true;
  panels.chart.position.set(SIDE_PANEL_X, LAYOUT.panelY, LAYOUT.panelZ);
  panels.chart.rotation.set(0, -0.15, 0);
}

function createWorkbenchControlDeck(scene) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  [
    { x: -0.96, deckY: -0.03, width: 1.16, height: 0.68, color: "#141f22" },
    { x: 0.74, deckY: -0.12, width: 1.72, height: 0.76, color: "#11191c" },
  ].forEach((plate) => addWorkbenchDeckPlate(group, plate));

  return group;
}

function addWorkbenchDeckPlate(group, plate) {
  const yaw = workbenchControlYaw(plate.x);
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(plate.width, plate.height, 0.05),
    new THREE.MeshStandardMaterial({
      color: plate.color,
      roughness: 0.62,
      metalness: 0.06,
    }),
  );
  base.position.copy(workbenchDeckPosition(plate.x, plate.deckY));
  base.rotation.set(LAYOUT.controlDeckRotationX, yaw, 0);
  base.translateZ(-0.04);
  group.add(base);

  const lip = new THREE.Mesh(
    new THREE.BoxGeometry(plate.width + 0.04, 0.05, 0.065),
    new THREE.MeshStandardMaterial({ color: "#2b383b", roughness: 0.56 }),
  );
  lip.position.copy(workbenchDeckPosition(plate.x, plate.deckY - plate.height / 2 - 0.01));
  lip.rotation.set(LAYOUT.controlDeckRotationX, yaw, 0);
  lip.translateZ(-0.03);
  group.add(lip);
}

function panelMesh(name, position, rotation, width, height) {
  const material = new THREE.MeshBasicMaterial({
    color: "#ffffff",
    transparent: false,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);

  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.06, height + 0.06, 0.03),
    new THREE.MeshStandardMaterial({ color: "#263236", roughness: 0.62 }),
  );
  frame.position.z = -0.025;
  mesh.add(frame);
  mesh.userData.frame = frame;
  return mesh;
}

function createButtons(scene, buttons, defaults = {}) {
  const width = defaults.width ?? 0.66;
  const height = defaults.height ?? CONTROL_BUTTON_H;
  const rotationX = defaults.rotationX ?? LAYOUT.controlDeckRotationX;
  return buttons.map((button) => {
    const hitOnly = Boolean(button.hitOnly);
    const texture = hitOnly ? null : textureFromCanvas(createButtonTexture(button.label, false));
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: hitOnly ? 0 : 1,
      depthWrite: !hitOnly,
      toneMapped: false,
    });
    const buttonWidth = button.width ?? width;
    const buttonHeight = button.height ?? height;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(buttonWidth, buttonHeight), material);
    mesh.rotation.x = button.rotationX ?? rotationX;
    mesh.rotation.y = button.rotationY ?? (isWorkbenchControl(button) ? workbenchControlYaw(button.x) : 0);
    positionControlFace(mesh, button);
    mesh.visible = false;

    if (!hitOnly) {
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(buttonWidth + 0.028, buttonHeight + 0.028, 0.03),
        new THREE.MeshStandardMaterial({ color: "#263236", roughness: 0.48, metalness: 0.04 }),
      );
      base.position.z = -0.04;
      mesh.add(base);
    }

    mesh.userData.kind = "button";
    mesh.userData.controlId = button.id;
    mesh.userData.action = button.action;
    mesh.userData.payload = button.payload ?? {};
    scene.add(mesh);
    return { ...button, mesh };
  });
}

function createRobustnessSlider(scene) {
  const group = new THREE.Group();
  group.position.copy(SLIDER_CENTER);
  group.rotation.x = LAYOUT.controlDeckRotationX;
  group.rotation.y = workbenchControlYaw(SLIDER_X);
  group.visible = false;
  scene.add(group);

  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(1.26, 0.19),
    new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false }),
  );
  label.position.set(0, 0.18, 0.07);
  label.renderOrder = 3;
  group.add(label);

  const hitArea = new THREE.Mesh(
    new THREE.PlaneGeometry(SLIDER_WIDTH + 0.1, 0.2),
    new THREE.MeshBasicMaterial({
      color: "#ffffff",
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
  );
  hitArea.position.z = 0.08;
  hitArea.userData.kind = "slider";
  hitArea.userData.controlId = "robustness-slider";
  group.add(hitArea);

  const rail = new THREE.Mesh(
    new THREE.BoxGeometry(SLIDER_WIDTH, 0.028, 0.04),
    new THREE.MeshStandardMaterial({ color: "#dfe5df", roughness: 0.55 }),
  );
  group.add(rail);

  const ticks = stressTests.map((_, index) => {
    const tickMaterial = new THREE.MeshStandardMaterial({ color: "#9ba8a4", roughness: 0.5 });
    const tick = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.076, 0.05), tickMaterial);
    const normalized = stressTests.length <= 1 ? 0 : index / (stressTests.length - 1);
    tick.position.set(SLIDER_MIN_X + normalized * SLIDER_WIDTH, 0, 0.018);
    group.add(tick);
    return { mesh: tick, material: tickMaterial };
  });

  const fill = new THREE.Mesh(
    new THREE.BoxGeometry(SLIDER_WIDTH, 0.035, 0.046),
    new THREE.MeshStandardMaterial({ color: "#2d837b", roughness: 0.42 }),
  );
  fill.position.z = 0.012;
  group.add(fill);

  const handleMaterial = new THREE.MeshStandardMaterial({
    color: "#f8f6ee",
    emissive: "#000000",
    roughness: 0.38,
    metalness: 0.04,
  });
  const handle = new THREE.Mesh(new THREE.SphereGeometry(0.062, 28, 18), handleMaterial);
  handle.position.z = 0.036;
  handle.userData.kind = "slider";
  handle.userData.controlId = "robustness-slider";
  group.add(handle);

  return { group, label, hitArea, fill, ticks, handle, handleMaterial };
}

function createFigureInspector(scene) {
  const group = new THREE.Group();
  group.position.set(0, FIGURE_INSPECTOR_Y, FIGURE_INSPECTOR_Z);
  group.visible = false;
  scene.add(group);

  const backplate = new THREE.Mesh(
    new THREE.BoxGeometry(FIGURE_INSPECTOR_W + 0.1, FIGURE_INSPECTOR_H + 0.1, 0.035),
    new THREE.MeshStandardMaterial({ color: "#263236", roughness: 0.58, metalness: 0.03 }),
  );
  backplate.position.z = -0.035;
  group.add(backplate);

  const surfaceMaterial = new THREE.MeshBasicMaterial({
    transparent: false,
    toneMapped: false,
  });
  const surface = new THREE.Mesh(
    new THREE.PlaneGeometry(FIGURE_INSPECTOR_W, FIGURE_INSPECTOR_H),
    surfaceMaterial,
  );
  surface.userData.kind = "figure-inspector-surface";
  surface.userData.controlId = "figure-inspector-surface";
  group.add(surface);

  const closeMaterial = new THREE.MeshBasicMaterial({
    map: textureFromCanvas(createCloseButtonTexture(false)),
    transparent: true,
    toneMapped: false,
  });
  const close = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.28), closeMaterial);
  close.position.set(FIGURE_INSPECTOR_W / 2 - 0.18, FIGURE_INSPECTOR_H / 2 - 0.18, 0.05);
  close.userData.kind = "figure-inspector-close";
  close.userData.controlId = "figure-inspector-close";
  group.add(close);

  return { group, surface, surfaceMaterial, close, closeMaterial };
}

function createRankingSet(scene) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(PANEL_W, PANEL_H),
    new THREE.MeshBasicMaterial({ transparent: false, toneMapped: false }),
  );
  board.position.set(-2.62, LAYOUT.panelY, LAYOUT.panelZ + 0.04);
  board.rotation.y = 0.2;
  group.add(board);

  const cards = comparisonDesigns.map((design) => {
    const material = new THREE.MeshBasicMaterial({
      map: textureFromCanvas(createComparisonCardTexture(design, 1)),
      transparent: true,
      toneMapped: false,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(RANK_CARD_W, RANK_CARD_H), material);
    mesh.position.copy(RANK_CARD_SLOTS[0]);
    mesh.userData.kind = "rank-card";
    mesh.userData.controlId = `rank-card-${design.id}`;
    mesh.userData.designId = design.id;

    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(RANK_CARD_W + 0.045, RANK_CARD_H + 0.045, 0.026),
      new THREE.MeshStandardMaterial({ color: "#263236", roughness: 0.62 }),
    );
    frame.position.z = -0.03;
    mesh.add(frame);

    group.add(mesh);
    return { id: design.id, design, mesh, material, frame, rank: null };
  });

  return {
    group,
    board,
    cards,
    cardsById: new Map(cards.map((card) => [card.id, card])),
  };
}

function updateInWorldControlVisibility(
  mainButtons,
  checkButtons,
  robustnessSlider,
  rankingSet,
  workbenchControlDeck,
  sceneState,
  isImmersive,
  state,
) {
  const phase = state?.modulePhase ?? MODULE_PHASES.INTRO;
  const isExamplePhase = phase === MODULE_PHASES.EXAMPLES;
  const hasSceneNavigation = moduleScenes.length > 1;
  const supportsInterventions = isExamplePhase && sceneState.type === "color";
  const supportsSlider = isExamplePhase && sceneState.type === "color";
  const example = visualizationExampleByIndex(state?.exampleIndex ?? 0);
  const paletteOptionIds = new Set(paletteOptionsForExample(example).map((option) => option.id));
  const labelOptionIds = new Set(labelOptionsForExample(example).map((option) => option.id));
  const cueOptions = cueOptionsForExample(example);
  const cueOptionIds = new Set(cueOptions.map((option) => option.id));
  const usesCueChoiceGroup = cueOptions.length > 2;
  const readyForChallenge = allExamplesSubmitted(state?.submittedExamples, visualizationExamples);
  const challenge = transferChallengeById(state?.selectedChallengeId);

  mainButtons.forEach((button) => {
    const isNavigation = button.id === "back" || button.id === "next";
    const isExampleControl = button.id.startsWith("example-");
    const isTransferChoice = button.id.startsWith("transfer-choice-");
    const isCueNoneChoice = button.action === "setCueVariant" && button.payload?.variant === "none";
    const isInterventionControl =
      button.id === "original" ||
      button.id === "recommended" ||
      button.action === "setPaletteVariant" ||
      button.action === "setCueVariant" ||
      button.action === "setLabelMode" ||
      INTERVENTION_KEYS.includes(button.payload?.key);
    const isSupportedPaletteChoice =
      button.action !== "setPaletteVariant" || paletteOptionIds.has(button.payload?.variant);
    const isSupportedLabelChoice =
      button.action !== "setLabelMode" || labelOptionIds.has(button.payload?.mode);
    const isSupportedCueChoice =
      button.action !== "setCueVariant" || cueOptionIds.has(button.payload?.variant);
    const isSupportedInterventionChoice =
      !INTERVENTION_KEYS.includes(button.payload?.key) ||
      Boolean(interventionMetadataForExample(example, button.payload.key));
    const phaseMatches = !button.phases || button.phases.includes(phase);
    const transferChoiceIndex = Number(button.payload?.choiceIndex);
    const hasTransferChoice =
      !isTransferChoice ||
      (Number.isInteger(transferChoiceIndex) && Boolean(challenge.choices?.[transferChoiceIndex]));

    const visible =
      isImmersive &&
      phaseMatches &&
      (!isNavigation || (isExamplePhase && hasSceneNavigation)) &&
      (!isExampleControl || (sceneState.type === "color" && visualizationExamples.length > 1)) &&
      (!isInterventionControl || supportsInterventions) &&
      (!isCueNoneChoice || usesCueChoiceGroup) &&
      (!isTransferChoice || hasTransferChoice) &&
      (button.id !== "continue-challenge" || readyForChallenge) &&
      (button.id !== "submit-transfer" || !state?.transferSubmitted) &&
      (button.id !== "continue-takeaways" || Boolean(state?.transferSubmitted)) &&
      (button.id !== "restart-module" || phase !== MODULE_PHASES.TRANSFER || Boolean(state?.transferSubmitted)) &&
      isSupportedPaletteChoice &&
      isSupportedLabelChoice &&
      isSupportedCueChoice &&
      isSupportedInterventionChoice;

    positionControlFace(button.mesh, button);
    button.mesh.visible = visible;
    button.mesh.userData.disabled = buttonDisabled(button, state, readyForChallenge, challenge);
  });
  setInWorldControlsVisible(checkButtons, isImmersive && isExamplePhase && sceneState.type === "comparison");
  robustnessSlider.group.visible = isImmersive && supportsSlider;
  workbenchControlDeck.visible = isImmersive && supportsSlider;
  rankingSet.group.visible = isImmersive && isExamplePhase && sceneState.type === "comparison";
}

function buttonDisabled(button, state, readyForChallenge, challenge) {
  if (button.id === "continue-challenge") return !readyForChallenge;
  if (button.id === "submit-transfer") {
    return !transferChoiceById(challenge, state?.transferAnswer) || Boolean(state?.transferSubmitted);
  }
  if (button.id === "continue-takeaways") return !state?.transferSubmitted;
  return false;
}

function updateRobustnessSlider(slider, value, hoverControl, dragState) {
  if (!slider.group.visible) return;
  const index = clampStressTestIndex(value);
  const normalized = stressTests.length <= 1 ? 0 : index / (stressTests.length - 1);
  const x = SLIDER_MIN_X + normalized * SLIDER_WIDTH;
  const active = hoverControl === slider.handle.userData.controlId || dragState?.type === "slider";

  slider.handle.position.x = x;
  slider.handle.scale.setScalar(active ? 1.16 : 1);
  slider.handleMaterial.color.set(active ? "#ffffff" : "#f8f6ee");
  slider.handleMaterial.emissive.set(active ? "#123331" : "#000000");
  slider.fill.scale.x = Math.max(normalized, 0.001);
  slider.fill.position.x = SLIDER_MIN_X + (SLIDER_WIDTH * normalized) / 2;
  slider.ticks.forEach((tick, tickIndex) => {
    tick.material.color.set(tickIndex === index ? "#f8f6ee" : "#9ba8a4");
    tick.mesh.scale.y = tickIndex === index ? 1.22 : 1;
  });
  const labelKey = `${index}:${active ? 1 : 0}`;
  if (slider.label.userData.textureKey === labelKey) return;
  const oldMap = slider.label.material.map;
  slider.label.material.map = textureFromCanvas(createSliderLabelTexture(stressTestByIndex(index), active));
  slider.label.material.map.needsUpdate = true;
  slider.label.material.needsUpdate = true;
  slider.label.userData.textureKey = labelKey;
  if (oldMap) oldMap.dispose();
}

function updateRankingSet(rankingSet, state, hoverControl, dragState) {
  if (!rankingSet.group.visible) return;
  const oldBoardMap = rankingSet.board.material.map;
  rankingSet.board.material.map = textureFromCanvas(createRankingBoardTexture(state));
  rankingSet.board.material.map.needsUpdate = true;
  rankingSet.board.material.needsUpdate = true;
  if (oldBoardMap) oldBoardMap.dispose();

  state.ranking.forEach((id, index) => {
    const card = rankingSet.cardsById.get(id);
    if (!card) return;
    const isDragging = dragState?.type === "rank-card" && dragState.card.id === id;
    const isHovered = hoverControl === card.mesh.userData.controlId || isDragging;
    if (card.rank !== index + 1 || card.isHovered !== isHovered) {
      const oldMap = card.material.map;
      card.material.map = textureFromCanvas(createComparisonCardTexture(card.design, index + 1, isHovered));
      card.material.map.needsUpdate = true;
      card.rank = index + 1;
      card.isHovered = isHovered;
      if (oldMap) oldMap.dispose();
    }
    if (!isDragging) {
      card.mesh.position.copy(RANK_CARD_SLOTS[index]);
      card.mesh.position.z += index * 0.012;
    }
    card.mesh.scale.setScalar(isHovered ? 1.045 : 1);
    card.frame.material.color.set(isHovered ? "#2d837b" : "#263236");
  });
}

function setInWorldControlsVisible(buttons, visible) {
  buttons.forEach((button) => {
    button.mesh.visible = visible;
  });
}

function hasVisibleControls(buttons) {
  return buttons.some((button) => button.mesh.visible);
}

function createControllers(renderer, scene) {
  const factory = new XRControllerModelFactory();
  const controllers = [];
  for (let index = 0; index < 2; index += 1) {
    const controller = renderer.xr.getController(index);
    controller.userData.index = index;
    const ray = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -7)]),
      new THREE.LineBasicMaterial({ color: "#8be0d5", transparent: true, opacity: 0.75 }),
    );
    ray.name = "controller-ray";
    controller.add(ray);
    scene.add(controller);

    const grip = renderer.xr.getControllerGrip(index);
    grip.add(factory.createControllerModel(grip));
    scene.add(grip);
    controllers.push(controller);
  }
  return controllers;
}

function updatePanel(mesh, kind, sceneState, state) {
  const oldMap = mesh.material.map;
  mesh.material.map = textureFromCanvas(createPanelTexture(kind, sceneState, state));
  mesh.material.map.needsUpdate = true;
  mesh.material.needsUpdate = true;
  if (oldMap) oldMap.dispose();
}

function updateFigureInspector(inspector, inspection, sceneState, state, isImmersive, hoverControl) {
  if (!isImmersive || !inspection.open || !isFigureInspectable(inspection.kind, sceneState, state)) {
    inspector.group.visible = false;
    return;
  }

  inspector.group.visible = true;
  const oldSurfaceMap = inspector.surfaceMaterial.map;
  inspector.surfaceMaterial.map = textureFromCanvas(createFigureInspectionTexture(inspection.kind, sceneState, state, inspection));
  inspector.surfaceMaterial.map.needsUpdate = true;
  inspector.surfaceMaterial.needsUpdate = true;
  if (oldSurfaceMap) oldSurfaceMap.dispose();

  updateFigureInspectorCloseTexture(inspector, hoverControl);
}

function updateFigureInspectorCloseTexture(inspector, hoverControl) {
  if (!inspector.group.visible) return;
  const closeKey = hoverControl === "figure-inspector-close" ? "hovered" : "idle";
  if (inspector.close.userData.textureKey === closeKey) return;
  const oldCloseMap = inspector.closeMaterial.map;
  inspector.closeMaterial.map = textureFromCanvas(createCloseButtonTexture(hoverControl === "figure-inspector-close"));
  inspector.closeMaterial.map.needsUpdate = true;
  inspector.closeMaterial.needsUpdate = true;
  inspector.close.userData.textureKey = closeKey;
  if (oldCloseMap) oldCloseMap.dispose();
}

function updateInspectablePanelFrames(panels, hoverControl, inspection) {
  [
    [panels.map, "inspect-map"],
    [panels.chart, "inspect-chart"],
  ].forEach(([panel, controlId]) => {
    const frame = panel.userData.frame;
    if (!frame) return;
    const highlighted = !inspection.open && hoverControl === controlId;
    frame.material.color.set(highlighted ? "#2d837b" : "#263236");
  });
}

function isFigureInspectable(kind, sceneState, state) {
  const phase = state?.modulePhase ?? MODULE_PHASES.INTRO;
  if (kind === "chart") {
    return phase === MODULE_PHASES.EXAMPLES && sceneState?.type === "color";
  }
  if (kind === "map") {
    return !(phase === MODULE_PHASES.EXAMPLES && sceneState?.type === "comparison");
  }
  return false;
}

function createFigureInspectionTexture(kind, sceneState, state, inspection) {
  const source = createPanelTexture(kind, sceneState, state);
  const canvas = document.createElement("canvas");
  canvas.width = FIGURE_INSPECTOR_TEXTURE_W;
  canvas.height = FIGURE_INSPECTOR_TEXTURE_H;
  const ctx = canvas.getContext("2d");

  drawInspectionSource(ctx, source, canvas.width, canvas.height, inspection);
  ctx.strokeStyle = "#d3d8d2";
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
  return canvas;
}

function drawInspectionSource(ctx, source, viewWidth, viewHeight, inspection) {
  const baseScale = Math.min(viewWidth / source.width, viewHeight / source.height);
  const drawWidth = source.width * baseScale * inspection.zoom;
  const drawHeight = source.height * baseScale * inspection.zoom;
  const maxPanX = Math.max(0, (drawWidth - viewWidth) / 2);
  const maxPanY = Math.max(0, (drawHeight - viewHeight) / 2);

  inspection.panX = maxPanX > 0 ? clamp(inspection.panX, -maxPanX, maxPanX) : 0;
  inspection.panY = maxPanY > 0 ? clamp(inspection.panY, -maxPanY, maxPanY) : 0;

  ctx.fillStyle = "#f8f6ee";
  ctx.fillRect(0, 0, viewWidth, viewHeight);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    source,
    (viewWidth - drawWidth) / 2 + inspection.panX,
    (viewHeight - drawHeight) / 2 + inspection.panY,
    drawWidth,
    drawHeight,
  );
}

function createCloseButtonTexture(active) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = active ? "#ffffff" : "#f8f6ee";
  ctx.beginPath();
  ctx.arc(128, 128, 106, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = active ? "#55c6ba" : "#263236";
  ctx.lineWidth = active ? 14 : 10;
  ctx.stroke();
  ctx.strokeStyle = "#151d20";
  ctx.lineWidth = 18;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(88, 88);
  ctx.lineTo(168, 168);
  ctx.moveTo(168, 88);
  ctx.lineTo(88, 168);
  ctx.stroke();
  return canvas;
}

function updateButtonTextures(buttons, hoverControl, state) {
  buttons.forEach((button) => {
    if (button.hitOnly) {
      if (button.mesh.material.opacity !== 0) {
        button.mesh.material.opacity = 0;
        button.mesh.material.needsUpdate = true;
      }
      return;
    }
    if (!button.mesh.visible) return;

    const textureSpec = buttonTextureSpec(button, state);
    const isHovered = hoverControl === button.id;
    const disabled = Boolean(button.mesh.userData.disabled);
    const isActive = !disabled && (textureSpec.active || isHovered);
    const textureKey = buttonTextureKey(textureSpec, isActive, disabled);
    if (button.mesh.userData.textureKey === textureKey) return;
    const oldMap = button.mesh.material.map;
    button.mesh.material.map = textureFromCanvas(
      createButtonTexture(textureSpec.label, isActive, textureSpec.options),
    );
    button.mesh.material.map.needsUpdate = true;
    button.mesh.material.opacity = disabled ? 0.42 : 1;
    button.mesh.material.needsUpdate = true;
    button.mesh.userData.textureKey = textureKey;
    if (oldMap) oldMap.dispose();
  });
}

function buttonTextureKey(textureSpec, isActive, disabled) {
  return [
    textureSpec.label,
    isActive ? "active" : "idle",
    disabled ? "disabled" : "enabled",
    JSON.stringify(textureSpec.options ?? {}),
  ].join("|");
}

function buttonTextureSpec(button, state) {
  if (button.id === "start-module") {
    return {
      label: introCopy.startLabel,
      active: false,
      options: {
        accent: true,
        surface: "light",
      },
    };
  }

  if (button.id.startsWith("example-")) {
    const index = Number(button.payload?.index);
    const example = visualizationExampleByIndex(index);
    const active = index === (state.exampleIndex ?? 0);
    const submitted = Boolean(state.submittedExamples?.[example.id]);
    return {
      label: example.vrTabLabel ?? example.panelSubtitle?.replace("/", "/\n") ?? example.shortTitle,
      active,
      options: {
        accent: submitted && !active,
      },
    };
  }

  if (button.id === "submit-design") {
    const example = visualizationExampleByIndex(state.exampleIndex ?? 0);
    const submitted = Boolean(state.submittedExamples?.[example.id]);
    return {
      label: submitted ? "Resubmit\nDesign" : "Submit\nDesign",
      active: false,
      options: {
        accent: true,
      },
    };
  }

  if (button.id === "continue-challenge") {
    return {
      label: "Continue\nto Challenge",
      active: false,
      options: {
        accent: true,
      },
    };
  }

  if (button.id.startsWith("transfer-choice-")) {
    const challenge = transferChallengeById(state.selectedChallengeId);
    const choice = challenge.choices?.[Number(button.payload?.choiceIndex)];
    const active = choice?.id === state.transferAnswer;
    const correct = Boolean(state.transferSubmitted && choice?.id === challenge.correctChoiceId);
    return {
      label: wrapButtonLabel(choice?.label ?? button.label, 18),
      active: active || correct,
      options: {
        accent: correct,
      },
    };
  }

  if (button.id === "submit-transfer") {
    return {
      label: "Submit Answer",
      active: false,
      options: {
        accent: true,
        surface: "light",
      },
    };
  }

  if (button.id === "continue-takeaways") {
    return {
      label: "Continue",
      active: false,
      options: {
        accent: true,
      },
    };
  }

  if (button.id === "restart-module") {
    return {
      label: "Restart\nModule",
      active: false,
      options: {
        accent: true,
      },
    };
  }

  if (button.id === "original") {
    const active = !hasActiveInterventions(state.workbench?.interventions);
    return {
      label: "Reset\nall",
      active,
      options: {},
    };
  }

  if (button.action === "setPaletteVariant") {
    const example = visualizationExampleByIndex(state.exampleIndex ?? 0);
    const option = paletteOptionsForExample(example).find((item) => item.id === button.payload?.variant);
    const active = paletteVariantFromInterventions(state.workbench?.interventions) === button.payload?.variant;
    return {
      label: designChoiceButtonLabel(option?.label ?? button.label),
      active,
      options: {},
    };
  }

  if (button.action === "setLabelMode") {
    const example = visualizationExampleByIndex(state.exampleIndex ?? 0);
    const option = labelOptionsForExample(example).find((item) => item.id === button.payload?.mode);
    const active = labelModeFromInterventions(state.workbench?.interventions) === button.payload?.mode;
    return {
      label: designChoiceButtonLabel(option?.label ?? button.label),
      active,
      options: {},
    };
  }

  if (button.action === "setCueVariant") {
    const example = visualizationExampleByIndex(state.exampleIndex ?? 0);
    const option = cueOptionsForExample(example).find((item) => item.id === button.payload?.variant);
    const active = cueVariantFromInterventions(state.workbench?.interventions) === button.payload?.variant;
    return {
      label: designChoiceButtonLabel(option?.label ?? button.label),
      active,
      options: {},
    };
  }

  if (INTERVENTION_KEYS.includes(button.payload?.key)) {
    const key = button.payload.key;
    const example = visualizationExampleByIndex(state.exampleIndex ?? 0);
    const metadata = interventionMetadataForExample(example, key);
    const interventions = normalizeInterventions(state.workbench?.interventions);
    const active = Boolean(interventions[key]);
    return {
      label: designChoiceButtonLabel(metadata?.label ?? button.label),
      active,
      options: {},
    };
  }

  return {
    label: button.label,
    active: false,
    options: {},
  };
}

function designChoiceButtonLabel(label) {
  return wrapButtonLabel(label, 14);
}

function wrapButtonLabel(label, maxChars = 18) {
  const words = String(label).split(" ");
  const lines = [];
  let line = "";
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  });
  if (line) lines.push(line);
  return lines.slice(0, 2).join("\n");
}

function createSliderLabelTexture(stressTest, active) {
  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 160;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = active ? "#132628" : "#11191c";
  roundRect(ctx, 10, 10, canvas.width - 20, canvas.height - 20, 14);
  ctx.fill();
  ctx.strokeStyle = active ? "#88e0d6" : "#3d4d50";
  ctx.lineWidth = active ? 6 : 3;
  roundRect(ctx, 10, 10, canvas.width - 20, canvas.height - 20, 14);
  ctx.stroke();
  ctx.fillStyle = "#f8f6ee";
  ctx.font = "900 34px Arial";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("Stress Test", 38, 46);
  ctx.fillStyle = active ? "#88e0d6" : "#c5ccc7";
  ctx.font = "900 35px Arial";
  ctx.fillText(stressTest.shortLabel, 38, 92);
  if (stressTest.frequency) {
    ctx.fillStyle = "#f2c75e";
    ctx.font = "800 24px Arial";
    ctx.fillText(stressTest.frequency, 38, 130);
  }
  ctx.fillStyle = "#9eadac";
  ctx.font = "800 23px Arial";
  ctx.textAlign = "right";
  ctx.fillText(`${stressTests.indexOf(stressTest) + 1}/${stressTests.length}`, canvas.width - 38, 92);
  return canvas;
}

function createRankingBoardTexture(state) {
  const canvas = document.createElement("canvas");
  canvas.width = 1400;
  canvas.height = 980;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = state.settings.highContrast ? "#ffffff" : "#f8f6ee";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = state.settings.highContrast ? "#111719" : "#d3d8d2";
  ctx.lineWidth = 12;
  ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);
  ctx.fillStyle = "#151d20";
  ctx.font = "900 52px Arial";
  ctx.fillText("Ranked design set", 84, 88);
  ctx.fillStyle = "#536164";
  ctx.font = "700 28px Arial";
  ctx.fillText("Most robust to least robust", 86, 126);

  const slots = ["Most robust", "Middle", "Least robust"];
  slots.forEach((label, index) => {
    const x = 96 + index * 420;
    ctx.fillStyle = "#e7ece7";
    roundRect(ctx, x, 188, 360, 640, 18);
    ctx.fill();
    ctx.strokeStyle = "#bfc8c0";
    ctx.lineWidth = 5;
    roundRect(ctx, x, 188, 360, 640, 18);
    ctx.stroke();
    ctx.fillStyle = "#151d20";
    ctx.font = "900 30px Arial";
    ctx.fillText(`${index + 1}. ${label}`, x + 34, 878);
  });

  ctx.fillStyle = "#536164";
  ctx.font = "700 25px Arial";
  ctx.fillText("Point, hold trigger or grip, drag a card, and release into a slot. Then select Check.", 96, 932);
  return canvas;
}

function textureFromCanvas(canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

function setRayFromController(controller, raycaster) {
  const tempMatrix = new THREE.Matrix4();
  tempMatrix.identity().extractRotation(controller.matrixWorld);
  raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
  raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
}

function intersectController(controller, raycaster, objects) {
  setRayFromController(controller, raycaster);
  return raycaster.intersectObjects(objects, false)[0] ?? null;
}

function intersectControllerTouch(controller, raycaster, objects) {
  setRayFromController(controller, raycaster);
  raycaster.near = 0;
  raycaster.far = WORKBENCH_TOUCH_RAY_LENGTH;
  return raycaster.intersectObjects(objects, false)[0] ?? controllerProximityTouch(controller, objects);
}

function controllerProximityTouch(controller, objects) {
  controller.updateWorldMatrix(true, false);
  const rotation = new THREE.Matrix4().identity().extractRotation(controller.matrixWorld);
  const touchPoint = new THREE.Vector3().setFromMatrixPosition(controller.matrixWorld);
  touchPoint.addScaledVector(new THREE.Vector3(0, 0, -1).applyMatrix4(rotation), WORKBENCH_TOUCH_TIP_OFFSET);

  let bestHit = null;
  objects.forEach((object) => {
    const width = object.geometry?.parameters?.width;
    const height = object.geometry?.parameters?.height;
    if (!width || !height) return;

    object.updateWorldMatrix(true, false);
    const local = object.worldToLocal(touchPoint.clone());
    const halfW = width / 2 + WORKBENCH_TOUCH_MARGIN;
    const halfH = height / 2 + WORKBENCH_TOUCH_MARGIN;
    const depth = Math.abs(local.z);
    if (Math.abs(local.x) > halfW || Math.abs(local.y) > halfH || depth > WORKBENCH_TOUCH_DEPTH) {
      return;
    }

    if (!bestHit || depth < bestHit.depth) {
      const planePoint = object.localToWorld(new THREE.Vector3(
        clamp(local.x, -width / 2, width / 2),
        clamp(local.y, -height / 2, height / 2),
        0,
      ));
      bestHit = { object, point: planePoint, depth };
    }
  });

  return bestHit;
}

function controllerPlanePoint(controller, raycaster, z) {
  setRayFromController(controller, raycaster);
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -z);
  const point = new THREE.Vector3();
  return raycaster.ray.intersectPlane(plane, point) ? point : null;
}

function controllerLocalPoint(controller, raycaster, object) {
  setRayFromController(controller, raycaster);
  object.updateWorldMatrix(true, false);
  const worldPosition = new THREE.Vector3();
  const worldQuaternion = new THREE.Quaternion();
  object.getWorldPosition(worldPosition);
  object.getWorldQuaternion(worldQuaternion);
  const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(worldQuaternion);
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, worldPosition);
  const worldPoint = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(plane, worldPoint)) return null;
  return object.worldToLocal(worldPoint);
}

function updateControllerHover(controllers, raycaster, objects, onHover) {
  const visibleObjects = getVisibleInteractiveObjects(objects);
  if (!visibleObjects.length) {
    onHover(null);
    return;
  }
  for (const controller of controllers) {
    if (!controller.visible) continue;
    const hit = intersectController(controller, raycaster, visibleObjects);
    if (hit?.object.userData.controlId) {
      onHover(hit.object.userData.controlId);
      return;
    }
  }
  onHover(null);
}

function getVisibleInteractiveObjects(objects) {
  return objects.filter((object) => isObjectVisibleInWorld(object));
}

function isObjectVisibleInWorld(object) {
  let current = object;
  while (current) {
    if (!current.visible) return false;
    current = current.parent;
  }
  return true;
}

function rankingAfterDrop(ranking, droppedId, droppedX) {
  const targetIndex = RANK_CARD_SLOTS.reduce(
    (best, slot, index) => {
      const distance = Math.abs(slot.x - droppedX);
      return distance < best.distance ? { index, distance } : best;
    },
    { index: 0, distance: Number.POSITIVE_INFINITY },
  ).index;
  const next = ranking.filter((id) => id !== droppedId);
  next.splice(targetIndex, 0, droppedId);
  return next;
}

function pulseController(controller) {
  const gamepad = controller.inputSource?.gamepad;
  const actuator = gamepad?.hapticActuators?.[0];
  if (actuator?.pulse) actuator.pulse(0.35, 60);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  let yy = y;
  words.forEach((word, index) => {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineHeight;
    } else {
      line = test;
    }
    if (index === words.length - 1) ctx.fillText(line, x, yy);
  });
}

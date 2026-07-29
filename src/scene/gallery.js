import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { XRControllerModelFactory } from "three/addons/webxr/XRControllerModelFactory.js";
import {
  INTERVENTION_KEYS,
  hasActiveInterventions,
  labelModeFromInterventions,
  normalizeInterventions,
  paletteVariantFromInterventions,
} from "../config/interventions.js";
import { comparisonDesigns, moduleScenes } from "../config/lesson.js";
import { clampStressTestIndex, stressTestByIndex, stressTests } from "../config/stressTests.js";
import {
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
const SIDE_PANEL_X = 2.86;
const TASK_PANEL_W = 1.92;
const TASK_PANEL_H = 1.68;
const CONTROL_BUTTON_H = 0.19;
const LAYOUT = {
  desktopCameraZ: 6.2,
  desktopTargetZ: -3.15,
  floorZ: -2.7,
  wallZ: -5.9,
  workbenchY: 0.58,
  workbenchZ: -2.55,
  controlDeckY: 0.68,
  controlDeckZ: -2.0,
  controlDeckRotationX: -0.72,
  buttonY: 0.71,
  buttonZ: -1.96,
  panelY: 1.84,
  panelZ: -4.18,
  taskZ: -4.18,
};
const CONTROL_ROWS = {
  upper: 0.14,
  lower: -0.15,
};
const TASK_PANEL_CENTER_Y = LAYOUT.panelY - 0.08;
const EXAMPLE_BUTTON_X = 0.5;
const EXAMPLE_BUTTON_Y_OFFSET = TASK_PANEL_H / 2 - 0.18;
const EXAMPLE_BUTTON_Z_OFFSET = 0.05;
const BUTTONS = [
  { id: "back", action: "back", label: "Back", x: -1.22, width: 0.42, deckY: CONTROL_ROWS.upper },
  { id: "next", action: "next", label: "Next", x: -0.8, width: 0.42, deckY: CONTROL_ROWS.upper },
  {
    id: "example",
    action: "nextExample",
    label: "Switch\nExample",
    x: EXAMPLE_BUTTON_X,
    y: TASK_PANEL_CENTER_Y + EXAMPLE_BUTTON_Y_OFFSET,
    z: LAYOUT.taskZ + EXAMPLE_BUTTON_Z_OFFSET,
    width: 0.84,
    height: 0.28,
    rotationX: 0,
  },
  { id: "palette-original", action: "setPaletteVariant", payload: { variant: "original" }, label: "Palette\n1", x: 0.08, width: 0.3, deckY: CONTROL_ROWS.upper },
  { id: "palette", action: "setPaletteVariant", payload: { variant: "palette" }, label: "Palette\n2", x: 0.42, width: 0.3, deckY: CONTROL_ROWS.upper },
  { id: "palette-alt", action: "setPaletteVariant", payload: { variant: "paletteAlt" }, label: "Palette\n3", x: 0.76, width: 0.3, deckY: CONTROL_ROWS.upper },
  { id: "original", action: "clearInterventions", label: "Reset\nAll", x: 1.18, width: 0.34, deckY: CONTROL_ROWS.upper },
  { id: "label-none", action: "setLabelMode", payload: { mode: "none" }, label: "No\nLabels", x: 0.08, width: 0.3, deckY: CONTROL_ROWS.lower },
  { id: "labels", action: "setLabelMode", payload: { mode: "labels" }, label: "Selected\nLabels", x: 0.44, width: 0.34, deckY: CONTROL_ROWS.lower },
  { id: "all-labels", action: "setLabelMode", payload: { mode: "allLabels" }, label: "All\nLabels", x: 0.82, width: 0.3, deckY: CONTROL_ROWS.lower },
  { id: "cue", action: "toggleIntervention", payload: { key: "redundantCue" }, label: "Cue", x: 1.18, width: 0.34, deckY: CONTROL_ROWS.lower },
];
const CHECK_BUTTONS = [
  { id: "rank-check", action: "checkRanking", label: "Check", x: -2.62, y: 0.8, z: -3.35, width: 0.82 },
];
const SLIDER_WIDTH = 1.24;
const SLIDER_MIN_X = -SLIDER_WIDTH / 2;
const SLIDER_MAX_X = SLIDER_WIDTH / 2;
const SLIDER_CENTER = workbenchDeckPosition(-0.76, CONTROL_ROWS.lower);
const SNAP_TURN_RADIANS = THREE.MathUtils.degToRad(30);
const SNAP_TURN_THRESHOLD = 0.72;
const SNAP_TURN_RESET_THRESHOLD = 0.35;
const SNAP_TURN_AXIS = new THREE.Vector3(0, 1, 0);
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
  return new THREE.Vector3(
    x,
    LAYOUT.controlDeckY + Math.cos(LAYOUT.controlDeckRotationX) * deckY,
    LAYOUT.controlDeckZ + Math.sin(LAYOUT.controlDeckRotationX) * deckY,
  );
}

function controlPosition(control) {
  if (control.y !== undefined && control.z !== undefined) {
    return new THREE.Vector3(control.x, control.y, control.z);
  }

  return workbenchDeckPosition(control.x, control.deckY ?? 0);
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
  const rankingSet = createRankingSet(stage);
  const controllers = createControllers(renderer, scene);
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const snapTurnPivot = new THREE.Vector3();
  const interactive = [
    ...inWorldButtons.map((button) => button.mesh),
    robustnessSlider.hitArea,
    robustnessSlider.handle,
    ...rankingSet.cards.map((card) => card.mesh),
  ];

  let hoverControl = null;
  let dragState = null;
  let currentState = {
    sceneIndex: 0,
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

  function renderState(state) {
    currentState = state;
    const sceneState = moduleScenes[state.sceneIndex];
    const isImmersive = Boolean(currentSession);
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
    panels.map.visible = !(isImmersive && sceneState.type === "comparison");
    updatePanel(panels.map, "map", sceneState, state);
    updatePanel(panels.task, "task", sceneState, state);
    updatePanel(panels.chart, "chart", sceneState, state);
    updateButtonTextures(inWorldButtons, hoverControl, state);
    updateRobustnessSlider(robustnessSlider, state.workbench.stressTestIndex, hoverControl, dragState);
    updateRankingSet(rankingSet, state, hoverControl, dragState);
    world.accent.visible = !state.settings.highContrast;
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
        resetSnapTurn();
        setInWorldControlsVisible(inWorldButtons, false);
        robustnessSlider.group.visible = false;
        rankingSet.group.visible = false;
        workbenchControlDeck.visible = false;
        panels.map.visible = true;
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
    if (hit?.object.userData.action) {
      selectAction(hit.object.userData.action, hit.object.userData.payload ?? {});
    }
  }

  function beginControllerInteraction(controller) {
    const hit = intersectController(controller, raycaster, getVisibleInteractiveObjects(interactive));
    const target = hit?.object;
    if (!target) return;

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

  function endControllerInteraction(controller) {
    if (!dragState || dragState.controller !== controller) return;
    const endedDrag = dragState;
    dragState = null;

    if (endedDrag.type === "rank-card") {
      const nextRanking = rankingAfterDrop(currentState.ranking, endedDrag.card.id, endedDrag.card.mesh.position.x);
      selectAction("setRanking", { ranking: nextRanking });
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
    }
  }

  function updateSliderFromController(controller) {
    const point = controllerLocalPoint(controller, raycaster, robustnessSlider.group);
    if (!point) return;
    const localX = clamp(point.x, SLIDER_MIN_X, SLIDER_MAX_X);
    const normalized = (localX - SLIDER_MIN_X) / SLIDER_WIDTH;
    const index = clampStressTestIndex(normalized * (stressTests.length - 1));
    if (index !== clampStressTestIndex(currentState.workbench.stressTestIndex)) {
      selectAction("setStressTest", { index });
    }
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

  renderer.domElement.addEventListener("pointermove", onPointerMove);
  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("resize", onResize);

  controllers.forEach((controller) => {
    controller.addEventListener("selectstart", () => beginControllerInteraction(controller));
    controller.addEventListener("selectend", () => endControllerInteraction(controller));
    controller.addEventListener("squeezestart", () => beginControllerInteraction(controller));
    controller.addEventListener("squeezeend", () => endControllerInteraction(controller));
  });

  renderer.setAnimationLoop(() => {
    if (!currentSession) controls.update();
    else updateSnapTurn();
    if (dragState) updateDragState(dragState);
    panels.map.position.y = LAYOUT.panelY;
    panels.chart.position.y = LAYOUT.panelY;
    panels.task.position.y = TASK_PANEL_CENTER_Y;
    if (exampleButton?.mesh.visible) {
      exampleButton.mesh.position.y = panels.task.position.y + EXAMPLE_BUTTON_Y_OFFSET;
      exampleButton.mesh.position.z = panels.task.position.z + EXAMPLE_BUTTON_Z_OFFSET;
    }
    stage.updateMatrixWorld(true);
    updateControllerHover(controllers, raycaster, interactive, (controlId) => {
      if (controlId !== hoverControl) {
        hoverControl = controlId;
        updateButtonTextures(inWorldButtons, hoverControl, currentState);
        updateRobustnessSlider(robustnessSlider, currentState.workbench.stressTestIndex, hoverControl, dragState);
        updateRankingSet(rankingSet, currentState, hoverControl, dragState);
      }
    });
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
  [map, task, chart].forEach((panel) => group.add(panel));
  return { group, map, task, chart };
}

function createWorkbenchControlDeck(scene) {
  const group = new THREE.Group();
  group.position.set(0.04, LAYOUT.controlDeckY, LAYOUT.controlDeckZ);
  group.rotation.x = LAYOUT.controlDeckRotationX;
  group.visible = false;
  scene.add(group);

  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(2.98, 0.56, 0.045),
    new THREE.MeshStandardMaterial({
      color: "#11191c",
      roughness: 0.62,
      metalness: 0.06,
    }),
  );
  deck.position.z = -0.032;
  group.add(deck);

  const bevel = new THREE.Mesh(
    new THREE.BoxGeometry(3.06, 0.064, 0.06),
    new THREE.MeshStandardMaterial({ color: "#2b383b", roughness: 0.56 }),
  );
  bevel.position.set(0, -0.288, -0.014);
  group.add(bevel);

  const separator = new THREE.Mesh(
    new THREE.BoxGeometry(0.028, 0.45, 0.016),
    new THREE.MeshStandardMaterial({ color: "#344346", roughness: 0.5 }),
  );
  separator.position.set(0.03, 0.015, 0.011);
  group.add(separator);

  return group;
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
  return mesh;
}

function createButtons(scene, buttons, defaults = {}) {
  const width = defaults.width ?? 0.66;
  const height = defaults.height ?? CONTROL_BUTTON_H;
  const rotationX = defaults.rotationX ?? LAYOUT.controlDeckRotationX;
  return buttons.map((button) => {
    const texture = textureFromCanvas(createButtonTexture(button.label, false));
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false });
    const buttonWidth = button.width ?? width;
    const buttonHeight = button.height ?? height;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(buttonWidth, buttonHeight), material);
    mesh.position.copy(controlPosition(button));
    mesh.rotation.x = button.rotationX ?? rotationX;
    mesh.rotation.y = button.rotationY ?? 0;
    mesh.visible = false;

    const base = new THREE.Mesh(
      new THREE.BoxGeometry(buttonWidth + 0.028, buttonHeight + 0.028, 0.03),
      new THREE.MeshStandardMaterial({ color: "#263236", roughness: 0.48, metalness: 0.04 }),
    );
    base.position.z = -0.023;
    mesh.add(base);

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
  group.visible = false;
  scene.add(group);

  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(1.26, 0.16),
    new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false }),
  );
  label.position.y = 0.176;
  group.add(label);

  const hitArea = new THREE.Mesh(
    new THREE.PlaneGeometry(SLIDER_WIDTH + 0.13, 0.22),
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
  const handle = new THREE.Mesh(new THREE.SphereGeometry(0.068, 28, 18), handleMaterial);
  handle.position.z = 0.036;
  handle.userData.kind = "slider";
  handle.userData.controlId = "robustness-slider";
  group.add(handle);

  return { group, label, hitArea, fill, ticks, handle, handleMaterial };
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
  const hasSceneNavigation = moduleScenes.length > 1;
  const supportsInterventions = sceneState.type === "color";
  const supportsSlider =
    sceneState.type === "orientation" || sceneState.type === "color" || sceneState.type === "contrast";
  const example = visualizationExampleByIndex(state?.exampleIndex ?? 0);
  const paletteOptionIds = new Set(paletteOptionsForExample(example).map((option) => option.id));
  const labelOptionIds = new Set(labelOptionsForExample(example).map((option) => option.id));

  mainButtons.forEach((button) => {
    const isNavigation = button.id === "back" || button.id === "next";
    const isExampleControl = button.id === "example";
    const isInterventionControl =
      button.id === "original" ||
      button.id === "recommended" ||
      button.action === "setPaletteVariant" ||
      button.action === "setLabelMode" ||
      INTERVENTION_KEYS.includes(button.payload?.key);
    const isSupportedPaletteChoice =
      button.action !== "setPaletteVariant" || paletteOptionIds.has(button.payload?.variant);
    const isSupportedLabelChoice =
      button.action !== "setLabelMode" || labelOptionIds.has(button.payload?.mode);
    button.mesh.position.copy(controlPosition(button));
    button.mesh.visible =
      isImmersive &&
      (!isNavigation || hasSceneNavigation) &&
      (!isExampleControl || (sceneState.type === "color" && visualizationExamples.length > 1)) &&
      (!isInterventionControl || supportsInterventions) &&
      isSupportedPaletteChoice &&
      isSupportedLabelChoice;
  });
  setInWorldControlsVisible(checkButtons, isImmersive && sceneState.type === "comparison");
  robustnessSlider.group.visible = isImmersive && supportsSlider;
  workbenchControlDeck.visible = isImmersive && supportsSlider;
  rankingSet.group.visible = isImmersive && sceneState.type === "comparison";
}

function updateRobustnessSlider(slider, value, hoverControl, dragState) {
  const index = clampStressTestIndex(value);
  const normalized = stressTests.length <= 1 ? 0 : index / (stressTests.length - 1);
  const x = SLIDER_MIN_X + normalized * SLIDER_WIDTH;
  const active = hoverControl === slider.handle.userData.controlId || dragState?.type === "slider";
  const oldMap = slider.label.material.map;

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
  slider.label.material.map = textureFromCanvas(createSliderLabelTexture(stressTestByIndex(index), active));
  slider.label.material.map.needsUpdate = true;
  slider.label.material.needsUpdate = true;
  if (oldMap) oldMap.dispose();
}

function updateRankingSet(rankingSet, state, hoverControl, dragState) {
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

function updateButtonTextures(buttons, hoverControl, state) {
  buttons.forEach((button) => {
    const textureSpec = buttonTextureSpec(button, state);
    const isHovered = hoverControl === button.id;
    const isActive = textureSpec.active || isHovered;
    const oldMap = button.mesh.material.map;
    button.mesh.material.map = textureFromCanvas(
      createButtonTexture(textureSpec.label, isActive, textureSpec.options),
    );
    button.mesh.material.map.needsUpdate = true;
    if (oldMap) oldMap.dispose();
  });
}

function buttonTextureSpec(button, state) {
  if (button.id === "example") {
    return {
      label: "Next\nExample",
      active: false,
      options: {
        accent: true,
        cycle: true,
        subtitle: `Example ${(state.exampleIndex ?? 0) + 1} of ${visualizationExamples.length}`,
      },
    };
  }

  if (button.id === "original") {
    const active = !hasActiveInterventions(state.workbench?.interventions);
    return {
      label: "Reset\nAll",
      active,
      options: {
        subtitle: active ? "Original" : "Clear",
      },
    };
  }

  if (button.action === "setPaletteVariant") {
    const example = visualizationExampleByIndex(state.exampleIndex ?? 0);
    const option = paletteOptionsForExample(example).find((item) => item.id === button.payload?.variant);
    const active = paletteVariantFromInterventions(state.workbench?.interventions) === button.payload?.variant;
    return {
      label: option?.vrLabel ?? option?.shortLabel ?? button.label,
      active,
      options: {
        subtitle: active ? "Active" : "Color",
      },
    };
  }

  if (button.action === "setLabelMode") {
    const example = visualizationExampleByIndex(state.exampleIndex ?? 0);
    const option = labelOptionsForExample(example).find((item) => item.id === button.payload?.mode);
    const active = labelModeFromInterventions(state.workbench?.interventions) === button.payload?.mode;
    return {
      label: option?.vrLabel ?? option?.shortLabel ?? button.label,
      active,
      options: {
        subtitle: active ? "Active" : "Labels",
      },
    };
  }

  if (INTERVENTION_KEYS.includes(button.payload?.key)) {
    const key = button.payload.key;
    const example = visualizationExampleByIndex(state.exampleIndex ?? 0);
    const metadata = interventionMetadataForExample(example, key);
    const interventions = normalizeInterventions(state.workbench?.interventions);
    const active = Boolean(interventions[key]);
    return {
      label: metadata?.vrLabel ?? metadata?.shortLabel ?? button.label,
      active,
      options: {
        subtitle: active ? "On" : "Off",
      },
    };
  }

  return {
    label: button.label,
    active: false,
    options: {},
  };
}

function createSliderLabelTexture(stressTest, active) {
  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 140;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = active ? "#132628" : "#11191c";
  roundRect(ctx, 10, 10, canvas.width - 20, canvas.height - 20, 14);
  ctx.fill();
  ctx.strokeStyle = active ? "#88e0d6" : "#3d4d50";
  ctx.lineWidth = active ? 6 : 3;
  roundRect(ctx, 10, 10, canvas.width - 20, canvas.height - 20, 14);
  ctx.stroke();
  ctx.fillStyle = "#f8f6ee";
  ctx.font = "900 28px Arial";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("Stress Test", 38, 50);
  ctx.fillStyle = active ? "#88e0d6" : "#c5ccc7";
  ctx.font = "900 29px Arial";
  ctx.fillText(stressTest.shortLabel, 38, 96);
  ctx.fillStyle = "#9eadac";
  ctx.font = "700 20px Arial";
  ctx.textAlign = "right";
  ctx.fillText(`${stressTests.indexOf(stressTest) + 1}/${stressTests.length}`, canvas.width - 38, 96);
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

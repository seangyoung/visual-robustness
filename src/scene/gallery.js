import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { XRControllerModelFactory } from "three/addons/webxr/XRControllerModelFactory.js";
import { comparisonDesigns, moduleScenes, MODULE_SUBTITLE, MODULE_TITLE } from "../config/lesson.js";
import {
  createButtonTexture,
  createComparisonCardTexture,
  createPanelTexture,
} from "../visualizations/colorFragility.js";

const PANEL_W = 3.3;
const PANEL_H = 2.28;
const LAYOUT = {
  desktopCameraZ: 6.2,
  desktopTargetZ: -3.15,
  floorZ: -2.7,
  wallZ: -5.9,
  workbenchY: 0.58,
  workbenchZ: -2.55,
  buttonY: 0.9,
  buttonZ: -1.82,
  panelY: 1.84,
  panelZ: -4.18,
  taskZ: -3.92,
  captionY: 0.66,
  captionZ: -2.12,
};
const BUTTONS = [
  { id: "back", action: "back", label: "Back", x: -0.84 },
  { id: "next", action: "next", label: "Next", x: 0 },
  { id: "reveal", action: "toggleRedesign", label: "Reveal", x: 0.84 },
];
const CHECK_BUTTONS = [
  { id: "rank-check", action: "checkRanking", label: "Check", x: -2.62, y: 0.8, z: -3.35, width: 0.82 },
];
const SLIDER_WIDTH = 1.55;
const SLIDER_MIN_X = -SLIDER_WIDTH / 2;
const SLIDER_MAX_X = SLIDER_WIDTH / 2;
const SLIDER_CENTER = new THREE.Vector3(0.08, 0.96, -1.86);
const RANK_CARD_W = 0.82;
const RANK_CARD_H = 1.22;
const RANK_CARD_Z = -3.54;
const RANK_CARD_Y = 1.76;
const RANK_CARD_SLOTS = [
  new THREE.Vector3(-3.62, RANK_CARD_Y, RANK_CARD_Z),
  new THREE.Vector3(-2.62, RANK_CARD_Y, RANK_CARD_Z),
  new THREE.Vector3(-1.62, RANK_CARD_Y, RANK_CARD_Z),
];

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

  const world = createWorld(scene);
  const panels = createPanels(scene);
  const mainButtons = createButtons(scene, BUTTONS);
  const checkButtons = createButtons(scene, CHECK_BUTTONS, { width: 0.82, height: 0.2, rotationX: -0.18 });
  const inWorldButtons = [...mainButtons, ...checkButtons];
  const robustnessSlider = createRobustnessSlider(scene);
  const rankingSet = createRankingSet(scene);
  const controllers = createControllers(renderer, scene);
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const interactive = [
    ...inWorldButtons.map((button) => button.mesh),
    robustnessSlider.handle,
    ...rankingSet.cards.map((card) => card.mesh),
  ];

  let hoverControl = null;
  let dragState = null;
  let currentState = {
    sceneIndex: 0,
    settings: ui.getSettings(),
    workbench: { robustness: 0, revealRedesign: false },
    ranking: [],
  };
  let currentSession = null;

  function renderState(state) {
    currentState = state;
    const sceneState = moduleScenes[state.sceneIndex];
    const isImmersive = Boolean(currentSession);
    updateInWorldControlVisibility(mainButtons, checkButtons, robustnessSlider, rankingSet, sceneState, isImmersive);
    panels.caption.visible = isImmersive;
    panels.map.visible = !(isImmersive && sceneState.type === "comparison");
    updatePanel(panels.map, "map", sceneState, state);
    updatePanel(panels.task, "task", sceneState, state);
    updatePanel(panels.chart, "chart", sceneState, state);
    updateButtonTextures(inWorldButtons, hoverControl);
    updateRobustnessSlider(robustnessSlider, state.workbench.robustness, hoverControl, dragState);
    updateRankingSet(rankingSet, state, hoverControl, dragState);
    panels.caption.material.map = textureFromCanvas(createCaptionTexture(sceneState, state));
    panels.caption.material.map.needsUpdate = true;
    panels.caption.material.needsUpdate = true;
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
        moduleScenes[currentState.sceneIndex],
        true,
      );
      session.addEventListener("end", () => {
        currentSession = null;
        dragState = null;
        setInWorldControlsVisible(inWorldButtons, false);
        robustnessSlider.group.visible = false;
        rankingSet.group.visible = false;
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
      updateButtonTextures(inWorldButtons, hoverControl);
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
      updateRobustnessSlider(robustnessSlider, currentState.workbench.robustness, hoverControl, dragState);
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

    updateRobustnessSlider(robustnessSlider, currentState.workbench.robustness, hoverControl, dragState);
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
    const point = controllerPlanePoint(controller, raycaster, SLIDER_CENTER.z);
    if (!point) return;
    const localX = clamp(point.x - SLIDER_CENTER.x, SLIDER_MIN_X, SLIDER_MAX_X);
    const value = Math.round(((localX - SLIDER_MIN_X) / SLIDER_WIDTH) * 100);
    if (value !== Math.round(currentState.workbench.robustness)) {
      selectAction("setRobustness", { value });
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

  renderer.setAnimationLoop((time) => {
    if (!currentSession) controls.update();
    if (dragState) updateDragState(dragState);
    if (!currentState.settings.reducedMotion) {
      const float = Math.sin(time * 0.0012) * 0.025;
      panels.map.position.y = LAYOUT.panelY + float;
      panels.chart.position.y = LAYOUT.panelY - float * 0.75;
      panels.task.position.y = LAYOUT.panelY - 0.08 + float * 0.45;
    }
    updateControllerHover(controllers, raycaster, interactive, (controlId) => {
      if (controlId !== hoverControl) {
        hoverControl = controlId;
        updateButtonTextures(inWorldButtons, hoverControl);
        updateRobustnessSlider(robustnessSlider, currentState.workbench.robustness, hoverControl, dragState);
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
  const map = panelMesh("map", [-2.62, LAYOUT.panelY, LAYOUT.panelZ], [0, 0.2, 0], PANEL_W, PANEL_H);
  const task = panelMesh("task", [0, LAYOUT.panelY - 0.08, LAYOUT.taskZ], [0, 0, 0], 2.35, 2.05);
  const chart = panelMesh("chart", [2.62, LAYOUT.panelY, LAYOUT.panelZ], [0, -0.2, 0], PANEL_W, PANEL_H);
  const caption = panelMesh("caption", [0, LAYOUT.captionY, LAYOUT.captionZ], [-0.28, 0, 0], 3.05, 0.56);
  [map, task, chart, caption].forEach((panel) => group.add(panel));
  return { group, map, task, chart, caption };
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
  const height = defaults.height ?? 0.2;
  const rotationX = defaults.rotationX ?? -0.18;
  return buttons.map((button) => {
    const texture = textureFromCanvas(createButtonTexture(button.label, false));
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(button.width ?? width, button.height ?? height), material);
    mesh.position.set(button.x, button.y ?? LAYOUT.buttonY, button.z ?? LAYOUT.buttonZ);
    mesh.rotation.x = button.rotationX ?? rotationX;
    mesh.rotation.y = button.rotationY ?? 0;
    mesh.visible = false;
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
  group.visible = false;
  scene.add(group);

  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(1.72, 0.32),
    new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false }),
  );
  label.position.y = 0.24;
  group.add(label);

  const rail = new THREE.Mesh(
    new THREE.BoxGeometry(SLIDER_WIDTH, 0.035, 0.05),
    new THREE.MeshStandardMaterial({ color: "#dfe5df", roughness: 0.55 }),
  );
  group.add(rail);

  const fill = new THREE.Mesh(
    new THREE.BoxGeometry(SLIDER_WIDTH, 0.044, 0.058),
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
  const handle = new THREE.Mesh(new THREE.SphereGeometry(0.085, 28, 18), handleMaterial);
  handle.position.z = 0.04;
  handle.userData.kind = "slider";
  handle.userData.controlId = "robustness-slider";
  group.add(handle);

  return { group, label, fill, handle, handleMaterial };
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

function updateInWorldControlVisibility(mainButtons, checkButtons, robustnessSlider, rankingSet, sceneState, isImmersive) {
  const supportsRedesign = sceneState.type === "color" || sceneState.type === "contrast";
  const supportsSlider =
    sceneState.type === "orientation" || sceneState.type === "color" || sceneState.type === "contrast";

  mainButtons.forEach((button) => {
    button.mesh.visible = isImmersive && (button.id !== "reveal" || supportsRedesign);
  });
  setInWorldControlsVisible(checkButtons, isImmersive && sceneState.type === "comparison");
  robustnessSlider.group.visible = isImmersive && supportsSlider;
  rankingSet.group.visible = isImmersive && sceneState.type === "comparison";
}

function updateRobustnessSlider(slider, value, hoverControl, dragState) {
  const normalized = clamp(value / 100, 0, 1);
  const x = SLIDER_MIN_X + normalized * SLIDER_WIDTH;
  const active = hoverControl === slider.handle.userData.controlId || dragState?.type === "slider";
  const oldMap = slider.label.material.map;

  slider.handle.position.x = x;
  slider.handle.scale.setScalar(active ? 1.16 : 1);
  slider.handleMaterial.color.set(active ? "#ffffff" : "#f8f6ee");
  slider.handleMaterial.emissive.set(active ? "#123331" : "#000000");
  slider.fill.scale.x = Math.max(normalized, 0.001);
  slider.fill.position.x = SLIDER_MIN_X + (SLIDER_WIDTH * normalized) / 2;
  slider.label.material.map = textureFromCanvas(createSliderLabelTexture(value, active));
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

function updateButtonTextures(buttons, hoverControl) {
  buttons.forEach((button) => {
    const oldMap = button.mesh.material.map;
    button.mesh.material.map = textureFromCanvas(createButtonTexture(button.label, hoverControl === button.id));
    button.mesh.material.map.needsUpdate = true;
    if (oldMap) oldMap.dispose();
  });
}

function createCaptionTexture(sceneState, state) {
  const canvas = document.createElement("canvas");
  canvas.width = 1300;
  canvas.height = 260;
  const ctx = canvas.getContext("2d");
  const { settings, workbench } = state;
  ctx.fillStyle = settings.highContrast ? "#0d1315" : "#11191c";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = settings.highContrast ? "#f8f6ee" : "#3d4d50";
  ctx.lineWidth = 8;
  ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
  ctx.fillStyle = "#55c6ba";
  ctx.font = "900 34px Arial";
  ctx.fillText(MODULE_TITLE, 56, 70);
  ctx.fillStyle = "#c5ccc7";
  ctx.font = "700 23px Arial";
  ctx.fillText(MODULE_SUBTITLE, 56, 105);
  ctx.fillStyle = "#f8f6ee";
  ctx.font = "800 40px Arial";
  ctx.fillText(sceneState.title, 56, 154);
  ctx.fillStyle = "#d9dfd8";
  ctx.font = "500 27px Arial";
  wrapText(
    ctx,
    captionText(sceneState, workbench),
    56,
    202,
    1130,
    34,
  );
  return canvas;
}

function captionText(sceneState, workbench) {
  if (sceneState.type === "comparison" || sceneState.type === "reflection") return sceneState.task;
  return `${sceneState.task} Test ${Math.round(workbench.robustness)}%. ${
    workbench.revealRedesign ? "Redesign visible." : "Original visible."
  }`;
}

function createSliderLabelTexture(value, active) {
  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 180;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = active ? "#132628" : "#11191c";
  roundRect(ctx, 12, 14, canvas.width - 24, canvas.height - 28, 18);
  ctx.fill();
  ctx.strokeStyle = active ? "#88e0d6" : "#3d4d50";
  ctx.lineWidth = active ? 7 : 4;
  roundRect(ctx, 12, 14, canvas.width - 24, canvas.height - 28, 18);
  ctx.stroke();
  ctx.fillStyle = "#f8f6ee";
  ctx.font = "900 44px Arial";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("Robustness Test", 52, 90);
  ctx.fillStyle = active ? "#88e0d6" : "#c5ccc7";
  ctx.font = "900 42px Arial";
  ctx.textAlign = "right";
  ctx.fillText(`${Math.round(value)}%`, canvas.width - 52, 90);
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

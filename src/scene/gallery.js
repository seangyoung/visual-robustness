import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { XRControllerModelFactory } from "three/addons/webxr/XRControllerModelFactory.js";
import { moduleScenes, MODULE_SUBTITLE, MODULE_TITLE } from "../config/lesson.js";
import { createButtonTexture, createPanelTexture } from "../visualizations/colorFragility.js";

const PANEL_W = 3.3;
const PANEL_H = 2.28;
const BUTTONS = [
  { id: "back", action: "back", label: "Back", x: -1.46, y: 0.92 },
  { id: "next", action: "next", label: "Next", x: -0.72, y: 0.92 },
  { id: "test-down", action: "adjustRobustness", label: "Test -", x: 0.08, y: 0.92, payload: { delta: -15 } },
  { id: "test-up", action: "adjustRobustness", label: "Test +", x: 0.82, y: 0.92, payload: { delta: 15 } },
  { id: "reveal", action: "toggleRedesign", label: "Reveal", x: 1.56, y: 0.92 },
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
  camera.position.set(0, 1.55, 4.8);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.46, -1.9);
  controls.enablePan = false;
  controls.enableZoom = true;
  controls.minDistance = 3.8;
  controls.maxDistance = 5.8;
  controls.rotateSpeed = 0.55;
  controls.minPolarAngle = Math.PI * 0.34;
  controls.maxPolarAngle = Math.PI * 0.58;
  controls.update();

  const world = createWorld(scene);
  const panels = createPanels(scene);
  const inWorldButtons = createButtons(scene);
  const controllers = createControllers(renderer, scene);
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const interactive = inWorldButtons.map((button) => button.mesh);

  let hoverControl = null;
  let currentState = {
    sceneIndex: 0,
    settings: ui.getSettings(),
    workbench: { robustness: 0, revealRedesign: false },
    ranking: [],
    reflections: {},
  };
  let currentSession = null;

  function renderState(state) {
    currentState = state;
    const sceneState = moduleScenes[state.sceneIndex];
    const isImmersive = Boolean(currentSession);
    setInWorldControlsVisible(inWorldButtons, isImmersive);
    panels.side.visible = isImmersive;
    panels.caption.visible = isImmersive;
    updatePanel(panels.map, "map", sceneState, state);
    updatePanel(panels.task, "task", sceneState, state);
    updatePanel(panels.chart, "chart", sceneState, state);
    updatePanel(panels.side, "side", sceneState, state);
    updateButtonTextures(inWorldButtons, hoverControl);
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
      setInWorldControlsVisible(inWorldButtons, true);
      session.addEventListener("end", () => {
        currentSession = null;
        setInWorldControlsVisible(inWorldButtons, false);
        ui.setVrMode(false);
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
    const hit = raycaster.intersectObjects(interactive, false)[0];
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
    const hit = raycaster.intersectObjects(interactive, false)[0];
    if (hit?.object.userData.action) {
      selectAction(hit.object.userData.action, hit.object.userData.payload ?? {});
    }
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
    controller.addEventListener("selectstart", () => {
      const hit = intersectController(controller, raycaster, interactive);
      if (hit?.object.userData.action) {
        pulseController(controller);
        selectAction(hit.object.userData.action, hit.object.userData.payload ?? {});
      }
    });
  });

  renderer.setAnimationLoop((time) => {
    if (!currentSession) controls.update();
    if (!currentState.settings.reducedMotion) {
      const float = Math.sin(time * 0.0012) * 0.025;
      panels.map.position.y = 1.65 + float;
      panels.chart.position.y = 1.65 - float * 0.75;
      panels.task.position.y = 1.55 + float * 0.45;
      panels.side.position.y = 1.45 - float * 0.4;
    }
    updateControllerHover(controllers, raycaster, interactive, (controlId) => {
      if (controlId !== hoverControl) {
        hoverControl = controlId;
        updateButtonTextures(inWorldButtons, hoverControl);
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
    new THREE.PlaneGeometry(9, 8),
    new THREE.MeshStandardMaterial({
      color: "#121719",
      roughness: 0.72,
      metalness: 0.04,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, -1.2);
  room.add(floor);

  const grid = new THREE.GridHelper(9, 18, "#2b3e41", "#223034");
  grid.position.set(0, 0.01, -1.2);
  room.add(grid);

  const backWall = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 3.6),
    new THREE.MeshStandardMaterial({ color: "#11191c", roughness: 0.82 }),
  );
  backWall.position.set(0, 1.8, -4.2);
  room.add(backWall);

  const leftWall = new THREE.Mesh(
    new THREE.PlaneGeometry(7.2, 3.6),
    new THREE.MeshStandardMaterial({ color: "#0e1518", roughness: 0.86 }),
  );
  leftWall.position.set(-4.5, 1.8, -1.1);
  leftWall.rotation.y = Math.PI / 2;
  room.add(leftWall);

  const rightWall = leftWall.clone();
  rightWall.position.x = 4.5;
  rightWall.rotation.y = -Math.PI / 2;
  room.add(rightWall);

  const ceilingRail = new THREE.Mesh(
    new THREE.BoxGeometry(7.1, 0.06, 0.08),
    new THREE.MeshStandardMaterial({ color: "#202b2e", roughness: 0.5 }),
  );
  ceilingRail.position.set(0, 3.38, -2.6);
  room.add(ceilingRail);

  for (const x of [-2.6, 0, 2.6]) {
    const lightBar = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.06, 0.08),
      new THREE.MeshBasicMaterial({ color: "#f8f6ee" }),
    );
    lightBar.position.set(x, 3.24, -2.9);
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
  accent.position.set(0, 0.02, -1.6);
  accent.rotation.x = -Math.PI / 2;
  room.add(accent);

  const workbenchTop = new THREE.Mesh(
    new THREE.BoxGeometry(3.8, 0.1, 1.15),
    new THREE.MeshStandardMaterial({ color: "#182124", roughness: 0.68, metalness: 0.08 }),
  );
  workbenchTop.position.set(0, 0.72, -1.32);
  room.add(workbenchTop);

  const workbenchEdge = new THREE.Mesh(
    new THREE.BoxGeometry(3.92, 0.08, 1.28),
    new THREE.MeshStandardMaterial({ color: "#2b383b", roughness: 0.56 }),
  );
  workbenchEdge.position.set(0, 0.66, -1.32);
  room.add(workbenchEdge);

  return { room, accent };
}

function createPanels(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const map = panelMesh("map", [-2.62, 1.65, -2.58], [0, 0.25, 0], PANEL_W, PANEL_H);
  const task = panelMesh("task", [0, 1.55, -2.36], [0, 0, 0], 2.35, 2.05);
  const chart = panelMesh("chart", [2.62, 1.65, -2.58], [0, -0.25, 0], PANEL_W, PANEL_H);
  const side = panelMesh("side", [4.02, 1.45, -1.12], [0, -Math.PI / 2, 0], 1.52, 2.08);
  const caption = panelMesh("caption", [0, 0.52, -1.48], [-0.18, 0, 0], 3.15, 0.62);
  [map, task, chart, side, caption].forEach((panel) => group.add(panel));
  return { group, map, task, chart, side, caption };
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

function createButtons(scene) {
  return BUTTONS.map((button) => {
    const texture = textureFromCanvas(createButtonTexture(button.label, false));
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.22), material);
    mesh.position.set(button.x, button.y, -0.62);
    mesh.rotation.x = -0.1;
    mesh.visible = false;
    mesh.userData.controlId = button.id;
    mesh.userData.action = button.action;
    mesh.userData.payload = button.payload ?? {};
    scene.add(mesh);
    return { ...button, mesh };
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
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -4)]),
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
    `${sceneState.task} Test ${Math.round(workbench.robustness)}%. ${
      workbench.revealRedesign ? "Redesign visible." : "Original design visible."
    }`,
    56,
    202,
    1130,
    34,
  );
  return canvas;
}

function textureFromCanvas(canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

function intersectController(controller, raycaster, objects) {
  const tempMatrix = new THREE.Matrix4();
  tempMatrix.identity().extractRotation(controller.matrixWorld);
  raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
  raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
  return raycaster.intersectObjects(objects, false)[0] ?? null;
}

function updateControllerHover(controllers, raycaster, objects, onHover) {
  const visibleObjects = objects.filter((object) => object.visible);
  if (!visibleObjects.length) {
    onHover(null);
    return;
  }
  for (const controller of controllers) {
    if (!controller.visible) continue;
    const hit = intersectController(controller, raycaster, visibleObjects);
    if (hit?.object.userData.action) {
      onHover(hit.object.userData.controlId);
      return;
    }
  }
  onHover(null);
}

function pulseController(controller) {
  const gamepad = controller.inputSource?.gamepad;
  const actuator = gamepad?.hapticActuators?.[0];
  if (actuator?.pulse) actuator.pulse(0.35, 60);
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

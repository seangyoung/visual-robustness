import {
  comparisonDesigns,
  landCoverCategories,
  recommendedComparisonRanking,
} from "../config/lesson.js";
import {
  simulateColor,
  simulateRgb,
  stressLevelFromState,
  stressTestByIndex,
  stressTests,
} from "../config/stressTests.js";

const publicHealthAssetSources = {
  mapBaseline: new URL("../../assets/proposed-public-health/cdc-places-diabetes-map-baseline.png", import.meta.url).href,
  mapRedesign: new URL("../../assets/proposed-public-health/cdc-places-diabetes-map-redesign.png", import.meta.url).href,
  chartBaseline: new URL("../../assets/proposed-public-health/cdc-places-diabetes-chart-baseline.png", import.meta.url).href,
  chartRedesign: new URL("../../assets/proposed-public-health/cdc-places-diabetes-chart-redesign.png", import.meta.url).href,
};

const publicHealthImages = new Map();
const simulatedImageCache = new Map();

const watershedOutline = [
  [92, 190],
  [174, 94],
  [328, 52],
  [480, 78],
  [598, 132],
  [740, 124],
  [880, 222],
  [928, 362],
  [884, 520],
  [754, 650],
  [570, 716],
  [392, 690],
  [282, 610],
  [138, 574],
  [62, 442],
  [50, 304],
];

const landCoverPatches = [
  {
    category: "forest",
    points: [[132, 162], [222, 112], [338, 102], [412, 166], [356, 276], [202, 274], [122, 236]],
  },
  {
    category: "forest",
    points: [[562, 132], [720, 144], [834, 232], [812, 344], [664, 322], [562, 238]],
  },
  {
    category: "agriculture",
    points: [[92, 332], [214, 292], [336, 328], [332, 456], [188, 492], [76, 420]],
  },
  {
    category: "grassland",
    points: [[360, 124], [506, 96], [596, 164], [544, 294], [410, 278], [352, 202]],
  },
  {
    category: "developed",
    points: [[706, 356], [884, 384], [866, 518], [740, 590], [636, 516], [628, 408]],
  },
  {
    category: "grassland",
    points: [[350, 498], [520, 468], [640, 542], [590, 690], [420, 674], [320, 594]],
  },
  {
    category: "agriculture",
    points: [[170, 492], [316, 462], [400, 564], [340, 650], [198, 600], [112, 544]],
  },
  {
    category: "water",
    points: [[214, 520], [300, 488], [380, 524], [358, 590], [272, 618], [208, 584]],
  },
  {
    category: "wetland",
    points: [[260, 274], [420, 286], [560, 344], [664, 438], [626, 542], [464, 486], [330, 420]],
  },
  {
    category: "wetland",
    points: [[454, 300], [570, 238], [684, 318], [654, 430], [530, 402]],
  },
  {
    category: "wetland",
    points: [[394, 474], [558, 520], [706, 604], [608, 698], [448, 646]],
  },
];

const streamLines = [
  [[212, 116], [278, 210], [370, 298], [482, 368], [592, 448], [700, 552], [780, 640]],
  [[116, 250], [226, 292], [334, 338]],
  [[568, 138], [542, 238], [488, 360]],
  [[782, 270], [690, 336], [590, 448]],
  [[244, 610], [332, 548], [430, 486]],
];

const contrastLayers = [
  { label: "Priority clusters", color: "#d45f4f", redesign: "#c83f35", weight: 0.94 },
  { label: "Transit access", color: "#3d8499", redesign: "#276f8a", weight: 0.72 },
  { label: "Service areas", color: "#8a9c63", redesign: "#5e7f3c", weight: 0.48 },
  { label: "Background context", color: "#d5d1c2", redesign: "#b9b8a7", weight: 0.24 },
];

const categoryById = Object.fromEntries(landCoverCategories.map((category) => [category.id, category]));

export function createPanelTexture(kind, scene, state) {
  const canvas = document.createElement("canvas");
  canvas.width = 1400;
  canvas.height = 980;
  const ctx = canvas.getContext("2d");

  if (scene.type === "orientation") drawOrientationPanel(ctx, canvas, kind, scene, state);
  if (scene.type === "color") drawColorPanel(ctx, canvas, kind, scene, state);
  if (scene.type === "contrast") drawContrastPanel(ctx, canvas, kind, scene, state);
  if (scene.type === "comparison") drawComparisonPanel(ctx, canvas, kind, scene, state);
  if (scene.type === "reflection") drawReflectionPanel(ctx, canvas, kind, scene, state);

  return canvas;
}

export async function preloadVisualizationAssets() {
  await Promise.all(
    Object.entries(publicHealthAssetSources).map(([key, url]) => loadPublicHealthImage(key, url)),
  );
}

function loadPublicHealthImage(key, url) {
  if (publicHealthImages.has(key)) return Promise.resolve(publicHealthImages.get(key));

  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      publicHealthImages.set(key, image);
      resolve(image);
    };
    image.onerror = () => reject(new Error(`Could not load visualization asset: ${url}`));
    image.src = url;
  });
}

export function createButtonTexture(label, active = false) {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 220;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = active ? "#236e66" : "#151d20";
  roundRect(ctx, 16, 16, 608, 188, 20);
  ctx.fill();
  ctx.strokeStyle = active ? "#88e0d6" : "#dfe5df";
  ctx.lineWidth = active ? 8 : 5;
  roundRect(ctx, 16, 16, 608, 188, 20);
  ctx.stroke();
  ctx.fillStyle = "#f8f6ee";
  ctx.font = label.length > 7 ? "900 44px Arial" : "900 58px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, 320, 112);
  return canvas;
}

export function createComparisonCardTexture(design, rank, active = false) {
  const canvas = document.createElement("canvas");
  canvas.width = 760;
  canvas.height = 1080;
  const ctx = canvas.getContext("2d");
  drawComparisonCard(ctx, design, 46, 46, 668, 988, rank);
  if (active) {
    ctx.strokeStyle = "#2d837b";
    ctx.lineWidth = 14;
    roundRect(ctx, 32, 32, canvas.width - 64, canvas.height - 64, 26);
    ctx.stroke();
  }
  return canvas;
}

function drawOrientationPanel(ctx, canvas, kind, scene, state) {
  if (kind === "task") {
    drawTaskPanel(ctx, canvas, scene, state, {
      lead: "Stress-test the design, not the viewer.",
      hint: "Use Next for the first map.",
    });
    return;
  }

  if (kind === "map") {
    panelBase(ctx, canvas, "Visualization Workbench", "The recurring object for this module", state);
    drawWorkbenchDiagram(ctx, state);
    return;
  }

  if (kind === "chart") {
    panelBase(ctx, canvas, "Module path", "Practice, test, compare", state);
    const scenes = ["Orient", "Color", "Contrast", "Rank", "Reflect"];
    scenes.forEach((label, index) => {
      const x = 130 + index * 238;
      const y = 365;
      ctx.fillStyle = index === 0 ? "#55c6ba" : "#d7ddd7";
      ctx.beginPath();
      ctx.arc(x, y, 48, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#2d383b";
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.fillStyle = index === 0 ? "#101719" : "#252c2f";
      ctx.font = "900 34px Arial";
      ctx.textAlign = "center";
      ctx.fillText(String(index), x, y + 12);
      ctx.textAlign = "start";
      ctx.fillStyle = "#1a2225";
      ctx.font = "800 28px Arial";
      wrapText(ctx, label, x - 72, y + 92, 150, 36);
      if (index < scenes.length - 1) {
        ctx.strokeStyle = "#b6bdb8";
        ctx.lineWidth = 5;
        line(ctx, x + 58, y, x + 180, y);
      }
    });
    return;
  }
}

function drawColorPanel(ctx, canvas, kind, scene, state) {
  if (kind === "task") {
    drawTaskPanel(ctx, canvas, scene, state, {
      lead: state.workbench.revealRedesign
        ? scene.reveal
        : "The map and chart use matching color classes, but hue carries too much of the interpretation.",
      hint: scene.answer,
    });
    return;
  }

  if (kind === "map") {
    drawPublicHealthAsset(ctx, canvas, "map", state);
    return;
  }

  if (kind === "chart") {
    drawPublicHealthAsset(ctx, canvas, "chart", state);
    return;
  }
}

function drawPublicHealthAsset(ctx, canvas, kind, state) {
  const assetKey = `${kind}${state.workbench.revealRedesign ? "Redesign" : "Baseline"}`;
  const image = publicHealthImages.get(assetKey);

  if (!image) {
    drawLoadingAssetPanel(ctx, canvas, kind, state);
    return;
  }

  const source = simulatedAssetSource(assetKey, image, state);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
}

function simulatedAssetSource(assetKey, image, state) {
  const stressTest = stressTestByIndex(state.workbench.stressTestIndex);
  if (stressTest.type === "identity") return image;

  const cacheKey = `${assetKey}:${stressTest.id}`;
  const cached = simulatedImageCache.get(cacheKey);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;

  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] === 0) continue;
    const simulated = simulateRgb(
      {
        r: data[index],
        g: data[index + 1],
        b: data[index + 2],
      },
      stressTest,
    );
    data[index] = simulated.r;
    data[index + 1] = simulated.g;
    data[index + 2] = simulated.b;
  }

  ctx.putImageData(imageData, 0, 0);
  simulatedImageCache.set(cacheKey, canvas);

  return canvas;
}

function drawLoadingAssetPanel(ctx, canvas, kind, state) {
  const title = kind === "map" ? "1. Public health map" : "2. Related chart";
  panelBase(ctx, canvas, title, "Loading CDC PLACES visualization asset", state);
  ctx.fillStyle = "#536164";
  ctx.font = "800 32px Arial";
  ctx.fillText("Loading image asset...", 112, 240);
}

function drawContrastPanel(ctx, canvas, kind, scene, state) {
  if (kind === "task") {
    drawTaskPanel(ctx, canvas, scene, state, {
      lead: state.workbench.revealRedesign
        ? scene.reveal
        : "Contrast controls what appears first.",
      hint: "Watch the attention order change.",
    });
    return;
  }

  if (kind === "map") {
    panelBase(ctx, canvas, "1. Multivariate figure", "Contrast and hierarchy under stress", state);
    drawHierarchyMap(ctx, state, 126, 205, 990, 640);
    drawStressMeter(ctx, 124, 882, state);
    return;
  }

  if (kind === "chart") {
    panelBase(ctx, canvas, "2. Attention order", "What reaches the viewer first", state);
    drawAttentionChart(ctx, state);
    return;
  }
}

function drawComparisonPanel(ctx, canvas, kind, scene, state) {
  if (kind === "task") {
    drawTaskPanel(ctx, canvas, scene, state, comparisonTaskCopy(state));
    return;
  }

  if (kind === "map") {
    panelBase(ctx, canvas, "Ranked design set", "Most robust to least robust", state);
    state.ranking.forEach((id, index) => {
      const design = comparisonDesigns.find((item) => item.id === id);
      drawComparisonCard(ctx, design, 96 + index * 420, 210, 360, 570, index + 1);
    });
    return;
  }

  if (kind === "chart") {
    panelBase(ctx, canvas, "Evidence cues", "Use before checking", state);
    const cues = ["Redundant cues", "Fewer classes", "Legend burden", "Clear hierarchy"];
    cues.forEach((cue, index) => {
      const x = 140 + (index % 2) * 560;
      const y = 330 + Math.floor(index / 2) * 255;
      ctx.fillStyle = index % 2 === 0 ? "#55c6ba" : "#f2c75e";
      roundRect(ctx, x, y - 90, 84, 84, 14);
      ctx.fill();
      ctx.fillStyle = "#151d20";
      ctx.font = "900 42px Arial";
      ctx.fillText(String(index + 1), x + 28, y - 34);
      ctx.fillStyle = "#536164";
      ctx.font = "900 34px Arial";
      wrapText(ctx, cue, x + 118, y - 44, 360, 42);
    });
    return;
  }
}

function comparisonTaskCopy(state) {
  const status = state.rankingCheck?.status ?? "idle";
  const recommendedOrder = recommendedComparisonRanking
    .map((id) => {
      const design = comparisonDesigns.find((item) => item.id === id);
      return `${design.label}. ${design.title}`;
    })
    .join(", then ");

  if (status === "correct") {
    return {
      lead: "This ordering is well supported.",
      hint: "The strongest design distributes meaning across multiple cues; the weakest asks hue and legend lookup to do most of the work.",
    };
  }

  if (status === "reveal") {
    return {
      lead: "Compare your order with this design rationale.",
      hint: `This is not a score. A defensible order is ${recommendedOrder}.`,
    };
  }

  if (status === "hint") {
    return {
      lead: "Try one more look before revealing the rationale.",
      hint: "Which design still works when hue becomes unreliable? Which one simplifies the task? Which one depends most on legend lookup?",
    };
  }

  return {
    lead: "Drag cards into rank order, then Check.",
    hint: "Look for redundancy, hierarchy, and legend burden.",
  };
}

function drawReflectionPanel(ctx, canvas, kind, scene, state) {
  if (kind === "task") {
    drawTaskPanel(ctx, canvas, scene, state, {
      lead: "Leave the prototype and complete the reflection in the course tool.",
      hint: "No responses are collected here.",
    });
    return;
  }

  if (kind === "map") {
    panelBase(ctx, canvas, "External reflection", "Use the LMS or course form", state);
    drawHandoffMark(ctx, state);
    return;
  }

  if (kind === "chart") {
    panelBase(ctx, canvas, "Keep testing for", "Use in your next visualization", state);
    const checks = ["Hue dependence", "Low contrast", "Legend burden", "Weak hierarchy"];
    checks.forEach((check, index) => {
      const y = 260 + index * 128;
      ctx.strokeStyle = "#55c6ba";
      ctx.lineWidth = 7;
      roundRect(ctx, 96, y - 34, 52, 52, 8);
      ctx.stroke();
      ctx.fillStyle = "#1e282b";
      ctx.font = "700 32px Arial";
      wrapText(ctx, check, 184, y, 990, 42);
    });
    return;
  }
}

function drawTaskPanel(ctx, canvas, scene, state, copy) {
  const bg = state.settings.highContrast ? "#0f1618" : "#131b1e";
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = state.settings.highContrast ? "#e9efe9" : "#465356";
  ctx.lineWidth = 9;
  ctx.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);

  ctx.fillStyle = "#55c6ba";
  ctx.font = "900 32px Arial";
  ctx.fillText(`SCENE ${scene.sceneNumber}`, 88, 118);
  ctx.fillStyle = "#f8f6ee";
  ctx.font = "900 66px Arial";
  wrapText(ctx, scene.title, 88, 214, 1040, 72);
  ctx.fillStyle = "#d9dfd8";
  ctx.font = "500 37px Arial";
  wrapText(ctx, scene.prompt, 88, 380, 1050, 50);

  ctx.strokeStyle = "rgba(248,246,238,0.16)";
  ctx.lineWidth = 4;
  line(ctx, 88, 586, 1210, 586);

  ctx.fillStyle = "#f2c75e";
  ctx.font = "900 34px Arial";
  ctx.fillText("Observe", 88, 660);
  ctx.fillStyle = "#e9efe9";
  ctx.font = "500 33px Arial";
  wrapText(ctx, copy.lead || scene.task, 128, 724, 980, 45);

  drawHintBox(ctx, state, copy.hint || scene.task);
}

function drawWatershedMap(ctx, originX, originY, state) {
  const mapW = 810;
  const mapH = 600;
  const tx = (point) => [originX + (point[0] / 1000) * mapW, originY + (point[1] / 760) * mapH];

  ctx.save();
  ctx.fillStyle = "#eef1ec";
  roundRect(ctx, originX - 18, originY - 18, mapW + 36, mapH + 36, 16);
  ctx.fill();
  ctx.strokeStyle = "#c7cec7";
  ctx.lineWidth = 5;
  roundRect(ctx, originX - 18, originY - 18, mapW + 36, mapH + 36, 16);
  ctx.stroke();

  drawMapGrid(ctx, originX, originY, mapW, mapH);

  ctx.save();
  watershedPath(ctx, tx);
  ctx.clip();
  ctx.fillStyle = colorForCategory(categoryById.wetland, state);
  ctx.fillRect(originX, originY, mapW, mapH);

  drawHillshade(ctx, originX, originY, mapW, mapH);

  landCoverPatches.forEach((patch) => {
    const category = categoryById[patch.category];
    const points = patch.points.map(tx);
    polygonPath(ctx, points);
    ctx.fillStyle = colorForCategory(category, state);
    ctx.fill();
    if (state.workbench.revealRedesign) drawPatternInPolygon(ctx, points, category.id);
    ctx.strokeStyle = state.workbench.revealRedesign ? "rgba(17,23,25,0.42)" : "rgba(248,246,238,0.58)";
    ctx.lineWidth = state.workbench.revealRedesign ? 2.8 : 1.8;
    ctx.stroke();
  });

  drawStreams(ctx, tx, state, true);
  ctx.restore();

  watershedPath(ctx, tx);
  ctx.strokeStyle = state.settings.highContrast ? "#111719" : "#1c2527";
  ctx.lineWidth = 5;
  ctx.stroke();

  drawStreams(ctx, tx, state, false);
  drawMapLabels(ctx, originX, originY, mapW, mapH, tx, state);
  drawNorthArrow(ctx, originX + 58, originY + 66);
  drawScaleBar(ctx, originX + 48, originY + mapH - 44);
  ctx.restore();
}

function drawLandCoverLegend(ctx, x, y, state) {
  ctx.fillStyle = "#262d30";
  ctx.font = "900 28px Arial";
  ctx.fillText("Land cover", x, y - 34);
  landCoverCategories.forEach((category, index) => {
    const yy = y + index * 62;
    ctx.fillStyle = colorForCategory(category, state);
    ctx.fillRect(x, yy, 44, 38);
    if (state.workbench.revealRedesign) {
      drawPattern(ctx, x, yy, 44, 38, category.id);
      drawShape(ctx, category.shape, x + 22, yy + 19, 10, "#111719");
    }
    ctx.fillStyle = "#262d30";
    ctx.font = "800 24px Arial";
    ctx.fillText(category.label, x + 62, yy + 25);
    if (state.workbench.revealRedesign) {
      ctx.fillStyle = "#536164";
      ctx.font = "500 19px Arial";
      ctx.fillText(category.note, x + 62, yy + 50);
    }
  });
}

function watershedPath(ctx, transform) {
  const points = watershedOutline.map(transform);
  polygonPath(ctx, points);
}

function drawMapGrid(ctx, x, y, width, height) {
  ctx.save();
  ctx.strokeStyle = "rgba(54,66,69,0.12)";
  ctx.lineWidth = 1.5;
  for (let i = 1; i < 5; i += 1) {
    const xx = x + (width / 5) * i;
    line(ctx, xx, y + 12, xx, y + height - 12);
  }
  for (let i = 1; i < 4; i += 1) {
    const yy = y + (height / 4) * i;
    line(ctx, x + 12, yy, x + width - 12, yy);
  }
  ctx.restore();
}

function drawHillshade(ctx, x, y, width, height) {
  ctx.save();
  for (let i = 0; i < 11; i += 1) {
    ctx.strokeStyle = `rgba(255,255,255,${0.1 + i * 0.008})`;
    ctx.lineWidth = 10;
    line(ctx, x - 40 + i * 92, y + height + 40, x + 130 + i * 92, y - 40);
  }
  for (let i = 0; i < 7; i += 1) {
    ctx.strokeStyle = "rgba(17,23,25,0.045)";
    ctx.lineWidth = 6;
    line(ctx, x + 20 + i * 130, y + 20, x - 130 + i * 130, y + height - 10);
  }
  ctx.restore();
}

function drawStreams(ctx, transform, state, bufferOnly) {
  streamLines.forEach((stream, index) => {
    const points = stream.map(transform);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (bufferOnly) {
      ctx.strokeStyle = state.workbench.revealRedesign ? "rgba(224,240,238,0.72)" : "rgba(224,240,238,0.36)";
      ctx.lineWidth = index === 0 ? 22 : 12;
    } else {
      ctx.strokeStyle = simulateColor(state.workbench.revealRedesign ? "#315f9f" : "#4979b8", state);
      ctx.lineWidth = index === 0 ? 6 : 3.5;
    }
    polyline(ctx, points);
    ctx.stroke();
  });
}

function drawMapLabels(ctx, x, y, width, height, transform, state) {
  ctx.fillStyle = "#1b2427";
  ctx.font = "900 25px Arial";
  ctx.fillText("Clearwater Creek watershed", x + 220, y + 44);
  ctx.fillStyle = "#536164";
  ctx.font = "700 20px Arial";
  ctx.fillText("Land cover classification, 30 m raster generalized for display", x + 220, y + 72);

  const mainRiver = transform([555, 388]);
  ctx.fillStyle = "#214b86";
  ctx.font = "800 19px Arial";
  ctx.fillText("Clearwater Creek", mainRiver[0] + 26, mainRiver[1] + 10);

  if (!state.workbench.revealRedesign) return;

  const labels = [
    ["Wetland", [454, 405], "circle"],
    ["Upland forest", [242, 182], "triangle"],
    ["Agriculture", [188, 404], "diamond"],
    ["Developed", [758, 458], "square"],
    ["Open water", [274, 560], "wave"],
  ];

  labels.forEach(([label, point, shape]) => {
    const [lx, ly] = transform(point);
    ctx.fillStyle = "rgba(248,246,238,0.86)";
    roundRect(ctx, lx - 16, ly - 28, Math.max(112, label.length * 12 + 46), 38, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(17,23,25,0.2)";
    ctx.lineWidth = 2;
    roundRect(ctx, lx - 16, ly - 28, Math.max(112, label.length * 12 + 46), 38, 8);
    ctx.stroke();
    drawShape(ctx, shape, lx + 3, ly - 9, 8, "#111719");
    ctx.fillStyle = "#111719";
    ctx.font = "900 18px Arial";
    ctx.fillText(label, lx + 22, ly - 3);
  });

  ctx.fillStyle = "#536164";
  ctx.font = "700 18px Arial";
  ctx.fillText("Direct labels and texture remain usable as hue compresses.", x + width - 468, y + height - 22);
}

function drawNorthArrow(ctx, x, y) {
  ctx.save();
  ctx.fillStyle = "rgba(248,246,238,0.88)";
  roundRect(ctx, x - 28, y - 42, 56, 82, 8);
  ctx.fill();
  ctx.strokeStyle = "#c5ccc7";
  ctx.lineWidth = 2;
  roundRect(ctx, x - 28, y - 42, 56, 82, 8);
  ctx.stroke();
  ctx.fillStyle = "#111719";
  ctx.beginPath();
  ctx.moveTo(x, y - 30);
  ctx.lineTo(x + 14, y + 8);
  ctx.lineTo(x, y);
  ctx.lineTo(x - 14, y + 8);
  ctx.closePath();
  ctx.fill();
  ctx.font = "900 18px Arial";
  ctx.textAlign = "center";
  ctx.fillText("N", x, y + 30);
  ctx.textAlign = "start";
  ctx.restore();
}

function drawScaleBar(ctx, x, y) {
  ctx.save();
  ctx.fillStyle = "rgba(248,246,238,0.86)";
  roundRect(ctx, x - 14, y - 30, 186, 56, 8);
  ctx.fill();
  ctx.strokeStyle = "#c5ccc7";
  ctx.lineWidth = 2;
  roundRect(ctx, x - 14, y - 30, 186, 56, 8);
  ctx.stroke();
  ctx.fillStyle = "#111719";
  ctx.fillRect(x, y - 8, 54, 12);
  ctx.fillStyle = "#f8f6ee";
  ctx.fillRect(x + 54, y - 8, 54, 12);
  ctx.strokeStyle = "#111719";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y - 8, 108, 12);
  ctx.fillStyle = "#111719";
  ctx.font = "800 16px Arial";
  ctx.fillText("0", x, y + 22);
  ctx.fillText("2 km", x + 88, y + 22);
  ctx.restore();
}

function drawLandCoverChart(ctx, x, y, state) {
  const width = 980;
  const rowH = 82;
  landCoverCategories.forEach((category, index) => {
    const yy = y + index * rowH;
    const barW = (category.area / 42) * width;
    ctx.fillStyle = "#eff2ee";
    roundRect(ctx, x, yy, width, 42, 10);
    ctx.fill();
    ctx.fillStyle = colorForCategory(category, state);
    roundRect(ctx, x, yy, barW, 42, 10);
    ctx.fill();
    if (state.workbench.revealRedesign) {
      drawPattern(ctx, x, yy, barW, 42, category.id);
      drawShape(ctx, category.shape, x + 24, yy + 21, 11, "#111719");
    }
    ctx.fillStyle = "#1c2326";
    ctx.font = "900 27px Arial";
    const label = state.workbench.revealRedesign
      ? `${category.label} • ${category.area}%`
      : category.label;
    ctx.fillText(label, x, yy - 12);
    ctx.fillStyle = "#536164";
    ctx.font = "700 24px Arial";
    ctx.fillText(`${category.area}%`, x + barW + 18, yy + 30);
  });
}

function drawWorkbenchDiagram(ctx, state) {
  const cx = 700;
  const cy = 500;
  ctx.fillStyle = "#eef2ee";
  roundRect(ctx, 270, 225, 860, 500, 18);
  ctx.fill();
  ctx.strokeStyle = "#d0d8d2";
  ctx.lineWidth = 7;
  roundRect(ctx, 270, 225, 860, 500, 18);
  ctx.stroke();

  ctx.fillStyle = "#182124";
  roundRect(ctx, 386, 545, 628, 80, 12);
  ctx.fill();
  ctx.fillStyle = "#55c6ba";
  roundRect(ctx, 455, 390, 490, 116, 12);
  ctx.fill();
  ctx.fillStyle = "#f2c75e";
  roundRect(ctx, 518, 322, 364, 58, 10);
  ctx.fill();
  ctx.strokeStyle = "#182124";
  ctx.lineWidth = 5;
  line(ctx, cx - 145, cy + 45, cx - 70, cy - 110);
  line(ctx, cx + 145, cy + 45, cx + 70, cy - 110);

  const controls = [
    ["Inspect", "move naturally"],
    ["Continue", "advance scenes"],
    ["Stress Test", "select a CVD state"],
    ["Reveal redesign", "compare a stronger encoding"],
  ];
  controls.forEach(([title, detail], index) => {
    const x = 118 + (index % 2) * 608;
    const y = 790 + Math.floor(index / 2) * 78;
    ctx.fillStyle = index === 2 ? "#236e66" : "#151d20";
    roundRect(ctx, x, y, 540, 54, 9);
    ctx.fill();
    ctx.fillStyle = "#f8f6ee";
    ctx.font = "900 24px Arial";
    ctx.fillText(title, x + 22, y + 35);
    ctx.fillStyle = "#c5ccc7";
    ctx.font = "600 22px Arial";
    ctx.fillText(detail, x + 238, y + 35);
  });

  drawStressMeter(ctx, 380, 170, state);
}

function drawHandoffMark(ctx, state) {
  const cx = 700;
  const cy = 500;
  ctx.fillStyle = state.settings.highContrast ? "#f8f6ee" : "#edf2ed";
  roundRect(ctx, cx - 310, cy - 200, 620, 400, 24);
  ctx.fill();
  ctx.strokeStyle = "#d3d8d2";
  ctx.lineWidth = 8;
  roundRect(ctx, cx - 310, cy - 200, 620, 400, 24);
  ctx.stroke();

  ctx.fillStyle = "#151d20";
  ctx.font = "900 54px Arial";
  ctx.textAlign = "center";
  ctx.fillText("Continue in LMS", cx, cy - 40);
  ctx.fillStyle = "#536164";
  ctx.font = "700 34px Arial";
  ctx.fillText("Reflection and assessment happen outside this app.", cx, cy + 32);

  ctx.strokeStyle = "#55c6ba";
  ctx.lineWidth = 12;
  line(ctx, cx - 120, cy + 112, cx + 82, cy + 112);
  line(ctx, cx + 42, cy + 62, cx + 116, cy + 112);
  line(ctx, cx + 42, cy + 162, cx + 116, cy + 112);
  ctx.textAlign = "start";
}

function drawHierarchyMap(ctx, state, x, y, width, height) {
  const stress = stressLevelFromState(state);
  const reveal = state.workbench.revealRedesign;
  ctx.fillStyle = "#f0f2ee";
  roundRect(ctx, x, y, width, height, 16);
  ctx.fill();
  ctx.strokeStyle = "#d4d8d2";
  ctx.lineWidth = 6;
  roundRect(ctx, x, y, width, height, 16);
  ctx.stroke();

  for (let i = 0; i < 8; i += 1) {
    ctx.strokeStyle = `rgba(80, 91, 94, ${0.16 - stress * 0.08})`;
    ctx.lineWidth = 3;
    line(ctx, x + 80 + i * 110, y + 42, x + 40 + i * 85, y + height - 54);
  }

  contrastLayers.forEach((layer, index) => {
    const alpha = reveal ? 0.92 - index * 0.1 : 0.88 - stress * 0.48 - index * 0.08;
    const color = simulateColor(reveal ? layer.redesign : mixHex(layer.color, "#bbb8aa", stress * 0.72), state);
    ctx.fillStyle = withAlpha(color, Math.max(0.28, alpha));
    const px = x + 110 + index * 175;
    const py = y + 120 + index * 72;
    roundRect(ctx, px, py, 420 - index * 42, 150 - index * 10, 26);
    ctx.fill();
    ctx.strokeStyle = reveal && index === 0 ? "#111719" : "rgba(20,28,30,0.22)";
    ctx.lineWidth = reveal && index === 0 ? 7 : 3;
    roundRect(ctx, px, py, 420 - index * 42, 150 - index * 10, 26);
    ctx.stroke();
    if (reveal) {
      ctx.fillStyle = index === 0 ? "#111719" : "#273033";
      ctx.font = index === 0 ? "900 29px Arial" : "700 23px Arial";
      ctx.fillText(layer.label, px + 28, py + 48);
    }
  });

  if (reveal) {
    ctx.fillStyle = "#101719";
    ctx.font = "900 32px Arial";
    ctx.fillText("Priority areas first", x + 88, y + height - 66);
  } else {
    ctx.fillStyle = "#536164";
    ctx.font = "700 28px Arial";
    ctx.fillText("Hierarchy flattened as the test increases", x + 88, y + height - 66);
  }
}

function drawAttentionChart(ctx, state) {
  const stress = stressLevelFromState(state);
  const reveal = state.workbench.revealRedesign;
  const x = 160;
  const y = 260;
  const width = 920;
  contrastLayers.forEach((layer, index) => {
    const yy = y + index * 128;
    const perceived = reveal ? layer.weight : layer.weight - stress * (0.42 - index * 0.06);
    const barW = Math.max(0.12, perceived) * width;
    ctx.fillStyle = "#edf1ed";
    roundRect(ctx, x, yy, width, 42, 10);
    ctx.fill();
    ctx.fillStyle = simulateColor(reveal ? layer.redesign : mixHex(layer.color, "#aaa99c", stress * 0.65), state);
    roundRect(ctx, x, yy, barW, 42, 10);
    ctx.fill();
    ctx.fillStyle = "#182124";
    ctx.font = index === 0 && reveal ? "900 31px Arial" : "800 28px Arial";
    ctx.fillText(layer.label, x, yy - 18);
    ctx.fillStyle = "#536164";
    ctx.font = "700 23px Arial";
    ctx.fillText(`${Math.round(perceived * 100)} perceived salience`, x + barW + 20, yy + 29);
  });
}

function drawComparisonCard(ctx, design, x, y, w, h, rank) {
  ctx.fillStyle = "#f1f4ef";
  roundRect(ctx, x, y, w, h, 16);
  ctx.fill();
  ctx.strokeStyle = "#d3d8d2";
  ctx.lineWidth = 5;
  roundRect(ctx, x, y, w, h, 16);
  ctx.stroke();

  ctx.fillStyle = "#151d20";
  ctx.font = "900 34px Arial";
  ctx.fillText(`${rank}`, x + 28, y + 52);
  ctx.fillStyle = "#536164";
  ctx.font = "800 23px Arial";
  ctx.fillText(`${design.label}. ${design.title}`, x + 74, y + 50);

  const thumbY = y + 96;
  drawComparisonThumbnail(ctx, design.id, x + 36, thumbY, w - 72, 250);

  ctx.fillStyle = "#1f282b";
  ctx.font = "800 27px Arial";
  wrapText(ctx, design.summary, x + 36, y + 405, w - 72, 38);
  ctx.fillStyle = "#536164";
  ctx.font = "700 22px Arial";
  ctx.fillText("Drag to reorder, then Check.", x + 36, y + h - 58);
}

function drawComparisonThumbnail(ctx, id, x, y, w, h) {
  ctx.fillStyle = "#e7ece7";
  roundRect(ctx, x, y, w, h, 12);
  ctx.fill();
  const colors =
    id === "hue-only"
      ? ["#4fa47a", "#48a0a0", "#5b9d77", "#67a984", "#7ca277"]
      : id === "simplified"
        ? ["#2f7f72", "#d0a126", "#c84a3d"]
        : ["#0b6d68", "#d0a126", "#c84a3d", "#315f9f"];
  for (let i = 0; i < 7; i += 1) {
    ctx.fillStyle = colors[i % colors.length];
    roundRect(ctx, x + 28 + i * 38, y + 34 + (i % 3) * 40, 78, 64, 10);
    ctx.fill();
    if (id === "redundant") {
      drawPattern(ctx, x + 28 + i * 38, y + 34 + (i % 3) * 40, 78, 64, colors[i % colors.length]);
    }
  }
  for (let i = 0; i < 4; i += 1) {
    const barW = (0.35 + i * 0.16) * (w - 70);
    ctx.fillStyle = colors[i % colors.length];
    roundRect(ctx, x + 36, y + h - 82 + i * 16, barW, 10, 4);
    ctx.fill();
  }
}

function colorForCategory(category, state) {
  return simulateColor(state.workbench.revealRedesign ? category.redesign : category.baseline, state);
}

function panelBase(ctx, canvas, title, subtitle, state) {
  ctx.fillStyle = state.settings.highContrast ? "#ffffff" : "#f8f6ee";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = state.settings.highContrast ? "#111719" : "#d3d8d2";
  ctx.lineWidth = 12;
  ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);
  ctx.fillStyle = "#151d20";
  ctx.font = "900 52px Arial";
  ctx.fillText(title, 84, 88);
  ctx.fillStyle = "#536164";
  ctx.font = "700 28px Arial";
  ctx.fillText(subtitle, 86, 126);
}

function drawHintBox(ctx, state, text) {
  ctx.fillStyle = state.settings.highContrast ? "#102a2a" : "#132628";
  roundRect(ctx, 88, 808, 1120, 108, 18);
  ctx.fill();
  ctx.strokeStyle = "#2d837b";
  ctx.lineWidth = 4;
  roundRect(ctx, 88, 808, 1120, 108, 18);
  ctx.stroke();
  ctx.fillStyle = "#dce3dd";
  ctx.font = "600 29px Arial";
  wrapText(ctx, text, 130, 864, 1000, 38);
}

function drawStressMeter(ctx, x, y, state) {
  const activeIndex = Math.max(0, Math.min(stressTests.length - 1, Math.round(state.workbench.stressTestIndex ?? 0)));
  const activeStressTest = stressTestByIndex(activeIndex);
  const segmentGap = 5;
  const barWidth = 520;
  const segmentWidth = (barWidth - segmentGap * (stressTests.length - 1)) / stressTests.length;

  ctx.fillStyle = "#303638";
  ctx.font = "900 24px Arial";
  ctx.fillText("Stress Test", x, y - 20);

  stressTests.forEach((test, index) => {
    const xx = x + index * (segmentWidth + segmentGap);
    ctx.fillStyle = index === activeIndex ? "#2d837b" : "#e5e9e4";
    roundRect(ctx, xx, y, segmentWidth, 22, 8);
    ctx.fill();
    if (index === activeIndex) {
      ctx.strokeStyle = "#111719";
      ctx.lineWidth = 2.5;
      roundRect(ctx, xx + 1.5, y + 1.5, segmentWidth - 3, 19, 7);
      ctx.stroke();
    }
  });

  ctx.fillStyle = "#303638";
  ctx.font = "800 22px Arial";
  ctx.fillText(activeStressTest.shortLabel, x + barWidth + 28, y + 20);
}

function drawPatternInPolygon(ctx, points, key) {
  ctx.save();
  polygonPath(ctx, points);
  ctx.clip();
  const [minX, minY, maxX, maxY] = bounds(points);
  drawPattern(ctx, minX - 6, minY - 6, maxX - minX + 12, maxY - minY + 12, key);
  ctx.restore();
}

function drawPattern(ctx, x, y, w, h, key) {
  const index = Math.abs(hashKey(String(key))) % 5;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.strokeStyle = "rgba(17,23,25,0.28)";
  ctx.lineWidth = 3;
  if (index === 0) {
    for (let xx = x - h; xx < x + w; xx += 24) line(ctx, xx, y + h, xx + h, y);
  } else if (index === 1) {
    for (let yy = y + 10; yy < y + h; yy += 22) line(ctx, x, yy, x + w, yy);
  } else if (index === 2) {
    for (let xx = x + 12; xx < x + w; xx += 28) {
      for (let yy = y + 12; yy < y + h; yy += 28) {
        ctx.beginPath();
        ctx.arc(xx, yy, 3, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  } else if (index === 3) {
    for (let xx = x; xx < x + w; xx += 24) line(ctx, xx, y, xx, y + h);
  } else {
    for (let xx = x - h; xx < x + w; xx += 30) line(ctx, xx, y, xx + h, y + h);
    for (let xx = x - h; xx < x + w; xx += 30) line(ctx, xx, y + h, xx + h, y);
  }
  ctx.restore();
}

function drawShape(ctx, shape, x, y, size, color) {
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(3, size * 0.25);
  if (shape === "circle") {
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  } else if (shape === "square") {
    ctx.fillRect(x - size, y - size, size * 2, size * 2);
  } else if (shape === "triangle") {
    ctx.beginPath();
    ctx.moveTo(x, y - size);
    ctx.lineTo(x + size, y + size);
    ctx.lineTo(x - size, y + size);
    ctx.closePath();
    ctx.fill();
  } else if (shape === "hex") {
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const angle = Math.PI / 6 + (Math.PI * 2 * i) / 6;
      const px = x + Math.cos(angle) * size;
      const py = y + Math.sin(angle) * size;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  } else if (shape === "wave") {
    ctx.beginPath();
    for (let i = 0; i <= 24; i += 1) {
      const px = x - size + (i / 24) * size * 2;
      const py = y + Math.sin(i / 2.2) * size * 0.36;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(x, y - size);
    ctx.lineTo(x + size, y);
    ctx.lineTo(x, y + size);
    ctx.lineTo(x - size, y);
    ctx.closePath();
    ctx.fill();
  }
}

function polygonPath(ctx, points) {
  ctx.beginPath();
  points.forEach(([x, y], pointIndex) => {
    if (pointIndex === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
}

function polyline(ctx, points) {
  ctx.beginPath();
  points.forEach(([x, y], pointIndex) => {
    if (pointIndex === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
}

function bounds(points) {
  return points.reduce(
    ([minX, minY, maxX, maxY], [x, y]) => [
      Math.min(minX, x),
      Math.min(minY, y),
      Math.max(maxX, x),
      Math.max(maxY, y),
    ],
    [Infinity, Infinity, -Infinity, -Infinity],
  );
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text).split(" ");
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
  return yy + lineHeight;
}

function line(ctx, x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
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

function mixHex(a, b, amount) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const mix = (from, to) => Math.round(from + (to - from) * amount);
  return `rgb(${mix(ca.r, cb.r)}, ${mix(ca.g, cb.g)}, ${mix(ca.b, cb.b)})`;
}

function withAlpha(color, alpha) {
  const rgb = color.startsWith("#") ? hexToRgb(color) : parseRgb(color);
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  const value = Number.parseInt(clean, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function parseRgb(color) {
  const parts = color.match(/\d+/g)?.map(Number) ?? [0, 0, 0];
  return { r: parts[0], g: parts[1], b: parts[2] };
}

function hashKey(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

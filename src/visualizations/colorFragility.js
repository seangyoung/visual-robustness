import {
  comparisonDesigns,
  landCoverCategories,
  recommendedComparisonRanking,
  watershedZones,
} from "../config/lesson.js";

const mapCells = [
  { id: "A", points: [[272, 96], [390, 82], [488, 148], [462, 258], [340, 282], [246, 210]] },
  { id: "B", points: [[118, 178], [246, 146], [340, 282], [274, 388], [134, 366], [72, 276]] },
  { id: "C", points: [[488, 148], [640, 126], [730, 224], [682, 346], [520, 342], [462, 258]] },
  { id: "D", points: [[274, 388], [340, 282], [462, 258], [520, 342], [470, 480], [326, 504]] },
  { id: "E", points: [[682, 346], [730, 224], [866, 274], [902, 410], [798, 506], [668, 468]] },
  { id: "F", points: [[134, 366], [274, 388], [326, 504], [248, 612], [104, 582], [44, 462]] },
  { id: "G", points: [[470, 480], [520, 342], [668, 468], [642, 620], [500, 668], [402, 596]] },
  { id: "H", points: [[798, 506], [902, 410], [1016, 482], [996, 628], [866, 694], [760, 628]] },
  { id: "I", points: [[248, 612], [326, 504], [402, 596], [374, 748], [224, 790], [112, 710]] },
  { id: "J", points: [[642, 620], [760, 628], [866, 694], [820, 812], [656, 846], [500, 768]] },
];

const contrastLayers = [
  { label: "Priority clusters", color: "#d45f4f", redesign: "#c83f35", weight: 0.94 },
  { label: "Transit access", color: "#3d8499", redesign: "#276f8a", weight: 0.72 },
  { label: "Service areas", color: "#8a9c63", redesign: "#5e7f3c", weight: 0.48 },
  { label: "Background context", color: "#d5d1c2", redesign: "#b9b8a7", weight: 0.24 },
];

const categoryById = Object.fromEntries(landCoverCategories.map((category) => [category.id, category]));
const zoneById = Object.fromEntries(watershedZones.map((zone) => [zone.id, zone]));

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
        : "The answer starts easy. Hue carries most of the work.",
      hint: scene.answer,
    });
    return;
  }

  if (kind === "map") {
    panelBase(ctx, canvas, "1. Land-cover map", "Hue-only categories under stress", state);
    drawWatershedMap(ctx, 118, 214, state);
    drawLandCoverLegend(ctx, 990, 268, state);
    drawStressMeter(ctx, 124, 882, state.workbench.robustness);
    return;
  }

  if (kind === "chart") {
    panelBase(ctx, canvas, "2. Category area", "Same data in a related chart", state);
    drawLandCoverChart(ctx, 160, 262, state);
    return;
  }
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
    drawStressMeter(ctx, 124, 882, state.workbench.robustness);
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
  const scale = 0.78;
  mapCells.forEach((cell) => {
    const zone = zoneById[cell.id];
    const category = categoryById[zone.category];
    const points = cell.points.map(([x, y]) => [originX + x * scale, originY + y * scale]);
    polygonPath(ctx, points);
    ctx.fillStyle = colorForCategory(category, state);
    ctx.fill();
    if (state.workbench.revealRedesign) drawPatternInPolygon(ctx, points, category.id);
    ctx.strokeStyle = state.settings.highContrast ? "#f8f6ee" : "rgba(248,246,238,0.66)";
    ctx.lineWidth = state.workbench.revealRedesign ? 5 : 2.5;
    ctx.stroke();

    if (state.workbench.revealRedesign) {
      const center = polygonCenter(points);
      ctx.fillStyle = "#111719";
      ctx.font = "900 28px Arial";
      ctx.textAlign = "center";
      ctx.fillText(cell.id, center[0], center[1] + 8);
      if (state.workbench.revealRedesign) {
        drawShape(ctx, category.shape, center[0], center[1] + 42, 14, "#111719");
      }
      ctx.textAlign = "start";
    }
  });
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
    ["Robustness Test", "stress the design"],
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

  drawStressMeter(ctx, 380, 170, state.workbench.robustness);
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
  const stress = state.workbench.robustness / 100;
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
    const color = reveal ? layer.redesign : mixHex(layer.color, "#bbb8aa", stress * 0.72);
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
  const stress = state.workbench.robustness / 100;
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
    ctx.fillStyle = reveal ? layer.redesign : mixHex(layer.color, "#aaa99c", stress * 0.65);
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
  if (state.settings.highContrast || state.workbench.revealRedesign) return category.redesign;
  return mixHex(category.baseline, category.compressed, state.workbench.robustness / 100);
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

function drawStressMeter(ctx, x, y, value) {
  ctx.fillStyle = "#303638";
  ctx.font = "900 24px Arial";
  ctx.fillText("Robustness Test", x, y - 20);
  ctx.fillStyle = "#e5e9e4";
  roundRect(ctx, x, y, 360, 22, 11);
  ctx.fill();
  ctx.fillStyle = "#55c6ba";
  roundRect(ctx, x, y, 3.6 * value, 22, 11);
  ctx.fill();
  ctx.fillStyle = "#303638";
  ctx.font = "800 22px Arial";
  ctx.fillText(`${Math.round(value)}% stress`, x + 386, y + 20);
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

function polygonCenter(points) {
  const sum = points.reduce((acc, point) => [acc[0] + point[0], acc[1] + point[1]], [0, 0]);
  return [sum[0] / points.length, sum[1] / points.length];
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

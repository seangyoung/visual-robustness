// Matrix states use Machado 2009/2010 CVD simulation coefficients, applied in
// linear-light sRGB. See THIRD-PARTY-NOTICES.md for the Colour Science source
// and BSD-3-Clause notice for the copied precomputed matrices.
export const stressTests = [
  {
    id: "typical",
    label: "Typical color vision",
    shortLabel: "Typical color",
    type: "identity",
    description: "No color-vision simulation is applied.",
  },
  {
    id: "deuteranomaly",
    label: "Deuteranomaly",
    shortLabel: "Deuteranomaly",
    type: "matrix",
    severity: 0.6,
    description: "Common red-green weakness; usually the most common color vision deficiency.",
    matrix: [
      [0.498864, 0.674741, -0.173604],
      [0.205199, 0.754872, 0.039929],
      [-0.011131, 0.030969, 0.980162],
    ],
  },
  {
    id: "protanomaly",
    label: "Protanomaly",
    shortLabel: "Protanomaly",
    type: "matrix",
    severity: 0.6,
    description: "Red-green weakness that also reduces the perceived brightness of reds.",
    matrix: [
      [0.38545, 0.769005, -0.154455],
      [0.100526, 0.829802, 0.069673],
      [-0.007442, -0.02219, 1.029632],
    ],
  },
  {
    id: "deuteranopia",
    label: "Deuteranopia",
    shortLabel: "Deuteranopia",
    type: "matrix",
    severity: 1,
    description: "Dichromatic red-green vision with absent M-cone response.",
    matrix: [
      [0.367322, 0.860646, -0.227968],
      [0.280085, 0.672501, 0.047413],
      [-0.01182, 0.04294, 0.968881],
    ],
  },
  {
    id: "protanopia",
    label: "Protanopia",
    shortLabel: "Protanopia",
    type: "matrix",
    severity: 1,
    description: "Dichromatic red-green vision with absent L-cone response.",
    matrix: [
      [0.152286, 1.052583, -0.204868],
      [0.114503, 0.786281, 0.099216],
      [-0.003882, -0.048116, 1.051998],
    ],
  },
  {
    id: "tritanopia",
    label: "Tritanopia",
    shortLabel: "Tritanopia",
    type: "matrix",
    severity: 1,
    description: "Rare blue-yellow dichromatic vision with absent S-cone response.",
    matrix: [
      [1.255528, -0.076749, -0.178779],
      [-0.078411, 0.930809, 0.147602],
      [0.004733, 0.691367, 0.3039],
    ],
  },
  {
    id: "achromatopsia",
    label: "Achromatopsia / monochrome",
    shortLabel: "No color",
    type: "monochrome",
    description: "Hue is removed so the visualization must work through value, label, shape, and pattern.",
  },
];

export const DEFAULT_STRESS_TEST_INDEX = 0;
export const MAX_STRESS_TEST_INDEX = stressTests.length - 1;

export function clampStressTestIndex(value) {
  const index = Math.round(Number(value));
  if (!Number.isFinite(index)) return DEFAULT_STRESS_TEST_INDEX;
  return Math.max(DEFAULT_STRESS_TEST_INDEX, Math.min(MAX_STRESS_TEST_INDEX, index));
}

export function stressTestByIndex(index) {
  return stressTests[clampStressTestIndex(index)];
}

export function stressTestIndexById(id) {
  const index = stressTests.findIndex((test) => test.id === id);
  return index >= 0 ? index : DEFAULT_STRESS_TEST_INDEX;
}

export function stressTestIndexFromPercent(value) {
  const percent = Math.max(0, Math.min(100, Number(value)));
  if (!Number.isFinite(percent)) return DEFAULT_STRESS_TEST_INDEX;
  return clampStressTestIndex((percent / 100) * MAX_STRESS_TEST_INDEX);
}

export function stressLevelFromIndex(index) {
  if (MAX_STRESS_TEST_INDEX === 0) return 0;
  return clampStressTestIndex(index) / MAX_STRESS_TEST_INDEX;
}

export function stressTestFromWorkbench(workbench) {
  return stressTestByIndex(workbench?.stressTestIndex ?? DEFAULT_STRESS_TEST_INDEX);
}

export function stressLevelFromState(state) {
  return stressLevelFromIndex(state?.workbench?.stressTestIndex ?? DEFAULT_STRESS_TEST_INDEX);
}

export function simulateColor(color, stateOrStressTest) {
  return rgbString(simulateRgb(parseColor(color), stateOrStressTest));
}

export function simulateRgb(rgb, stateOrStressTest) {
  const stressTest = stateOrStressTest?.workbench
    ? stressTestFromWorkbench(stateOrStressTest.workbench)
    : stateOrStressTest;
  const base = {
    r: clamp255(rgb?.r),
    g: clamp255(rgb?.g),
    b: clamp255(rgb?.b),
  };
  if (!stressTest || stressTest.type === "identity") return base;

  const linear = [
    srgbChannelToLinear(base.r),
    srgbChannelToLinear(base.g),
    srgbChannelToLinear(base.b),
  ];

  if (stressTest.type === "monochrome") {
    const y = linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
    return linearRgbToSrgb({ r: y, g: y, b: y });
  }

  if (stressTest.type === "matrix") {
    const transformed = applyMatrix(stressTest.matrix, linear);
    return linearRgbToSrgb(transformed);
  }

  return base;
}

function applyMatrix(matrix, rgb) {
  return {
    r: matrix[0][0] * rgb[0] + matrix[0][1] * rgb[1] + matrix[0][2] * rgb[2],
    g: matrix[1][0] * rgb[0] + matrix[1][1] * rgb[1] + matrix[1][2] * rgb[2],
    b: matrix[2][0] * rgb[0] + matrix[2][1] * rgb[1] + matrix[2][2] * rgb[2],
  };
}

function parseColor(color) {
  if (typeof color !== "string") return { r: 0, g: 0, b: 0 };
  if (color.startsWith("#")) return hexToRgb(color);
  const parts = color.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0];
  return {
    r: clamp255(parts[0]),
    g: clamp255(parts[1]),
    b: clamp255(parts[2]),
  };
}

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  const expanded = clean.length === 3
    ? clean.split("").map((character) => `${character}${character}`).join("")
    : clean;
  const value = Number.parseInt(expanded, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function srgbChannelToLinear(value) {
  const channel = clamp01(value / 255);
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function linearRgbToSrgb(rgb) {
  return {
    r: linearChannelToSrgb(rgb.r),
    g: linearChannelToSrgb(rgb.g),
    b: linearChannelToSrgb(rgb.b),
  };
}

function linearChannelToSrgb(value) {
  const channel = clamp01(value);
  const srgb = channel <= 0.0031308
    ? channel * 12.92
    : 1.055 * channel ** (1 / 2.4) - 0.055;
  return clamp255(Math.round(srgb * 255));
}

function rgbString({ r, g, b }) {
  return `rgb(${clamp255(r)}, ${clamp255(g)}, ${clamp255(b)})`;
}

function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function clamp255(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(255, Math.round(value)));
}

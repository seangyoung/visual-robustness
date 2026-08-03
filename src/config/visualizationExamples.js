import {
  INTERVENTION_KEYS,
  interventionsEqual,
  normalizeInterventions,
  recommendedInterventions,
} from "./interventions.js";

const publicHealthAssets = import.meta.glob("../../assets/proposed-public-health/*-layer-*.png", {
  eager: true,
  import: "default",
});

function publicHealthAsset(filename) {
  const key = `../../assets/proposed-public-health/${filename}`;
  const url = publicHealthAssets[key];
  if (!url) {
    throw new Error(`Missing public health asset: ${filename}`);
  }
  return url;
}

function optionalPublicHealthAsset(filename) {
  const key = `../../assets/proposed-public-health/${filename}`;
  return publicHealthAssets[key] ?? null;
}

function figureLayerAssets(prefix, kind, options = {}) {
  const color = {
    original: publicHealthAsset(`${prefix}-${kind}-layer-color-p0.png`),
    palette: publicHealthAsset(`${prefix}-${kind}-layer-color-p1.png`),
  };
  const paletteAlt = optionalPublicHealthAsset(`${prefix}-${kind}-layer-color-p2.png`);
  if (options.paletteAlt && paletteAlt) color.paletteAlt = paletteAlt;

  const layers = {
    color: {
      ...color,
    },
    structure: publicHealthAsset(`${prefix}-${kind}-layer-structure.png`),
    redundantCue: publicHealthAsset(`${prefix}-${kind}-layer-cue.png`),
    labels: publicHealthAsset(`${prefix}-${kind}-layer-labels.png`),
  };

  const allLabels = optionalPublicHealthAsset(`${prefix}-${kind}-layer-all-labels.png`);
  if (options.allLabels && allLabels) layers.allLabels = allLabels;

  const cueAlt = optionalPublicHealthAsset(`${prefix}-${kind}-layer-cue-alt.png`);
  if (options.cueAlt && cueAlt) layers.cueAlt = cueAlt;

  const annotation = optionalPublicHealthAsset(`${prefix}-${kind}-layer-annotation.png`);
  if (options.annotation && annotation) layers.annotation = annotation;

  return layers;
}

function layeredPublicHealthAssets(prefix, options = {}) {
  return {
    map: figureLayerAssets(prefix, "map", options),
    chart: figureLayerAssets(prefix, "chart", options),
  };
}

export const visualizationExamples = [
  {
    id: "prevalence-classes",
    label: "Example 1",
    shortTitle: "Prevalence classes",
    panelSubtitle: "Prevalence Classes",
    vrTabLabel: "Prevalence",
    workbenchTitle: "CDC PLACES diabetes prevalence",
    prompt: "Which diabetes prevalence class contains the most Texas counties?",
    baselineLead:
      "The map and chart use matching color classes, but hue carries too much of the interpretation.",
    answer: "The 14.9-16.4% prevalence class contains the most counties.",
    predictionPrompt:
      "Predict which intervention will preserve the ordered prevalence classes with the least added complexity.",
    recommendedSummary:
      "The recommended combination uses an ordered luminance palette, selected direct labels, and chart annotations. Stronger boundaries are left off because they add density without clearly reducing color dependence.",
    recommendedInterventions: {
      palette: true,
      paletteAlt: false,
      redundantCue: false,
      annotation: false,
      labels: true,
      allLabels: false,
    },
    paletteOptions: [
      {
        id: "original",
        label: "Color Palette 1",
        shortLabel: "Palette 1",
        vrLabel: "Palette\n1",
        description: "The initial green, gold, orange, and purple palette used by the original figure.",
        effect: "Keeps the initial color set.",
      },
      {
        id: "palette",
        label: "Color Palette 2",
        shortLabel: "Palette 2",
        vrLabel: "Palette\n2",
        description:
          "A light-to-dark palette applied to the same prevalence classes and legend order.",
        effect: "Replaces the class colors with a light-to-dark sequence.",
      },
      {
        id: "paletteAlt",
        label: "Color Palette 3",
        shortLabel: "Palette 3",
        vrLabel: "Palette\n3",
        description:
          "A pastel green, blue, yellow, and pink palette applied to the same prevalence classes.",
        effect: "Replaces the class colors with a pastel color set.",
      },
    ],
    labelOptions: [
      {
        id: "none",
        label: "No added labels",
        shortLabel: "No labels",
        vrLabel: "No\nLabels",
        description: "No additional county labels are added to the map.",
        effect: "Leaves interpretation dependent on the legend and county positions.",
      },
      {
        id: "labels",
        label: "Selected labels",
        shortLabel: "Selected labels",
        vrLabel: "Selected\nLabels",
        description:
          "Selected map labels and chart annotations reduce repeated legend lookup for important values.",
        effect: "Supports efficient lookup for selected values, while adding visual density.",
      },
      {
        id: "allLabels",
        label: "All labels",
        shortLabel: "All labels",
        vrLabel: "All\nLabels",
        description:
          "Every county is labeled on the map; chart annotations match Selected labels.",
        effect: "Places every county name directly on the map while keeping selected chart labels.",
      },
    ],
    interventions: {
      palette: {
        label: "Color Palette 2",
        shortLabel: "Palette 2",
        vrLabel: "Palette\n2",
        description:
          "A light-to-dark palette applied to the same prevalence classes and legend order.",
        effect: "Replaces the class colors with a light-to-dark sequence.",
      },
      paletteAlt: {
        label: "Color Palette 3",
        shortLabel: "Palette 3",
        vrLabel: "Palette\n3",
        description:
          "A pastel green, blue, yellow, and pink palette applied to the same prevalence classes.",
        effect: "Replaces the class colors with a pastel color set.",
      },
      redundantCue: {
        label: "Stronger boundaries",
        shortLabel: "Boundaries",
        vrLabel: "County\nEdges",
        description:
          "Stronger county and bar boundaries improve figure-ground separation and make adjacent areas easier to inspect.",
        effect: "Improves legibility, but does not by itself encode prevalence order.",
      },
      labels: {
        label: "Labels and annotations",
        shortLabel: "Labels",
        vrLabel: "Labels\nNotes",
        description:
          "Selected map labels and chart annotations reduce repeated legend lookup for the most important values.",
        effect: "Supports efficient lookup for selected values, while adding visual density.",
      },
      allLabels: {
        label: "All labels",
        shortLabel: "All labels",
        vrLabel: "All\nLabels",
        description:
          "Every county is labeled on the map; chart annotations match Selected labels.",
        effect: "Places every county name directly on the map while keeping selected chart labels.",
      },
    },
    assets: layeredPublicHealthAssets("cdc-places-diabetes", { paletteAlt: true, allLabels: true }),
  },
  {
    id: "difference-from-average",
    label: "Example 2",
    shortTitle: "Above/below average",
    panelSubtitle: "Above/Below Average",
    vrTabLabel: "Average",
    workbenchTitle: "CDC PLACES diabetes relative to average",
    prompt: "Which side of the Texas average contains more counties?",
    baselineLead:
      "The map and chart use a diverging color ramp, but the above/below-average distinction depends heavily on hue.",
    answer: "More counties are above the estimated Texas average than below it.",
    predictionPrompt:
      "Predict which intervention will make the above/below-average direction easiest to recover under the selected stress test.",
    recommendedSummary:
      "The recommended combination uses the more distinguishable palette, above-average patterning, a clear average divider, and selected direct labels. All-label mode is left off because it adds more density than useful information.",
    recommendedInterventions: {
      palette: true,
      paletteAlt: false,
      redundantCue: true,
      annotation: true,
      labels: true,
      allLabels: false,
    },
    paletteOptions: [
      {
        id: "original",
        label: "Color Palette 1",
        shortLabel: "Palette 1",
        vrLabel: "Palette\n1",
        description: "The initial blue-to-red diverging palette used by the original figure.",
        effect: "Keeps the initial diverging color set.",
      },
      {
        id: "palette",
        label: "Color Palette 2",
        shortLabel: "Palette 2",
        vrLabel: "Palette\n2",
        description:
          "A blue-to-brown diverging palette applied to the same above- and below-average classes.",
        effect: "Replaces the class colors with an alternate diverging color set.",
      },
      {
        id: "paletteAlt",
        label: "Color Palette 3",
        shortLabel: "Palette 3",
        vrLabel: "Palette\n3",
        description:
          "A muted blue-to-purple diverging palette applied to the same above- and below-average classes.",
        effect: "Replaces the class colors with a second alternate diverging color set.",
      },
    ],
    labelOptions: [
      {
        id: "none",
        label: "No added labels",
        shortLabel: "No labels",
        vrLabel: "No\nLabels",
        description: "No additional county labels are added to the map.",
        effect: "Leaves interpretation dependent on the legend and county positions.",
      },
      {
        id: "labels",
        label: "Selected labels",
        shortLabel: "Selected labels",
        vrLabel: "Selected\nLabels",
        description:
          "Selected high and low county labels appear on the map, while chart labels show county counts and percentages.",
        effect: "Supports lookup for selected values, while adding visual density.",
      },
      {
        id: "allLabels",
        label: "All labels",
        shortLabel: "All labels",
        vrLabel: "All\nLabels",
        description:
          "Every county is labeled on the map; chart annotations match Selected labels.",
        effect: "Places every county name directly on the map while keeping selected chart labels.",
      },
    ],
    interventions: {
      palette: {
        label: "Color Palette 2",
        shortLabel: "Palette 2",
        vrLabel: "Palette\n2",
        description:
          "A blue-to-brown diverging palette applied to the same above- and below-average classes.",
        effect: "Replaces the class colors with an alternate diverging color set.",
      },
      paletteAlt: {
        label: "Color Palette 3",
        shortLabel: "Palette 3",
        vrLabel: "Palette\n3",
        description:
          "A muted blue-to-purple diverging palette applied to the same above- and below-average classes.",
        effect: "Replaces the class colors with a second alternate diverging color set.",
      },
      redundantCue: {
        label: "Pattern above average",
        shortLabel: "Pattern",
        vrLabel: "Above-Avg\nPattern",
        description:
          "Stippling and hash marks give above-average counties and bars a redundant cue that does not depend on hue.",
        effect: "Adds a second channel for direction from the midpoint.",
      },
      annotation: {
        label: "Average divider",
        shortLabel: "Divider",
        vrLabel: "Average\nDivider",
        description:
          "A visible reference line marks the Texas average on the chart and separates below-average from above-average classes in the legend.",
        effect: "Makes the above/below threshold explicit without adding county-level detail.",
      },
      labels: {
        label: "Selected labels",
        shortLabel: "Selected labels",
        vrLabel: "Selected\nLabels",
        description:
          "Selected high/low labels and chart counts reduce lookup burden and make the interpretation easier to verify.",
        effect: "Supports efficient lookup, but adds visual density.",
      },
      allLabels: {
        label: "All labels",
        shortLabel: "All labels",
        vrLabel: "All\nLabels",
        description:
          "Every county is labeled on the map; chart annotations match Selected labels.",
        effect: "Places every county name directly on the map while keeping selected chart labels.",
      },
    },
    assets: layeredPublicHealthAssets("cdc-places-diabetes-diverging", {
      paletteAlt: true,
      allLabels: true,
      annotation: true,
    }),
  },
  {
    id: "highest-svi-theme",
    label: "Example 3",
    shortTitle: "Category identity",
    panelSubtitle: "Category Identity",
    vrTabLabel: "Category",
    workbenchTitle: "CDC/ATSDR SVI highest-ranked theme",
    prompt: "Which SVI theme is highest-ranked in the most Texas counties?",
    baselineLead:
      "The map and chart use matching nominal colors. Here, color identifies SVI themes rather than encoding order or distance from a midpoint.",
    answer:
      "Housing/transportation is the highest-ranked SVI theme in the most Texas counties.",
    predictionPrompt:
      "Predict which intervention will make theme identity easiest to recover under the selected stress test.",
    recommendedSummary:
      "The recommended combination uses a high-separation palette, density-coded texture markers, and selected labels so theme identity no longer depends on hue alone.",
    recommendedInterventions: {
      palette: true,
      paletteAlt: false,
      redundantCue: true,
      cueAlt: false,
      annotation: false,
      labels: true,
      allLabels: false,
    },
    paletteOptions: [
      {
        id: "original",
        label: "Color Palette 1",
        shortLabel: "Palette 1",
        vrLabel: "Palette\n1",
        description: "The initial nominal palette used by the original SVI theme figure.",
        effect: "Keeps the initial theme colors.",
      },
      {
        id: "palette",
        label: "Color Palette 2",
        shortLabel: "Palette 2",
        vrLabel: "Palette\n2",
        description:
          "A high-separation nominal palette applied to the same four SVI theme categories.",
        effect: "Changes the theme colors without implying numeric order.",
      },
      {
        id: "paletteAlt",
        label: "Color Palette 3",
        shortLabel: "Palette 3",
        vrLabel: "Palette\n3",
        description:
          "A softer nominal palette applied to the same four SVI theme categories.",
        effect: "Changes the theme colors while retaining the same category assignments.",
      },
    ],
    cueOptions: [
      {
        id: "none",
        label: "No markers",
        shortLabel: "No markers",
        vrLabel: "No\nMarkers",
        description: "No additional marker layer is added.",
        effect: "Leaves theme matching dependent on color and labels.",
      },
      {
        id: "redundantCue",
        label: "Marker Set 1",
        shortLabel: "Markers 1",
        vrLabel: "Markers\n1",
        description:
          "Each SVI theme gets markers that vary by shape, spacing, and light/dark contrast across the map, chart, and legend.",
        effect: "Adds non-color cues for matching the same category across views.",
      },
      {
        id: "cueAlt",
        label: "Marker Set 2",
        shortLabel: "Markers 2",
        vrLabel: "Markers\n2",
        description:
          "Each SVI theme gets same-size, evenly spaced circle markers that differ only by color.",
        effect: "Adds markers, but keeps the marker cue color-dependent.",
      },
    ],
    labelOptions: [
      {
        id: "none",
        label: "No added labels",
        shortLabel: "No labels",
        vrLabel: "No\nLabels",
        description: "No additional county labels are added to the map.",
        effect: "Leaves interpretation dependent on the legend and category positions.",
      },
      {
        id: "labels",
        label: "Selected labels",
        shortLabel: "Selected labels",
        vrLabel: "Selected\nLabels",
        description:
          "Selected county labels identify examples of each highest-ranked SVI theme on the map, while the chart labels each bar with its county count and percentage.",
        effect: "Supports local lookup and makes the county-count comparison directly readable.",
      },
      {
        id: "allLabels",
        label: "All labels",
        shortLabel: "All labels",
        vrLabel: "All\nLabels",
        description:
          "Every county is labeled on the map; chart annotations match Selected labels.",
        effect: "Places every county name directly on the map while keeping selected chart labels.",
      },
    ],
    interventions: {
      palette: {
        label: "Color Palette 2",
        shortLabel: "Palette 2",
        vrLabel: "Palette\n2",
        description:
          "A high-separation nominal palette applied to the same four SVI theme categories.",
        effect: "Changes the theme colors without implying numeric order.",
      },
      paletteAlt: {
        label: "Color Palette 3",
        shortLabel: "Palette 3",
        vrLabel: "Palette\n3",
        description:
          "A softer nominal palette applied to the same four SVI theme categories.",
        effect: "Changes the theme colors while retaining the same category assignments.",
      },
      redundantCue: {
        label: "Marker Set 1",
        shortLabel: "Markers 1",
        vrLabel: "Markers\n1",
        description:
          "Each SVI theme gets a repeated marker cue that varies by shape, spacing, and light/dark contrast across the map, chart, and legend.",
        effect: "Adds a stronger non-color cue for matching the same category across views.",
      },
      cueAlt: {
        label: "Marker Set 2",
        shortLabel: "Markers 2",
        vrLabel: "Markers\n2",
        description:
          "Each SVI theme gets same-size, evenly spaced circle markers that differ only by color.",
        effect: "Adds markers, but keeps the marker cue color-dependent.",
      },
      labels: {
        label: "Selected labels",
        shortLabel: "Selected labels",
        vrLabel: "Selected\nLabels",
        description:
          "Selected county labels identify examples of each highest-ranked SVI theme on the map, while the chart labels each bar with its county count and percentage.",
        effect: "Supports local lookup and makes the county-count comparison directly readable without relying on bar length alone.",
      },
      allLabels: {
        label: "All labels",
        shortLabel: "All labels",
        vrLabel: "All\nLabels",
        description:
          "Every county is labeled on the map; chart annotations match Selected labels.",
        effect: "Places every county name directly on the map while keeping selected chart labels.",
      },
    },
    assets: layeredPublicHealthAssets("cdc-svi-theme", {
      paletteAlt: true,
      cueAlt: true,
      allLabels: true,
    }),
  },
];

export function interventionMetadataForExample(example, key) {
  if (!INTERVENTION_KEYS.includes(key)) return null;
  return example.interventions?.[key] ?? null;
}

export function paletteOptionsForExample(example) {
  return example?.paletteOptions ?? [
    {
      id: "original",
      label: "Color Palette 1",
      shortLabel: "Palette 1",
      vrLabel: "Palette\n1",
      description: "The original color palette.",
      effect: "Keeps the original color palette.",
    },
    {
      id: "palette",
      label: "Color Palette 2",
      shortLabel: "Palette 2",
      vrLabel: "Palette\n2",
      description: example?.interventions?.palette?.description ?? "The alternate color palette.",
      effect: example?.interventions?.palette?.effect ?? "Changes the color palette.",
    },
  ];
}

export function labelOptionsForExample(example) {
  return example?.labelOptions ?? [
    {
      id: "none",
      label: "No added labels",
      shortLabel: "No labels",
      vrLabel: "No\nLabels",
      description: "No additional direct labels are added.",
      effect: "Leaves the figure without added direct labels.",
    },
    {
      id: "labels",
      label: example?.interventions?.labels?.label ?? "Labels",
      shortLabel: example?.interventions?.labels?.shortLabel ?? "Labels",
      vrLabel: example?.interventions?.labels?.vrLabel ?? "Labels",
      description: example?.interventions?.labels?.description ?? "Adds direct labels and annotations.",
      effect: example?.interventions?.labels?.effect ?? "Adds direct labels and annotations.",
    },
  ];
}

export function cueOptionsForExample(example) {
  return example?.cueOptions ?? [
    {
      id: "none",
      label: "No markers",
      shortLabel: "No markers",
      vrLabel: "No\nMarkers",
      description: "No additional marker layer is added.",
      effect: "Leaves the figure without added marker cues.",
    },
    {
      id: "redundantCue",
      label: example?.interventions?.redundantCue?.label ?? "Markers",
      shortLabel: example?.interventions?.redundantCue?.shortLabel ?? "Markers",
      vrLabel: example?.interventions?.redundantCue?.vrLabel ?? "Markers",
      description: example?.interventions?.redundantCue?.description ?? "Adds marker or pattern cues.",
      effect: example?.interventions?.redundantCue?.effect ?? "Adds marker or pattern cues.",
    },
  ];
}

export function recommendedInterventionsForExample(example) {
  return normalizeInterventions(example?.recommendedInterventions ?? recommendedInterventions());
}

export function matchesRecommendedInterventions(example, interventions) {
  return interventionsEqual(interventions, recommendedInterventionsForExample(example));
}

export const DEFAULT_EXAMPLE_INDEX = 0;

export function visualizationExampleByIndex(index) {
  const safeIndex = clampExampleIndex(index);
  return visualizationExamples[safeIndex];
}

export function visualizationExampleIndexById(id) {
  const index = visualizationExamples.findIndex((example) => example.id === id);
  return index >= 0 ? index : DEFAULT_EXAMPLE_INDEX;
}

export function nextVisualizationExampleIndex(index) {
  return (clampExampleIndex(index) + 1) % visualizationExamples.length;
}

export function clampExampleIndex(value) {
  const index = Math.round(Number(value));
  if (!Number.isFinite(index)) return DEFAULT_EXAMPLE_INDEX;
  return Math.max(0, Math.min(visualizationExamples.length - 1, index));
}

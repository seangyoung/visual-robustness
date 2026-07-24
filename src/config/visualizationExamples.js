import {
  INTERVENTION_KEYS,
  interventionAssetSuffix,
  interventionsEqual,
  normalizeInterventions,
  recommendedInterventions,
} from "./interventions.js";

const publicHealthAssets = import.meta.glob("../../assets/proposed-public-health/*.png", {
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

function interventionAssets(prefix) {
  const assets = {};
  for (const palette of [false, true]) {
    for (const redundantCue of [false, true]) {
      for (const labels of [false, true]) {
        const suffix = interventionAssetSuffix({ palette, redundantCue, labels });
        assets[suffix] = {
          map: publicHealthAsset(`${prefix}-map-${suffix}.png`),
          chart: publicHealthAsset(`${prefix}-chart-${suffix}.png`),
        };
      }
    }
  }
  return assets;
}

export const visualizationExamples = [
  {
    id: "prevalence-classes",
    label: "Example 1",
    shortTitle: "Prevalence classes",
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
      redundantCue: false,
      labels: true,
    },
    interventions: {
      palette: {
        label: "Ordered luminance",
        shortLabel: "Luminance",
        description:
          "Luminance ordering preserves the low-to-high sequence when hue differences become harder to separate.",
        effect: "Directly reduces color dependence for an ordered sequence.",
      },
      redundantCue: {
        label: "Stronger boundaries",
        shortLabel: "Boundaries",
        description:
          "Stronger county and bar boundaries improve figure-ground separation and make adjacent areas easier to inspect.",
        effect: "Improves legibility, but does not by itself encode prevalence order.",
      },
      labels: {
        label: "Labels and annotations",
        shortLabel: "Labels",
        description:
          "Selected map labels and chart annotations reduce repeated legend lookup for the most important values.",
        effect: "Supports efficient lookup for selected values, while adding visual density.",
      },
    },
    assets: {
      mapBaseline: publicHealthAsset("cdc-places-diabetes-map-baseline.png"),
      mapRedesign: publicHealthAsset("cdc-places-diabetes-map-redesign.png"),
      chartBaseline: publicHealthAsset("cdc-places-diabetes-chart-baseline.png"),
      chartRedesign: publicHealthAsset("cdc-places-diabetes-chart-redesign.png"),
      combinations: interventionAssets("cdc-places-diabetes"),
    },
  },
  {
    id: "difference-from-average",
    label: "Example 2",
    shortTitle: "Above/below average",
    workbenchTitle: "CDC PLACES diabetes relative to average",
    prompt: "Which side of the Texas average contains more counties?",
    baselineLead:
      "The map and chart use a diverging color ramp, but the above/below-average distinction depends heavily on hue.",
    answer: "More counties are above the estimated Texas average than below it.",
    predictionPrompt:
      "Predict which intervention will make the above/below-average direction easiest to recover under the selected stress test.",
    recommendedSummary:
      "The recommended combination uses a more distinguishable diverging palette, redundant above-average patterning, and direct labels.",
    recommendedInterventions: {
      palette: true,
      redundantCue: true,
      labels: true,
    },
    interventions: {
      palette: {
        label: "Robust palette",
        shortLabel: "Robust",
        description:
          "The alternative ramp separates direction and distance from the midpoint with clearer light-dark structure.",
        effect: "Directly reduces color dependence for the above/below-average distinction.",
      },
      redundantCue: {
        label: "Pattern above average",
        shortLabel: "Pattern",
        description:
          "Stippling and hash marks give above-average counties and bars a redundant cue that does not depend on hue.",
        effect: "Adds a second channel for direction from the midpoint.",
      },
      labels: {
        label: "Labels and annotations",
        shortLabel: "Labels",
        description:
          "Selected high/low labels and chart counts reduce lookup burden and make the interpretation easier to verify.",
        effect: "Supports efficient lookup, but adds visual density.",
      },
    },
    assets: {
      mapBaseline: publicHealthAsset("cdc-places-diabetes-diverging-map-baseline.png"),
      mapRedesign: publicHealthAsset("cdc-places-diabetes-diverging-map-redesign.png"),
      chartBaseline: publicHealthAsset("cdc-places-diabetes-diverging-chart-baseline.png"),
      chartRedesign: publicHealthAsset("cdc-places-diabetes-diverging-chart-redesign.png"),
      combinations: interventionAssets("cdc-places-diabetes-diverging"),
    },
  },
  {
    id: "highest-svi-theme",
    label: "Example 3",
    shortTitle: "Category identity",
    workbenchTitle: "CDC/ATSDR SVI highest-ranked theme",
    prompt: "Which SVI theme is highest-ranked in the most Texas counties?",
    baselineLead:
      "The map and chart use matching nominal colors. Here, color identifies SVI themes rather than encoding order or distance from a midpoint.",
    answer:
      "Housing/transportation is the highest-ranked SVI theme in the most Texas counties.",
    predictionPrompt:
      "Predict which intervention will make theme identity easiest to recover under the selected stress test.",
    recommendedSummary:
      "The recommended combination uses a safer qualitative palette and category-specific symbols so theme identity no longer depends on hue alone. County callouts are left off because they add density without helping the county-count task.",
    recommendedInterventions: {
      palette: true,
      redundantCue: true,
      labels: false,
    },
    interventions: {
      palette: {
        label: "Qualitative palette",
        shortLabel: "Palette",
        description:
          "The alternative qualitative palette uses more separable theme colors without implying a numeric order.",
        effect: "Directly reduces color dependence for nominal category identity.",
      },
      redundantCue: {
        label: "Theme symbols",
        shortLabel: "Symbols",
        description:
          "Each SVI theme gets a repeated symbol cue on the map, chart, and legend so identity is not carried by color alone.",
        effect: "Adds a non-color cue for matching the same category across views.",
      },
      labels: {
        label: "County callouts",
        shortLabel: "Callouts",
        description:
          "Selected county labels identify examples of each highest-ranked SVI theme on the map.",
        effect: "Supports local lookup, but does not help determine which theme is most common and adds visual density.",
      },
    },
    assets: {
      mapBaseline: publicHealthAsset("cdc-svi-theme-map-baseline.png"),
      mapRedesign: publicHealthAsset("cdc-svi-theme-map-redesign.png"),
      chartBaseline: publicHealthAsset("cdc-svi-theme-chart-baseline.png"),
      chartRedesign: publicHealthAsset("cdc-svi-theme-chart-redesign.png"),
      combinations: interventionAssets("cdc-svi-theme"),
    },
  },
];

export function interventionMetadataForExample(example, key) {
  if (!INTERVENTION_KEYS.includes(key)) return null;
  return example.interventions?.[key] ?? null;
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

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
    reveal:
      "The redesign uses a luminance-ordered palette, stronger county boundaries, selected direct labels, and chart annotations.",
    assets: {
      mapBaseline: new URL(
        "../../assets/proposed-public-health/cdc-places-diabetes-map-baseline.png",
        import.meta.url,
      ).href,
      mapRedesign: new URL(
        "../../assets/proposed-public-health/cdc-places-diabetes-map-redesign.png",
        import.meta.url,
      ).href,
      chartBaseline: new URL(
        "../../assets/proposed-public-health/cdc-places-diabetes-chart-baseline.png",
        import.meta.url,
      ).href,
      chartRedesign: new URL(
        "../../assets/proposed-public-health/cdc-places-diabetes-chart-redesign.png",
        import.meta.url,
      ).href,
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
    reveal:
      "The redesign keeps the diverging structure but adds redundant stippling and hash marks to the above-average side.",
    assets: {
      mapBaseline: new URL(
        "../../assets/proposed-public-health/cdc-places-diabetes-diverging-map-baseline.png",
        import.meta.url,
      ).href,
      mapRedesign: new URL(
        "../../assets/proposed-public-health/cdc-places-diabetes-diverging-map-redesign.png",
        import.meta.url,
      ).href,
      chartBaseline: new URL(
        "../../assets/proposed-public-health/cdc-places-diabetes-diverging-chart-baseline.png",
        import.meta.url,
      ).href,
      chartRedesign: new URL(
        "../../assets/proposed-public-health/cdc-places-diabetes-diverging-chart-redesign.png",
        import.meta.url,
      ).href,
    },
  },
];

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

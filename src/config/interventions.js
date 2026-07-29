export const INTERVENTION_KEYS = ["palette", "paletteAlt", "redundantCue", "annotation", "labels", "allLabels"];

const PARAM_ALIASES = {
  palette: "palette",
  paletteone: null,
  palette1: null,
  palettetwo: "palette",
  palette2: "palette",
  palettethree: "paletteAlt",
  palette3: "paletteAlt",
  palettealt: "paletteAlt",
  luminance: "palette",
  ramp: "palette",
  cue: "redundantCue",
  redundant: "redundantCue",
  redundantcue: "redundantCue",
  pattern: "redundantCue",
  boundaries: "redundantCue",
  annotation: "annotation",
  annotations: "annotation",
  divider: "annotation",
  threshold: "annotation",
  labels: "labels",
  selectedlabels: "labels",
  alllabels: "allLabels",
  countylabels: "allLabels",
};

export function defaultInterventions() {
  return Object.fromEntries(INTERVENTION_KEYS.map((key) => [key, false]));
}

export function recommendedInterventions() {
  return {
    ...defaultInterventions(),
    palette: true,
    redundantCue: true,
    labels: true,
  };
}

export function interventionsEqual(first, second) {
  const normalizedFirst = normalizeInterventions(first);
  const normalizedSecond = normalizeInterventions(second);
  return INTERVENTION_KEYS.every((key) => normalizedFirst[key] === normalizedSecond[key]);
}

export function normalizeInterventions(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  const normalized = Object.fromEntries(INTERVENTION_KEYS.map((key) => [key, Boolean(source[key])]));
  if (normalized.paletteAlt) normalized.palette = false;
  if (normalized.allLabels) normalized.labels = false;
  return normalized;
}

export function toggleIntervention(interventions, key) {
  if (!INTERVENTION_KEYS.includes(key)) return normalizeInterventions(interventions);
  if (key === "palette" || key === "paletteAlt") {
    const variant = normalizeInterventions(interventions)[key] ? "original" : key;
    return setPaletteVariant(interventions, variant);
  }
  if (key === "labels" || key === "allLabels") {
    const mode = normalizeInterventions(interventions)[key] ? "none" : key;
    return setLabelMode(interventions, mode);
  }
  return {
    ...normalizeInterventions(interventions),
    [key]: !Boolean(interventions?.[key]),
  };
}

export function paletteVariantFromInterventions(interventions) {
  const normalized = normalizeInterventions(interventions);
  if (normalized.paletteAlt) return "paletteAlt";
  if (normalized.palette) return "palette";
  return "original";
}

export function setPaletteVariant(interventions, variant) {
  const normalized = normalizeInterventions(interventions);
  return {
    ...normalized,
    palette: variant === "palette",
    paletteAlt: variant === "paletteAlt",
  };
}

export function labelModeFromInterventions(interventions) {
  const normalized = normalizeInterventions(interventions);
  if (normalized.allLabels) return "allLabels";
  if (normalized.labels) return "labels";
  return "none";
}

export function setLabelMode(interventions, mode) {
  const normalized = normalizeInterventions(interventions);
  return {
    ...normalized,
    labels: mode === "labels",
    allLabels: mode === "allLabels",
  };
}

export function hasActiveInterventions(interventions) {
  const normalized = normalizeInterventions(interventions);
  return INTERVENTION_KEYS.some((key) => normalized[key]);
}

export function allInterventionsActive(interventions) {
  const normalized = normalizeInterventions(interventions);
  return normalized.palette && normalized.redundantCue && normalized.labels;
}

export function interventionAssetSuffix(interventions) {
  const normalized = normalizeInterventions(interventions);
  return [
    `p${Number(normalized.palette)}`,
    `r${Number(normalized.redundantCue)}`,
    `l${Number(normalized.labels)}`,
  ].join("-");
}

export function interventionsFromParam(value) {
  if (!value) return defaultInterventions();
  const normalizedValue = String(value).trim().toLowerCase();
  if (["original", "none", "false", "0"].includes(normalizedValue)) {
    return defaultInterventions();
  }

  const compactMatch = normalizedValue.match(/^p([01])-r([01])-l([01])$/);
  if (compactMatch) {
    return normalizeInterventions({
      palette: compactMatch[1] === "1",
      redundantCue: compactMatch[2] === "1",
      labels: compactMatch[3] === "1",
    });
  }

  const interventions = defaultInterventions();
  normalizedValue
    .split(/[,\s+]+/)
    .map((token) => token.replace(/[^a-z0-9]/g, ""))
    .forEach((token) => {
      const key = PARAM_ALIASES[token];
      if (key) interventions[key] = true;
    });
  return normalizeInterventions(interventions);
}

export function interventionsToParam(interventions) {
  const normalized = normalizeInterventions(interventions);
  if (!hasActiveInterventions(normalized)) return "";
  return INTERVENTION_KEYS.filter((key) => normalized[key]).join(",");
}

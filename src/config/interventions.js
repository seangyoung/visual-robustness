export const INTERVENTION_KEYS = ["palette", "redundantCue", "labels"];

const PARAM_ALIASES = {
  palette: "palette",
  luminance: "palette",
  ramp: "palette",
  cue: "redundantCue",
  redundant: "redundantCue",
  redundantcue: "redundantCue",
  pattern: "redundantCue",
  boundaries: "redundantCue",
  labels: "labels",
  annotations: "labels",
};

export function defaultInterventions() {
  return Object.fromEntries(INTERVENTION_KEYS.map((key) => [key, false]));
}

export function recommendedInterventions() {
  return Object.fromEntries(INTERVENTION_KEYS.map((key) => [key, true]));
}

export function normalizeInterventions(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  return Object.fromEntries(INTERVENTION_KEYS.map((key) => [key, Boolean(source[key])]));
}

export function toggleIntervention(interventions, key) {
  if (!INTERVENTION_KEYS.includes(key)) return normalizeInterventions(interventions);
  return {
    ...normalizeInterventions(interventions),
    [key]: !Boolean(interventions?.[key]),
  };
}

export function hasActiveInterventions(interventions) {
  const normalized = normalizeInterventions(interventions);
  return INTERVENTION_KEYS.some((key) => normalized[key]);
}

export function allInterventionsActive(interventions) {
  const normalized = normalizeInterventions(interventions);
  return INTERVENTION_KEYS.every((key) => normalized[key]);
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
  if (["recommended", "all", "true", "1"].includes(normalizedValue)) {
    return recommendedInterventions();
  }
  if (["original", "none", "false", "0"].includes(normalizedValue)) {
    return defaultInterventions();
  }

  const compactMatch = normalizedValue.match(/^p([01])-r([01])-l([01])$/);
  if (compactMatch) {
    return {
      palette: compactMatch[1] === "1",
      redundantCue: compactMatch[2] === "1",
      labels: compactMatch[3] === "1",
    };
  }

  const interventions = defaultInterventions();
  normalizedValue
    .split(/[,\s+]+/)
    .map((token) => token.replace(/[^a-z]/g, ""))
    .forEach((token) => {
      const key = PARAM_ALIASES[token];
      if (key) interventions[key] = true;
    });
  return interventions;
}

export function interventionsToParam(interventions) {
  const normalized = normalizeInterventions(interventions);
  if (!hasActiveInterventions(normalized)) return "";
  if (allInterventionsActive(normalized)) return "recommended";
  return INTERVENTION_KEYS.filter((key) => normalized[key]).join(",");
}

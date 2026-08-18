import { normalizeInterventions } from "./interventions.js";

export const MODULE_PHASES = {
  INTRO: "intro",
  EXAMPLES: "examples",
  TRANSFER: "transfer",
  TAKEAWAYS: "takeaways",
};

export const finalTakeaways = [
  "Do not rely on hue alone.",
  "Match palette strategy to the data type.",
  "Use luminance, pattern, labels, boundaries, or symbols when they clarify interpretation.",
  "Redundancy helps only when it reduces interpretation burden.",
  "Test visualizations under altered color perception before publishing.",
];

export const introCopy = {
  kicker: "Color Fragility Module",
  title: "Stress-test color-dependent visualizations",
  lead:
    "This short module asks you to evaluate public-health maps and charts under changing color perception.",
  goal:
    "The goal is to see when color is carrying too much interpretive weight, then test design choices that make the same information easier to recover.",
  mechanics: [
    "Use the Stress Test slider to simulate common forms of altered color perception.",
    "Experiment with various Design Choices to see how they impact the visualizations under different stress tests.",
  ],
  flow: [
    "Review each map and chart example.",
    "Select the strongest set of design choices to make the visualizations more accessible.",
    "Submit your design choices to receive qualitative feedback.",
    "After completing the examples, test your skills.",
  ],
  startLabel: "Start Module",
};

const phaseValues = new Set(Object.values(MODULE_PHASES));

export function modulePhaseFromParam(value) {
  return phaseValues.has(value) ? value : MODULE_PHASES.INTRO;
}

export function allExamplesSubmitted(submittedExamples, examples) {
  return examples.every((example) => Boolean(submittedExamples?.[example.id]));
}

export function designSubmissionFeedback(example, interventions) {
  const normalized = normalizeInterventions(interventions);
  return exampleFeedbackById[example.id]?.(normalized) ?? genericFeedback(normalized);
}

function genericFeedback(interventions) {
  const activeCount = Object.values(interventions).filter(Boolean).length;
  return {
    title: "Review the design choices.",
    message:
      activeCount > 0
        ? "Look for choices that add meaning through more than hue, and watch for choices that mostly add density."
        : "The original design still leaves color carrying most of the interpretation task.",
    details: [],
  };
}

const exampleFeedbackById = {
  "prevalence-classes": (interventions) => {
    const details = [];
    if (interventions.palette) {
      details.push("Palette 2 gives the ordered classes a clearer light-to-dark structure.");
    }
    if (interventions.paletteAlt) {
      details.push("Palette 3 changes the hues, but it does not make the class order much easier to read.");
    }
    if (interventions.redundantCue) {
      details.push("Stronger boundaries can sharpen counties, but they do not encode prevalence order.");
    }
    if (interventions.cueAlt) {
      details.push("Removing boundaries reduces density, but it can make county-level lookup and comparison harder.");
    }
    if (interventions.labels) {
      details.push("Selected labels support lookup without covering the whole map.");
    }
    if (interventions.allLabels) {
      details.push("All labels add substantial clutter and can make county patterns harder to inspect.");
    }

    return {
      title: interventions.palette && interventions.labels && !interventions.redundantCue && !interventions.cueAlt && !interventions.allLabels
        ? "This is a strong sequential redesign."
        : "Sequential data need ordered visual support.",
      message:
        "This example is about ordered prevalence classes. The strongest choices make magnitude readable through luminance or selective annotation, not hue alone.",
      details,
    };
  },

  "difference-from-average": (interventions) => {
    const details = [];
    if (interventions.palette || interventions.paletteAlt) {
      details.push("A different diverging palette can help, but palette alone does not fully mark the midpoint.");
    }
    if (interventions.redundantCue) {
      details.push("Patterning the above-average side adds a non-hue cue for direction from the average.");
    }
    if (interventions.cueAlt) {
      details.push("Two-sided patterning gives both sides of the midpoint a non-hue cue.");
    }
    if (interventions.labels) {
      details.push("Simplifying to four classes reduces color-matching burden while preserving some magnitude information.");
    }
    if (interventions.allLabels) {
      details.push("Direction-only classification is robust for the above/below task, but it discards magnitude detail.");
    }

    const hasDirectionCue = interventions.redundantCue || interventions.cueAlt;
    const hasClassificationChoice = interventions.labels || interventions.allLabels;
    return {
      title: hasDirectionCue && hasClassificationChoice
        ? "This directly supports the diverging comparison."
        : "Diverging maps need a manageable classification scheme.",
      message:
        "This example is about above and below average. The key issue is balancing magnitude detail against robustness when hue becomes unreliable.",
      details,
    };
  },

  "highest-svi-theme": (interventions) => {
    const details = [];
    if (interventions.palette) {
      details.push("Palette 2 separates the nominal categories more clearly without implying order.");
    }
    if (interventions.paletteAlt) {
      details.push("Palette 3 is softer and may still leave some category matching dependent on hue.");
    }
    if (interventions.redundantCue) {
      details.push("Marker Set 1 varies shape, density, and light/dark contrast, so category identity is not only color.");
    }
    if (interventions.cueAlt) {
      details.push("Marker Set 2 adds circles, but those circles still differ mainly by color.");
    }
    if (interventions.labels) {
      details.push("Selected labels and counts help anchor the category comparison.");
    }
    if (interventions.allLabels) {
      details.push("All labels can overpower the category pattern the map is meant to show.");
    }

    return {
      title: interventions.palette && interventions.redundantCue && interventions.labels && !interventions.cueAlt && !interventions.allLabels
        ? "This is a strong nominal-category redesign."
        : "Nominal categories need identity cues.",
      message:
        "This example is about category identity. Since the categories are not ordered, the goal is separable identity, not a light-to-dark ramp.",
      details,
    };
  },
};

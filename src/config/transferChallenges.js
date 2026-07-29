const transferAssets = import.meta.glob("../../assets/proposed-public-health/transfer-*.png", {
  eager: true,
  import: "default",
});

function transferAsset(filename) {
  const key = `../../assets/proposed-public-health/${filename}`;
  const url = transferAssets[key];
  if (!url) {
    throw new Error(`Missing transfer challenge asset: ${filename}`);
  }
  return url;
}

export const transferChallenges = [
  {
    id: "obesity-sequential-rainbow",
    title: "Adult Obesity Prevalence",
    asset: transferAsset("transfer-obesity-sequential-rainbow.png"),
    question: "What is the main color-fragility problem in this map?",
    correctChoiceId: "ordered-rainbow",
    choices: [
      {
        id: "ordered-rainbow",
        label: "Ordered data use rainbow hues",
        feedback:
          "Yes. The data are ordered prevalence classes, but the rainbow-like palette does not give a reliable sense of low-to-high magnitude.",
      },
      {
        id: "too-many-labels",
        label: "Too many county labels",
        feedback:
          "County labels are not the central problem here. The main issue is that class order depends on interpreting hue.",
      },
      {
        id: "missing-midpoint",
        label: "Missing midpoint line",
        feedback:
          "A midpoint line matters for diverging maps. This map is sequential, so the stronger issue is ordered magnitude.",
      },
      {
        id: "chart-axis",
        label: "Chart axis is unclear",
        feedback:
          "There is no chart in this transfer item. Focus on how the map encodes prevalence classes.",
      },
    ],
  },
  {
    id: "inactivity-diverging-redgreen",
    title: "Physical Inactivity Relative to Average",
    asset: transferAsset("transfer-inactivity-diverging-redgreen.png"),
    question: "What is the main color-fragility problem in this map?",
    correctChoiceId: "diverging-hue",
    choices: [
      {
        id: "diverging-hue",
        label: "Above/below depends on hue",
        feedback:
          "Yes. The map asks red/green hue to carry the above-versus-below-average distinction without a redundant cue.",
      },
      {
        id: "nominal-order",
        label: "Nominal categories imply order",
        feedback:
          "This is not a nominal-category map. The issue is the diverging above/below distinction.",
      },
      {
        id: "too-many-labels",
        label: "Too many labels",
        feedback:
          "Labels are not the central problem. The main problem is hue-dependent direction from the average.",
      },
      {
        id: "low-resolution",
        label: "Map resolution is too low",
        feedback:
          "The map resolution is adequate for the task. The fragility comes from the color encoding.",
      },
    ],
  },
  {
    id: "smoking-too-many-classes",
    title: "Current Smoking Prevalence",
    asset: transferAsset("transfer-smoking-too-many-classes.png"),
    question: "What is the main color-fragility problem in this map?",
    correctChoiceId: "too-many-classes",
    choices: [
      {
        id: "too-many-classes",
        label: "Too many similar classes",
        feedback:
          "Yes. The map splits ordered prevalence into many color classes, making legend matching fragile.",
      },
      {
        id: "needs-symbols",
        label: "Every county needs symbols",
        feedback:
          "Symbols could add redundancy, but the first problem is the number and similarity of color classes.",
      },
      {
        id: "missing-midpoint",
        label: "Missing average divider",
        feedback:
          "This is not an above/below-average task. A divider is less central than class overload.",
      },
      {
        id: "no-title",
        label: "The map has no title",
        feedback:
          "The map title is present. The fragility is in the color classification.",
      },
    ],
  },
  {
    id: "depression-low-contrast",
    title: "Depression Prevalence",
    asset: transferAsset("transfer-depression-low-contrast.png"),
    question: "What is the main color-fragility problem in this map?",
    correctChoiceId: "low-contrast",
    choices: [
      {
        id: "low-contrast",
        label: "Weak luminance contrast",
        feedback:
          "Yes. Adjacent classes are close in lightness, so the map becomes fragile even before hue is considered.",
      },
      {
        id: "categorical-mismatch",
        label: "Categorical palette mismatch",
        feedback:
          "The palette is not strongly categorical. Its bigger problem is that adjacent values are too similar.",
      },
      {
        id: "too-many-labels",
        label: "Too many labels",
        feedback:
          "Labels are not driving the problem. The class colors are too close in luminance.",
      },
      {
        id: "missing-chart",
        label: "The map needs a chart",
        feedback:
          "A chart could help, but the transfer task asks about the map's color fragility.",
      },
    ],
  },
  {
    id: "blood-pressure-legend-load",
    title: "High Blood Pressure Prevalence",
    asset: transferAsset("transfer-blood-pressure-legend-load.png"),
    question: "What is the main color-fragility problem in this map?",
    correctChoiceId: "legend-load",
    choices: [
      {
        id: "legend-load",
        label: "Similar hues force legend lookup",
        feedback:
          "Yes. The hues are too similar, so interpretation requires repeated matching between counties and legend patches.",
      },
      {
        id: "wrong-geography",
        label: "The geography is wrong",
        feedback:
          "The Texas county geography is not the issue. The map is fragile because the hue differences are subtle.",
      },
      {
        id: "missing-midpoint",
        label: "Missing midpoint line",
        feedback:
          "This is a prevalence map, not a diverging above/below-average map. A midpoint line is not the main issue.",
      },
      {
        id: "needs-all-labels",
        label: "Every county needs a label",
        feedback:
          "All labels would likely add clutter. The better target is the hue-only legend dependence.",
      },
    ],
  },
  {
    id: "insurance-categorical-mismatch",
    title: "Lack of Health Insurance",
    asset: transferAsset("transfer-insurance-categorical-mismatch.png"),
    question: "What is the main color-fragility problem in this map?",
    correctChoiceId: "categorical-mismatch",
    choices: [
      {
        id: "categorical-mismatch",
        label: "Categorical colors show ordered data",
        feedback:
          "Yes. The data are ordered prevalence values, but the palette looks like unrelated categories.",
      },
      {
        id: "too-many-labels",
        label: "Too many labels",
        feedback:
          "Labels are not the issue here. The problem is that color choice does not match ordered magnitude.",
      },
      {
        id: "diverging-hue",
        label: "Above/below depends on hue",
        feedback:
          "This map does not show above/below-average direction. It shows ordered prevalence classes.",
      },
      {
        id: "low-resolution",
        label: "The map is too low resolution",
        feedback:
          "The resolution is enough for the task. The fragile part is the palette semantics.",
      },
    ],
  },
];

export function transferChallengeById(id) {
  return transferChallenges.find((challenge) => challenge.id === id) ?? transferChallenges[0];
}

export function transferChallengeIdFromParam(id) {
  return transferChallenges.some((challenge) => challenge.id === id)
    ? id
    : randomTransferChallengeId();
}

export function randomTransferChallengeId() {
  const index = Math.floor(Math.random() * transferChallenges.length);
  return transferChallenges[index].id;
}

export function transferChoiceById(challenge, choiceId) {
  return challenge?.choices?.find((choice) => choice.id === choiceId) ?? null;
}

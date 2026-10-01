# Architecture And Extension Guide

This document gives contributors a working map of the prototype. It describes the
current ownership boundaries rather than a permanent API contract.

## Runtime Shape

The app is a client-only Vite site. `src/main.js` owns the shared lesson state and
dispatches actions from both interfaces:

```text
lesson config + generated assets
              |
              v
       shared state/actions
          /           \
 browser DOM        Three.js/WebXR
```

The browser and VR interfaces should not maintain separate answers, design choices,
submission status, or challenge progress. They render the same state and dispatch
the same named actions.

## Module State And Phases

`src/config/moduleFlow.js` defines four live phases:

1. `intro`
2. `examples`
3. `transfer`
4. `takeaways`

`src/main.js` initializes state from URL parameters, handles actions, updates the
URL for reproducible QA, and re-renders both interfaces. Important state includes:

- active phase and example;
- active Stress Test state;
- selected design choices for the current example;
- submitted status and qualitative feedback for all three examples;
- selected transfer challenge, answer, and feedback; and
- restart state.

Keep state changes in the action dispatcher. Renderers should describe current
state rather than silently changing it.

## Configuration

### Examples

`src/config/visualizationExamples.js` is the main content source for the three
workbench examples. Each example defines:

- identifiers and browser/VR labels;
- instructional copy and answer;
- three option groups with three mutually exclusive choices each;
- the recommended combination used to generate post-submission feedback; and
- aligned map and chart layer assets.

The generic intervention keys are reused across examples even when the learner-
facing meaning differs. For example, `labels` represents selected labels in one
example and simplified classification in another. Always read the active example's
option metadata instead of assuming a global label.

### Stress Tests

`src/config/stressTests.js` defines the discrete simulation states, their labels,
prevalence context, and color-transformation matrices. The matrices are documented
in `THIRD-PARTY-NOTICES.md`.

### Transfer Challenges

`src/config/transferChallenges.js` defines the six map-only transfer items, answer
choices, correct choice, and qualitative feedback. The app randomly selects one at
module load unless the `challenge` URL parameter forces an item for QA.

### Future Material

`src/config/futureScenes.js` parks non-live concepts from earlier prototypes. Code
in this file is not part of the current learner flow.

## Browser Interface

`src/ui/dom.js` binds the controls in `index.html`, renders the current phase, and
dispatches actions to `src/main.js`. `src/styles.css` owns responsive layout and
visual presentation.

The browser figure inspector enlarges the current composed canvas and supports pan
and zoom. Preserve native keyboard semantics and accessible names when adding or
changing controls.

## Three.js And WebXR Interface

`src/scene/gallery.js` owns:

- renderer, camera, lighting, and XR session setup;
- in-world panels and figure surfaces;
- controller rays, direct-touch hit testing, haptics, and snap turn;
- Stress Test knob manipulation and reset;
- figure inspection in VR; and
- phase-specific visibility and placement.

`src/scene/missionControlWorkbench.js` loads
`public/assets/models/mission-control-workbench.glb`, discovers named model nodes,
and maps them to logical controls and screens. The validator expects those names
and relationships. A Blender edit that renames or restructures nodes requires a
corresponding mapping and validator update.

Work through the deployed [VR test checklist](./VR_TEST_CHECKLIST.md) after any
spatial, hit-area, or controller-input change.

## Visualization Composition

`src/visualizations/colorFragility.js` composes aligned PNG assets onto canvases
for browser and VR use. The layer order is:

1. color fill;
2. persistent structure;
3. optional pattern, marker, boundary, or classification cue; and
4. optional labels or annotations.

Do not replace this with a matrix of pre-composited images. The layer model lets
contributors add options without multiplying every possible combination.

Generated assets and cached source data live in
`assets/proposed-public-health/`. The R generator and asset README are the source
of truth for figure construction and naming.

## Adding Or Revising An Example

1. Define the pedagogical purpose and three coherent option groups.
2. Generate aligned map and chart layers in R.
3. Inspect the exported layers independently and as composites.
4. Add the assets and option metadata to `visualizationExamples.js`.
5. Verify browser labels, VR workbench screen labels, and physical button mapping.
6. Write qualitative feedback that explains tradeoffs only after submission.
7. Test every Stress Test state and each option group.
8. Run the browser and headset checklists.

## Adding A Transfer Challenge

1. Add the exact required public-health field to the R generator.
2. Fail clearly if that field is unavailable; do not silently substitute a topic.
3. Export a map-only `transfer-*.png` asset without an answer-revealing subtitle.
4. Add the challenge metadata and answer feedback to
   `src/config/transferChallenges.js`.
5. Verify the forced `?challenge=<id>` URL and the default random selection.

## Validation Boundaries

`npm run validate:vr` verifies the GLB structure, runtime mapping, and core syntax.
`npm run build` verifies that Vite can produce the static deployment. Browser flow
testing verifies responsive and keyboard behavior. Only a headset test can verify
physical reach, stereoscopic readability, controller alignment, haptics, comfort,
and frame pacing.

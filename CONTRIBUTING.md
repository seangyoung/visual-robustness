# Collaborating On Visual Robustness

Thank you for contributing. This is a Vite, Three.js, and WebXR teaching
prototype, so a change can affect instructional meaning, browser usability, and
spatial VR interaction at the same time. Keep changes focused and explain both
their technical and pedagogical intent.

## Before You Start

Read these files first:

- [README.md](./README.md) for the current module and setup.
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for state, rendering, and asset
  ownership.
- [docs/VR_TEST_CHECKLIST.md](./docs/VR_TEST_CHECKLIST.md) before changing WebXR
  layout or input.
- [assets/proposed-public-health/README.md](./assets/proposed-public-health/README.md)
  before regenerating visualization assets.

Use Node.js 22 when possible. The package supports Node `20.19+` or `22.12+`.

```bash
git clone https://github.com/seangyoung/visual-robustness.git
cd visual-robustness
npm ci
npm run dev -- --port 5173
```

Open `http://127.0.0.1:5173/`.

## Branch And Pull-Request Workflow

Start each change from the current `main` branch:

```bash
git switch main
git pull --ff-only
git switch -c feature/short-description
```

Use a focused branch name:

- `feature/...` for new module behavior or UI.
- `fix/...` for bugs or layout corrections.
- `docs/...` for documentation and contributor guidance.
- `prototype/...` for experiments that may not ship.

Before committing:

```bash
git status
git diff --check
npm run validate:vr
npm run build
```

Then commit and push the branch:

```bash
git add <changed-files>
git commit -m "Describe the user-facing change"
git push -u origin feature/short-description
```

Open a pull request into `main`. Use the pull-request template, include screenshots
for browser visual changes, and describe any Meta Quest testing performed. A build
passing on desktop does not count as VR interaction validation.

## Where Changes Belong

- Put lesson phases and final principles in `src/config/moduleFlow.js`.
- Put example copy, design-choice groups, recommended combinations, and figure
  asset mappings in `src/config/visualizationExamples.js`.
- Put color-vision stress states in `src/config/stressTests.js`.
- Put transfer questions and feedback in `src/config/transferChallenges.js`.
- Keep shared state transitions and actions in `src/main.js`.
- Keep browser-only presentation in `src/ui/dom.js` and `src/styles.css`.
- Keep in-world layout and WebXR interaction in `src/scene/gallery.js`.
- Keep GLB node-to-control mapping in `src/scene/missionControlWorkbench.js`.
- Generate public-health figures with the R script; do not hand-edit generated
  PNG layers as the source of truth.

Prefer config-driven copy and controls over hardcoded labels in renderers. Browser
and VR modes should dispatch the same actions whenever they represent the same
learner choice.

## Testing Expectations

### Every Pull Request

- `npm run validate:vr` passes.
- `npm run build` passes.
- The browser module completes from introduction through restart.
- Keyboard focus and control labels remain understandable.
- Desktop and narrow mobile layouts have no horizontal overflow or obscured
  controls.
- No student-identifiable data, analytics, or hidden network submission is added.

### Visualization Or Lesson Changes

- All three examples still load their map and chart layers.
- Each example exposes three groups of three mutually exclusive choices.
- Every Stress Test state works with every option combination.
- Design feedback describes the choices without revealing the recommended
  combination before submission.
- Transfer challenges do not reveal their answers in titles, subtitles, legends,
  or annotations.
- Color, structure, cue, and label layers remain aligned at every viewport size.

### WebXR Or Workbench Changes

- Run the complete [VR test checklist](./docs/VR_TEST_CHECKLIST.md) on the deployed
  HTTPS build.
- Test seated and standing starts.
- Test direct controller touch and ray fallback.
- Confirm no workbench control is hidden, floating, or mapped to the wrong action.
- Confirm figures, transfer choices, feedback, takeaways, and restart controls are
  readable and reachable.
- Report any untested headset behavior explicitly in the pull request.

## Generated Visualization Assets

To regenerate the map and chart layers:

```bash
Rscript scripts/generate_cdc_places_diabetes_assets.R
```

Required R packages are `dplyr`, `ggplot2`, `grid`, `jsonlite`, `readr`, `sf`,
`tigris`, and `viridisLite`. The generator can retrieve current source records,
so review CSV and PNG diffs carefully. Confirm the public source, topic, geographic
unit, year/release, missing-data treatment, class breaks, legend, and alignment
before committing.

## Collaboration Norms

- Keep one pull request centered on one coherent change.
- Do not mix unrelated formatting or refactoring into a feature branch.
- Explain why a design choice helps or harms interpretation; do not label an
  option as accessible merely because it adds more visual information.
- Preserve browser and VR parity unless the platform requires a different physical
  interaction.
- Treat generated assets and the workbench GLB as reviewed project artifacts, not
  disposable build output.
- Never commit credentials, personal access tokens, student data, `node_modules/`,
  or `dist/`.

## Reporting Issues

Include the following when relevant:

- Browser or headset model and software version.
- Desktop, mobile, seated VR, or standing VR.
- Module phase and example.
- Controller hand and input method: direct touch, ray, trigger, grip, or B button.
- Full QA URL, including parameters.
- Expected and observed behavior.
- Screenshot or short recording for visual or spatial problems.

Report suspected security vulnerabilities privately as described in
[SECURITY.md](./SECURITY.md).

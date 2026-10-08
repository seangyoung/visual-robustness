# Visual Robustness WebXR Prototype

[Live prototype](https://seangyoung.github.io/visual-robustness/) |
[Contributing](./CONTRIBUTING.md) | [Architecture](./docs/ARCHITECTURE.md) |
[VR test checklist](./docs/VR_TEST_CHECKLIST.md)

Visual Robustness is an open WebXR learning module for graduate data visualization
education. It asks learners to stress-test public-health maps and charts under
changes in color perception, then evaluate design choices that can make the same
information more perceptually robust.

The module uses one shared codebase for a responsive browser experience and an
immersive Meta Quest experience. It is a research and teaching prototype, not a
medical simulation or a validated diagnostic tool.

## Current Learning Flow

The implemented module takes approximately 10-12 minutes:

1. Review the goal, controls, and module flow.
2. Work through three visualization examples:
   - **Prevalence Classes:** ordered county-level diabetes prevalence.
   - **Above/Below Average:** diverging differences from the Texas average.
   - **Category Identity:** nominal CDC/ATSDR Social Vulnerability Index themes.
3. Apply discrete color-vision stress tests and compare three groups of three
   design choices for each example.
4. Submit each redesign and receive qualitative, example-specific feedback.
5. Complete one randomly selected transfer challenge using a new public-health
   map.
6. Review the final design principles or restart the module.

The transfer bank currently contains six CDC PLACES topics: adult obesity,
physical inactivity, current smoking, depression, high blood pressure, and lack
of health insurance. Use `?challenge=<id>` to select a specific challenge during
quality assurance.

## Interaction Model

Both modes use the same lesson state and visualization assets.

### Browser

- Mouse, trackpad, touch, and keyboard-accessible controls.
- Three explicit example tabs and grouped design-choice controls.
- A stepped Stress Test slider with named simulation states.
- Click or tap a figure to open an enlarged pan-and-zoom view.
- Responsive layouts for desktop and mobile screens.
- A screen-reader text equivalent for the current instructional state.

### WebXR

- Stationary gallery with no required locomotion.
- A modeled workbench with three physical radio-control groups.
- A rotary Stress Test control with discrete detents and push-to-reset.
- Direct controller touch for workbench controls, with controller-ray selection
  as a fallback.
- Figure inspection with controller pan/zoom and the B button to close.
- Snap-turn rotation for seated or standing use.

See [docs/VR_TEST_CHECKLIST.md](./docs/VR_TEST_CHECKLIST.md) for the current
headset acceptance checks. Passing a desktop build does not establish headset
reach, comfort, readability, or physical interaction quality.

## Technology

- [Vite](https://vite.dev/) for local development and production builds.
- [Three.js](https://threejs.org/) and the WebXR Device API for the immersive
  scene.
- R, `ggplot2`, and `sf` for reproducible public-health visualization assets.
- GitHub Actions and GitHub Pages for deployment.

The deployed app is entirely client-side. It has no application server,
database, login, analytics, or app-side student-data collection.

The site includes a web app manifest, standard and maskable icons, and an Apple
touch icon. Supporting desktop and mobile browsers can install or save it as a
standalone app from their site menu. Installation does not add offline caching;
the app still needs a network connection to load from GitHub Pages.

The hosted manifest and icons also prepare the project for Meta Quest PWA
packaging. Appearing as a separate application in the Quest App Library requires
building and signing a Meta-compatible package with the Meta Quest Bubblewrap
workflow, then sideloading it or distributing it through the Meta Horizon Store.
That packaging step is separate from the hosted web prototype.

## Local Setup

Prerequisites:

- Node.js 22 is recommended. The supported minimums are Node `20.19+` or
  `22.12+`.
- npm, included with Node.js.

```bash
git clone https://github.com/seangyoung/visual-robustness.git
cd visual-robustness
npm ci
npm run dev -- --port 5173
```

Open `http://127.0.0.1:5173/`.

Useful commands:

```bash
npm run dev -- --port 5173
npm run build
npm run preview
npm run validate:vr
```

`npm run validate:vr` checks the workbench model and its runtime control mapping,
then performs syntax checks on the core VR modules. Use `npm ci` for a clean,
lockfile-based install; use `npm install` only when intentionally changing
dependencies.

## Quality-Assurance URLs

The app keeps the current state in the URL so a collaborator can reproduce a
specific configuration. Common parameters include:

- `phase=intro|examples|transfer|takeaways`
- `example=prevalence-classes|difference-from-average|highest-svi-theme`
- `stress=typical|deuteranomaly|protanomaly|deuteranopia|protanopia|tritanopia|achromatopsia`
- `interventions=palette,redundantCue,labels`
- `challenge=<transfer-challenge-id>`
- `benchDistance=0.90..1.45`
- `benchHeight=<vertical-offset>`
- `vrDebug=1`

For example:

```text
http://127.0.0.1:5173/?phase=examples&example=difference-from-average&stress=deuteranopia
```

URL parameters are intended for development and QA, not as learner-facing
navigation.

## Project Layout

```text
src/main.js                           Shared module state and action flow
src/config/                           Lesson, examples, stress tests, challenges
src/ui/dom.js                         Browser controls and rendering
src/scene/gallery.js                  Three.js scene and WebXR interactions
src/scene/missionControlWorkbench.js  GLB workbench control mapping
src/visualizations/                   Layered map/chart composition
assets/proposed-public-health/        Generated PNG layers and cached source data
public/assets/models/                 Runtime GLB workbench model
scripts/                              R asset generation and VR validators
docs/                                 Architecture and headset test guidance
```

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) before changing shared state,
controls, figure layers, or the workbench model.

## Visualization Assets

The app composes maps and charts from aligned transparent PNG layers at runtime.
Color fills stay at the bottom; structure, patterns or markers, and labels render
above them. This avoids exporting a separate composite image for every design
combination.

The reproducible generator is:

```bash
Rscript scripts/generate_cdc_places_diabetes_assets.R
```

The script requires the R packages `dplyr`, `ggplot2`, `grid`, `jsonlite`,
`readr`, `sf`, `tigris`, and `viridisLite`. It retrieves public CDC PLACES and
CDC/ATSDR SVI data when available and falls back to the repository's cached CSV
files. Review all regenerated figures before committing them.

Asset naming, data sources, layer order, and current output families are described
in [assets/proposed-public-health/README.md](./assets/proposed-public-health/README.md).

## Development Workflow

Contributors should work in focused branches and open pull requests into `main`.
At minimum, run:

```bash
npm run validate:vr
npm run build
```

Then test the complete browser flow. Changes affecting spatial layout, controller
input, text scale, or the GLB workbench also require a deployed Meta Quest test.
See [CONTRIBUTING.md](./CONTRIBUTING.md) for the complete workflow and review
checklist.

## Deployment

Pushes to `main` trigger `.github/workflows/deploy.yml`, which installs locked
dependencies, builds the Vite app, and deploys `dist/` to GitHub Pages:

- <https://seangyoung.github.io/visual-robustness/>

The Vite production base is `/visual-robustness/`. WebXR immersive mode requires
a secure context, so use the deployed HTTPS site for Meta Quest testing.

## Data And Assessment

- The runtime app does not collect, transmit, or store student-identifiable data.
- Module state exists only in memory and the URL during the current session.
- Pre/post diagnostics, written reflection, grading, analytics, and identity-linked
  activity belong in approved external systems such as an LMS or Qualtrics.
- The included simulations are instructional stress tests, not representations of
  every individual experience of color vision and not medical diagnoses.

See [SECURITY.md](./SECURITY.md) for the security and privacy boundary.

## Licensing And Attribution

- Software code, build scripts, and configuration: MIT License.
- Original educational content and documentation: CC BY 4.0.
- Third-party dependencies, copied source material, and source data retain their
  applicable terms.

Suggested attribution:

> Visual Robustness: Perceptual Accessibility in Data Visualization by the Visual
> Robustness contributors, licensed under CC BY 4.0. Source:
> https://github.com/seangyoung/visual-robustness

See [LICENSE.md](./LICENSE.md), [LICENSE-CODE.md](./LICENSE-CODE.md),
[LICENSE-CONTENT.md](./LICENSE-CONTENT.md), and
[THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md).

## Prototype Status

This is an actively developed prototype. Browser/build validation is automated or
repeatable, while Meta Quest comfort, reach, controller behavior, and frame pacing
remain device-tested acceptance criteria. Please report reproducible issues with
the browser or headset model, module phase, example, input method, and URL
parameters.

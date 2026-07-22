# Visual Robustness WebXR Prototype

Visual Robustness is a WebXR learning module for graduate data visualization education.
Module 1, Perceptual Accessibility in Data Visualization, uses a minimalist
Visualization Workbench to teach how maps and graphics become fragile under changes
in color perception and contrast sensitivity.

The current prototype exposes only the standalone Color Dependence scene. Earlier
scaffolds for orientation, contrast/hierarchy, ranking, and reflection are parked
in `src/config/futureScenes.js` so they can be restored later without staying live
on the prototype site.

The live Color Dependence scene uses generated CDC PLACES diabetes prevalence
map/chart assets from `assets/proposed-public-health/`. The reproducible R
generator is `scripts/generate_cdc_places_diabetes_assets.R`.

## Run Locally

```bash
npm install
npm run dev -- --port 5173
```

Open `http://127.0.0.1:5173/`.

Direct scene links are available for testing:

- `http://127.0.0.1:5173/?scene=color-dependence`

Legacy or archived scene links fall back to the standalone Color Dependence scene.

For visual QA, the workbench can also be initialized from the URL:

- `?scene=color-dependence&stress=deuteranopia&reveal=1`

The `stress` parameter accepts a stress-test id such as `typical`,
`deuteranomaly`, `protanomaly`, `deuteranopia`, `protanopia`, `tritanopia`, or
`achromatopsia`. Older `robustness=0..100` links are mapped to the nearest
discrete stress state for compatibility.

## Deploy To GitHub Pages

The repository is configured to build and deploy the Vite app to GitHub Pages when
changes are pushed to `main`.

Expected Pages URL:

- `https://seangyoung.github.io/visual-robustness/`

GitHub repository setup:

1. Open the repository on GitHub.
2. Go to Settings -> Pages.
3. Under Build and deployment, set Source to GitHub Actions.
4. Push to `main`, or run the deploy workflow manually from the Actions tab.

The Vite config uses `/visual-robustness/` as the production base path for GitHub
Pages while keeping local development at `/`.

## Quest Device Testing

Use the GitHub Pages URL in Meta Quest Browser for headset testing. WebXR
immersive mode requires a secure context, so the deployed `https://` URL is the
recommended test target.

Device smoke test:

- Open `https://seangyoung.github.io/visual-robustness/` in Meta Quest Browser.
- Confirm the page loads and the `Enter VR` button is available.
- Enter VR from a direct user click or controller selection.
- Confirm controller selection works on in-world controls.
- Confirm panels are readable without artificial locomotion.
- Complete the standalone Color Dependence scene in browser fallback and VR.

## Implemented Interaction Model

- Shared Visualization Workbench state for browser and WebXR modes.
- Browser controls for Stress Test and reveal redesign.
- WebXR controller-selectable reveal control.
- WebXR grab-style control for the stepped Stress Test slider.
- Inspection uses native interaction: mouse/trackpad and touch in browser, headset
  movement and controller-mediated pointing in VR.
- No artificial locomotion; the gallery is stationary with subtle optional motion.
- Accessibility settings for high contrast and reduced motion.

## Assessment Model

The app stores no identifiable student data and no longer collects in-app
reflection text. Reflection and assessment use external course tools for both
browser and VR users.

For the course pilot, collect assessment artifacts externally through the LMS,
Qualtrics, or another approved form system:

- Pre-module diagnostic: identify perceptual vulnerabilities in hue-dependent visualizations.
- Post-module diagnostic: repeat with a parallel sample.
- Design revision assignment: improve a flawed visualization.
- Rubric dimensions: color robustness, luminance contrast, hierarchy, redundancy,
  classification/encoding fit, and explanation quality.

## Public Release And Licensing

This repository is prepared as a public prototype for future OER release.

License summary:

- Software code, build scripts, and configuration files: MIT License.
- Educational content, lesson text, prompts, documentation, and original non-code
  learning materials: Creative Commons Attribution 4.0 International (CC BY 4.0).
- Third-party dependencies and externally sourced materials retain their own
  licenses.
- Copied third-party source materials are listed in
  [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md).

Suggested attribution for OER reuse:

> Perception Workbench: Perceptual Accessibility in Data Visualization by the
> Perception Workbench contributors, licensed under CC BY 4.0. Source:
> https://github.com/seangyoung/visual-robustness

See [LICENSE.md](./LICENSE.md), [LICENSE-CODE.md](./LICENSE-CODE.md), and
[LICENSE-CONTENT.md](./LICENSE-CONTENT.md) for details.

Data statement:

- The app does not collect, transmit, or store student-identifiable data.
- Course assessment should remain in approved external systems such as the LMS,
  Qualtrics, or institutionally approved forms.
- See [SECURITY.md](./SECURITY.md) for the public security and data statement.

## Prototype Test Checklist

- Desktop browser loads and keyboard navigation works.
- Scene 1 can be completed: baseline map, Stress Test, and redesign reveal.
- Stress Test slider steps through named color-vision simulations in Scene 1.
- Reveal redesign adds labels, patterns, ordered value, and stronger figure-ground separation.
- Non-color scenes are archived in `src/config/futureScenes.js` and are not live.
- WebXR entry is available on a Quest-compatible browser over HTTPS.
- In-world controls respond to controller selection.
- High contrast and reduced motion settings update the experience.
- Screen-reader text equivalent describes the current learning state outside XR.

## Collaborating

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the branch, pull request, and review workflow.

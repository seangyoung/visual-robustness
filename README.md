# Visual Robustness WebXR Prototype

Visual Robustness is a WebXR learning module for graduate data visualization education.
Module 1, Perceptual Accessibility in Data Visualization, uses a minimalist
Visualization Workbench to teach how maps and graphics become fragile under changes
in color perception and contrast sensitivity.

The current prototype implements the shared scene framework and completes Scene 1,
Color Dependence, from start to finish. Later scenes are scaffolded in the same
workbench pattern for contrast/hierarchy, robust design comparison, and reflection.

## Run Locally

```bash
npm install
npm run dev -- --port 5173
```

Open `http://127.0.0.1:5173/`.

Direct scene links are available for testing:

- `http://127.0.0.1:5173/?scene=orientation`
- `http://127.0.0.1:5173/?scene=color-dependence`
- `http://127.0.0.1:5173/?scene=contrast-hierarchy`
- `http://127.0.0.1:5173/?scene=robust-comparison`
- `http://127.0.0.1:5173/?scene=reflection`

Legacy `?step=orientation` links are still accepted and are rewritten to `?scene=...`
after interaction.

For visual QA, the workbench can also be initialized from the URL:

- `?scene=color-dependence&robustness=75&reveal=1`

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
- Complete Scene 1 and test Scene 3 ranking in browser fallback.

## Implemented Interaction Model

- Shared Visualization Workbench state for browser and WebXR modes.
- Browser controls for Robustness Test, reveal redesign, ranking, and reflection download.
- WebXR controller-selectable workbench buttons for Back, Next, Robustness Test,
  and reveal.
- Inspection uses native interaction: mouse/trackpad and touch in browser, headset
  movement and controller-mediated pointing in VR.
- No artificial locomotion; the gallery is stationary with subtle optional motion.
- Accessibility settings for high contrast and reduced motion.

## Assessment Model

The app stores no identifiable student data. Reflection text remains local to the
browser session unless the student downloads it and submits it through an external
course tool.

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
- Scene 1 can be completed: baseline map, Robustness Test, redesign reveal, and Next.
- Robustness Test slider visibly compresses color distinctions in Scene 1.
- Reveal redesign adds labels, patterns, ordered value, and stronger figure-ground separation.
- Reflection scene accepts text and can download a local `.txt` file.
- Robust comparison scene supports direct drag-to-reorder ranking in browser fallback.
- WebXR entry is available on a Quest-compatible browser over HTTPS.
- In-world controls respond to controller selection.
- High contrast and reduced motion settings update the experience.
- Screen-reader text equivalent describes the current learning state outside XR.

## Collaborating

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the branch, pull request, and review workflow.

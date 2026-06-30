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

## Prototype Test Checklist

- Desktop browser loads and keyboard navigation works.
- Scene 1 can be completed: baseline map, Robustness Test, redesign reveal, and Next.
- Robustness Test slider visibly compresses color distinctions in Scene 1.
- Reveal redesign adds labels, patterns, ordered value, and stronger figure-ground separation.
- Reflection scene accepts text and can download a local `.txt` file.
- Robust comparison scene supports ranking changes in browser fallback.
- WebXR entry is available on a Quest-compatible browser over HTTPS.
- In-world controls respond to controller selection.
- High contrast and reduced motion settings update the experience.
- Screen-reader text equivalent describes the current learning state outside XR.

## Collaborating

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the branch, pull request, and review workflow.

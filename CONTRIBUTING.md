# Collaborating On Visual Robustness

This project is a Vite + Three.js WebXR prototype. Keep changes small, reviewable,
and centered on the learning module.

## Setup

```bash
npm install
npm run dev -- --port 5173
```

Open `http://127.0.0.1:5173/`.

## Daily Workflow

1. Start from the latest shared code.

```bash
git checkout main
git pull
```

2. Create a branch for one focused change.

```bash
git checkout -b feature/short-description
```

3. Make the change and test it.

```bash
find src -name '*.js' -exec node --check {} \;
npm run build
```

4. Review what changed before committing.

```bash
git status
git diff
```

5. Commit with a clear message.

```bash
git add .
git commit -m "Describe the user-facing change"
```

6. Push the branch and open a pull request.

```bash
git push -u origin feature/short-description
```

## Branch Naming

- `feature/...` for new module behavior or UI.
- `fix/...` for bugs or layout corrections.
- `docs/...` for README, instructor notes, or collaboration docs.
- `prototype/...` for experimental scenes that may not ship.

## Review Checklist

- The browser fallback still works.
- Scene 1 can be completed from start to finish.
- WebXR-specific controls remain hidden outside immersive mode.
- No student-identifiable data is stored by the app.
- Generated files such as `node_modules/` and `dist/` are not committed.
- `npm run build` passes.

## Collaboration Norms

- Keep pull requests focused on one idea.
- Include screenshots for visual changes.
- Explain pedagogical intent, not just code behavior.
- Prefer lesson content in `src/config/lesson.js` over hardcoded copy.
- Treat labels, patterns, and hierarchy as visualization design choices, not global accessibility toggles.

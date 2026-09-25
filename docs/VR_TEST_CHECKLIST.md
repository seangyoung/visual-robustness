# VR Test Checklist

Use the deployed HTTPS build on a Meta Quest. Add `?vrDebug=1` to the URL when
remote browser-console frame diagnostics are useful.

The default workbench distance is `1.05` meters from its origin to the headset.
For placement comparisons, use `?benchDistance=0.98` or another value from
`0.90` through `1.45`. Use `benchHeight` to override the vertical offset below
the headset, for example `?benchDistance=0.98&benchHeight=1.44`.

## Session setup

- Start once while seated and once while standing.
- Start facing slightly left or right of the room center.
- Confirm the workbench appears centered, within comfortable reach, and below the displays.
- Confirm every control can be touched from a relaxed seated posture without leaning forward.
- Use the Quest system recenter action and confirm the complete scene remains aligned.

## Workbench input

- Touch each radio-button cap without pulling the trigger; one selection should occur per press.
- Brush a bezel or the workbench surface; no selection should occur.
- Hold a controller near a button without making contact; no selection should occur.
- Touch the stress knob, hold trigger or grip, and rotate through every detent.
- Confirm clockwise and counterclockwise wrist motion match the visible knob direction.
- Confirm each changed detent produces one short haptic pulse and no repeated oscillation.
- Push the stress knob straight into the workbench and confirm it depresses, pulses, and returns to baseline.
- Point and use the trigger from a distance to verify the ray fallback still works.

## Learning flow

- Complete and resubmit all three examples.
- Confirm every example maps its three option groups to the correct three radio groups.
- Confirm each group display reads as three labels aligned with the three physical buttons below it.
- Confirm the guarded Challenge control unlocks only after all examples are submitted.
- Complete a transfer challenge and restart from the takeaway screen.

## Figures and comfort

- Open both map and chart inspection views, pan, zoom, and close with the B button.
- Confirm workbench controls remain usable while inspection is open.
- Scroll any overflowing center-panel text and confirm the scrollbar is visible before scrolling.
- Use snap turn in both directions and confirm no turn occurs while manipulating a control.
- Watch for controller-to-control misalignment, accidental activation, dropped frames, or eye strain.

Record the headset model, seated or standing setup, dominant hand, problem control,
module phase, and URL parameters with each issue.

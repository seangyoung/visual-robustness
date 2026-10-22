# VR Test Checklist

Use the deployed HTTPS build on a Meta Quest. Add `?vrDebug=1` to the URL when
remote browser-console frame diagnostics are useful.

The default workbench distance is `1.05` meters from its origin to the headset.
For placement comparisons, use `?benchDistance=0.98` or another value from
`0.90` through `1.45`. Use `benchHeight` to override the vertical offset below
the headset. Use `benchScale` to test a uniform model scale from `0.72` through
`1.00`, for example `?benchDistance=0.98&benchHeight=1.38&benchScale=0.84`.

## Session setup

- Start once while seated and once while standing.
- Start once with controllers and once with Quest hand tracking enabled.
- Switch between controllers and hands during a session; confirm both input paths recover cleanly.
- Start facing slightly left or right of the room center.
- Confirm the workbench appears centered, within comfortable reach, and below the displays.
- Confirm the far-left dial and far-right guarded controls are reachable from a neutral seated posture without leaning or turning the torso.
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

## Hand tracking

- Press every workbench radio button with the index fingertip; each should activate once per press.
- Brush the workbench, button rims, and adjacent controls; none should activate accidentally.
- Push the Stress Test knob with one fingertip and confirm it resets to baseline.
- Hold the Stress Test knob between the thumb and index finger without fully pinching, twist the wrist in both directions, and confirm each detent is reachable.
- Fully pinch the knob and sweep the index fingertip around the dial; confirm this alternate gesture also reaches each detent.
- Confirm a pinch begun away from the knob does not rotate or reset it.
- Pinch and hold the illuminated rail under the front lip, then pull the workbench closer and change its height.
- Release the rail and confirm the workbench remains at the chosen position throughout all three examples.
- Move the workbench with a controller trigger or grip on the same rail and confirm the hand and controller paths agree.
- Confirm the workbench stops before intersecting the viewer and cannot be moved beyond a recoverable distance.
- Aim at each map and chart, make a deliberate index-thumb pinch, and confirm the intended figure opens.
- In figure inspection, pinch-drag with one hand to pan in the same direction as the hand movement.
- Pinch with both hands, move them apart and together to zoom, and move them together to pan.
- Pinch the figure-inspector close control and confirm the enlarged figure closes.
- When center-panel text overflows, pinch-drag the panel vertically and confirm the text scrolls.
- Repeat the complete learning flow without picking up either controller.

## Learning flow

- Complete and resubmit all three examples.
- Confirm every example maps its three option groups to the correct three radio groups.
- Confirm each group display reads as three labels aligned with the three physical buttons below it.
- Confirm the guarded Challenge control unlocks only after all examples are submitted.
- Submit a transfer answer and confirm Restart Module and View Takeaways appear together on the center panel.
- Restart directly from the submitted challenge, then complete it again and restart from the takeaway screen.

## Figures and comfort

- Open both map and chart inspection views, pan, zoom, and close with the B button or hand pinch.
- Confirm workbench controls remain usable while inspection is open.
- Scroll any overflowing center-panel text and confirm the scrollbar is visible before scrolling.
- Use snap turn in both directions and confirm no turn occurs while manipulating a control.
- Watch for controller-to-control misalignment, accidental activation, dropped frames, or eye strain.

Record the headset model, seated or standing setup, dominant hand, problem control,
module phase, and URL parameters with each issue.

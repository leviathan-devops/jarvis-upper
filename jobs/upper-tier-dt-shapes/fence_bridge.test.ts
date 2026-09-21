// The fence's pinned artifact for job `upper-tier-dt-shapes`.
//
// ONE SOURCE OF TRUTH: this file does NOT duplicate the shape suite — it imports it.
// The canonical tests live at ../../tests/dt_shapes.test.ts (DT-1 opt-in via DT1_LIVE=1,
// DT-2 bug-loop, DT-3 restart/loss accounting, DT-1b the confirm-gate mutation killer).
// Running `bun test -t dt_shapes` here executes that one canonical suite; the fence's
// sha16 pins this bridge, and the bridge resolves to the one file that holds the shapes.
import "../../tests/dt_shapes.test.ts";

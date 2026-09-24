job: upper-tier-dt-shapes
seat: ao-worker
# PORTABILITY: paths are repo-root-relative so the fence resolves on any checkout.
# The fence runs done-when from the job dir (jobs/upper-tier-dt-shapes/).
# DT-1 (live full-loop) SKIPS unless DT1_LIVE=1 with a live daemon — the fence's
# hermetic run covers DT-2, DT-3, DT-1b; set DT1_LIVE=1 + DT1_PROJECT=<proj> for the full loop.
steps:
  - id: dt-shapes-fixture
    artifact: jobs/upper-tier-dt-shapes/fence_bridge.test.ts
    done-when:
      - bun test -t dt_shapes
    depends: []
    retries: 0
    silence_s: 90
sha16:
  dt-shapes-fixture: f6e3a64bb4e1fd1c

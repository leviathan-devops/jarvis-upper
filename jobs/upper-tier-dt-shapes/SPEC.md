job: upper-tier-dt-shapes
seat: ao-worker
steps:
  - id: dt-shapes-fixture
    artifact: /home/leviathan/.ao/data/worktrees/jarvis-upper/jarvis-upper-2/jobs/upper-tier-dt-shapes/fence_bridge.test.ts
    done-when:
      - cd /home/leviathan/.ao/data/worktrees/jarvis-upper/jarvis-upper-2/jobs/upper-tier-dt-shapes && bun test -t dt_shapes
    depends: []
    retries: 0
    silence_s: 90
  - id: dt-shapes-live
    artifact: /home/leviathan/.ao/data/worktrees/jarvis-upper/jarvis-upper-2/jobs/upper-tier-dt-shapes/fence_bridge.test.ts
    done-when:
      - cd /home/leviathan/.ao/data/worktrees/jarvis-upper/jarvis-upper-2 && bun test -t dt_shapes 2>&1 | tail -3 | grep -q "0 fail"
    depends: []
    retries: 0
    silence_s: 90
sha16:
  dt-shapes-fixture: 1cb18c4132d59a67
  dt-shapes-live: 1cb18c4132d59a67

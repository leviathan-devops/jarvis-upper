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
sha16:
  dt-shapes-fixture: 7f8594ece2d0b923

job: upper-tier-dt-shapes
seat: ao-worker
steps:
  - id: dt-shapes-fixture
    artifact: /home/leviathan/.ao/data/worktrees/jarvis-upper/jarvis-upper-2/tests/dt_shapes.test.ts
    done-when:
      - cd /home/leviathan/.ao/data/worktrees/jarvis-upper/jarvis-upper-2 && bun test tests/dt_shapes.test.ts -t dt_shapes
    depends: []
    retries: 0
    silence_s: 90
sha16:
  dt-shapes-fixture: 3172ab5ce44f1f20

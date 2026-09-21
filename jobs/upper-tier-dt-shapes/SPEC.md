job: upper-tier-dt-shapes
seat: ao-worker
steps:
  - id: dt-shapes
    artifact: /home/leviathan/.ao/data/worktrees/jarvis-upper/jarvis-upper-2/tests/dt_shapes.test.ts
    done-when:
      - cd /home/leviathan/.ao/data/worktrees/jarvis-upper/jarvis-upper-2 && bun test -t dt_shapes
    depends: []
    retries: 0
    silence_s: 300
sha16:
  dt-shapes: 5ecd27503bbb7bd6

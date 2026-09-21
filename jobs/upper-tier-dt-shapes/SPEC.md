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
  dt-shapes-fixture: f2bb7f710669ab10

# NOTE: artifact/done-when paths are ABSOLUTE by design — the fence resolves the
# artifact from its own cwd, so it must be host-absolute for the sandbox.

#!/usr/bin/env python3
"""fence-check.py — Plan B spec-gate helper (CI step: `python3 gates/fence-check.py <sha>`).

The fence must hold a PASS row for the PR head sha in the verdict ledger.
  exit 0 = a PASS row exists for <sha>   -> FENCE:<sha>:PASS
  exit 1 = no PASS row for <sha>         -> FENCE:<sha>:NO-PASS-ROW
  exit 2 = cannot measure (bad args, or the ledger file is absent) —
           the unmeasured case is never a pass.
A ledger row counts for <sha> when its verdict is PASS and the first
|-segment of its evidence field is a prefix of <sha> (the fence records
16-hex evidence prefixes; CI passes the full 40-hex head sha).
"""
import json
import os
import sys


def main(argv: list) -> int:
    if len(argv) != 2 or not argv[1].strip():
        print("FENCE-ERROR:usage:expected one git sha argument")
        return 2
    sha = argv[1].strip()
    needle = sha.lower()
    ledger = os.environ.get("FENCE_LEDGER") or os.path.join(".trident", "verdicts.jsonl")
    if not os.path.exists(ledger):
        print(f"FENCE-ERROR:ledger-missing:{ledger}")
        return 2
    with open(ledger, "r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
            except ValueError:
                continue
            if not isinstance(row, dict) or row.get("verdict") != "PASS":
                continue
            first = str(row.get("evidence", "")).split("|")[0].strip().lower()
            if not first or first == "unknown":
                continue
            if needle.startswith(first) or first.startswith(needle):
                print(f"FENCE:{sha}:PASS")
                return 0
    print(f"FENCE:{sha}:NO-PASS-ROW")
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))

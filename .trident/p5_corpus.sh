#!/usr/bin/env bash
# THE P5 ADVERSARIAL CORPUS — both halves per gate, against the DEPLOYED hooks.
# Usage: bash .trident/p5_corpus.sh   (run from the repo root)
# Every probe stages a fixture, runs the REAL hook, and greps its SPECIFIC token.
set +e
REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO" || exit 9
PASS=0; FAIL=0
ok(){ echo "  PASS  $1"; PASS=$((PASS+1)); }
no(){ echo "  FAIL  $1  -- got: $2"; FAIL=$((FAIL+1)); }

echo "=== P5 CORPUS · the DEPLOYED hooks @ $(git rev-parse --short HEAD) ==="

# ---------- W-8 · claim-evidence (a commit message) ----------
echo "--- W-8 claim-evidence ---"
msg_out(){ printf '%s\n' "$1" > /tmp/p5-msg.txt; bash .githooks/prepare-commit-msg /tmp/p5-msg.txt 2>&1; echo "RC=$?"; }
o=$(msg_out "fix: everything works great"); echo "$o" | grep -q 'REJECT(W-8)' && ok "W-8 POSITIVE: a bare claim rejects" || no "W-8 POSITIVE" "$o"
o=$(msg_out "fix: everything verified, 78 pass, src/runtime.ts:233"); echo "$o" | grep -q 'REJECT(W-8)' && no "W-8 NEGATIVE: a claim+artifact must pass" "$o" || ok "W-8 NEGATIVE: a claim+artifact passes"
o=$(msg_out "fix: done a:1"); echo "$o" | grep -q 'REJECT(W-8)' && ok "W-8 EDGE: a fake path 'a:1' rejects (F9)" || no "W-8 EDGE 'a:1'" "$o"

# ---------- W-6 · fake-wiring (a test file) ----------
echo "--- W-6 fake-wiring ---"
mkdir -p tests
printf 'import {it,expect} from "bun:test";\nconst l=[];\nit("x",()=>{ expect(l.includes("SomeSymbol")).toBe(true); });\n' > tests/__p5_w6_pos.test.ts
printf 'import {it,expect} from "bun:test";\nconst s="abc";\nit("x",()=>{ expect(s.includes("Timeout")).toBe(true); });\n' > tests/__p5_w6_neg.test.ts
git add -f tests/__p5_w6_pos.test.ts tests/__p5_w6_neg.test.ts >/dev/null 2>&1
o=$(bash .githooks/pre-commit 2>&1); echo "$o" | grep -q 'REJECT(W-6)' && ok "W-6 POSITIVE: fake-wiring rejects" || no "W-6 POSITIVE" "$o"
o2=$(git reset -q tests/__p5_w6_pos.test.ts >/dev/null 2>&1; bash .githooks/pre-commit 2>&1)
echo "$o2" | grep -q 'REJECT(W-6)' && no "W-6 NEGATIVE: a legit .includes must pass (F5)" "$o2" || ok "W-6 NEGATIVE: a legit .includes passes (F5)"
git reset -q >/dev/null 2>&1; rm -f tests/__p5_w6_pos.test.ts tests/__p5_w6_neg.test.ts

# ---------- W-13 · silent-fallback ----------
echo "--- W-13 silent-fallback ---"
printf 'export function f(){ try { g(); } catch {} }\nfunction g(){ throw new Error("x"); }\n' > src/__p5_w13_pos.ts
git add -f src/__p5_w13_pos.ts >/dev/null 2>&1
o=$(bash .githooks/pre-commit 2>&1); echo "$o" | grep -q 'REJECT(W-13)' && ok "W-13 POSITIVE: an empty catch rejects" || no "W-13 POSITIVE" "$o"
printf 'export function f(){ try { g(); } catch (e) { throw e; } }\nfunction g(){ throw new Error("x"); }\n' > src/__p5_w13_neg.ts
git reset -q >/dev/null 2>&1; git add -f src/__p5_w13_neg.ts >/dev/null 2>&1
o=$(bash .githooks/pre-commit 2>&1); echo "$o" | grep -q 'REJECT(W-13)' && no "W-13 NEGATIVE: a real rethrow must pass" "$o" || ok "W-13 NEGATIVE: a real rethrow passes"
git reset -q >/dev/null 2>&1; rm -f src/__p5_w13_pos.ts src/__p5_w13_neg.ts

# ---------- W-9 · doc-density ----------
echo "--- W-9 doc-density ---"
printf '# thin\n\nshort.\n' > .trident/__p5_w9_thin.md
git add -f .trident/__p5_w9_thin.md >/dev/null 2>&1
o=$(bash .githooks/pre-commit 2>&1); echo "$o" | grep -q 'REJECT(W-9)' && ok "W-9 POSITIVE: a thin .md rejects" || no "W-9 POSITIVE" "$o"
git reset -q >/dev/null 2>&1; rm -f .trident/__p5_w9_thin.md

# ---------- W-14 · stub ----------
echo "--- W-14 stub ---"
printf 'export function f(){ return { stubbed: true }; }\n' > src/__p5_w14_pos.ts
git add -f src/__p5_w14_pos.ts >/dev/null 2>&1
o=$(bash .githooks/pre-commit 2>&1); echo "$o" | grep -q 'REJECT(W-14)' && ok "W-14 POSITIVE: a stub rejects" || no "W-14 POSITIVE" "$o"
git reset -q >/dev/null 2>&1; rm -f src/__p5_w14_pos.ts

# ---------- THE WORD-SPLIT EDGE (F7/F8) ----------
echo "--- THE WORD-SPLIT EDGE ---"
mkdir -p "src/__p5 dir"
printf 'export const x=1;\n' > "src/__p5 dir/a.ts"
git add -f "src/__p5 dir/a.ts" >/dev/null 2>&1
o=$(bash .githooks/pre-commit 2>&1); rc=$?
if echo "$o" | grep -qE 'unbound variable|command not found|syntax error'; then no "WORD-SPLIT: a spaced path must not crash the hook (F7/F8)" "$o"; else ok "WORD-SPLIT: a spaced path handled (rc=$rc)"; fi
git reset -q >/dev/null 2>&1; rm -rf "src/__p5 dir"

# ---------- THE EXIT-CAP (F2) ----------
echo "--- THE EXIT-CAP ---"
for lib in .githooks/lib/scan-stub.sh .githooks/lib/scan-silent.sh; do
  [ -f "$lib" ] || continue
  grep -qE 'return.*255|\$\(\(.*255|hits > 255' "$lib" && ok "EXIT-CAP: $lib caps at 255 (F2)" || no "EXIT-CAP: $lib uncapped (F2)" "$(grep -n 'return' "$lib" | tail -2)"
done

echo ""
echo "=== P5 CORPUS RESULT: $PASS pass / $FAIL fail ==="
git status --porcelain | grep '__p5' && echo "  WARNING: probe residue remains"
exit 0

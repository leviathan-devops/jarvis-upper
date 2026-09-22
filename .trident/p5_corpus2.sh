#!/usr/bin/env bash
set +e
cd "$(dirname "$0")/.." || exit 9
PASS=0; FAIL=0
ok(){ echo "  PASS  $1"; PASS=$((PASS+1)); }
no(){ echo "  FAIL  $1  -- $2"; FAIL=$((FAIL+1)); }
echo "=== P5 CORPUS v2 · the DEPLOYED hooks @ $(git rev-parse --short HEAD) ==="

msg(){ printf '%s\n' "$1" > /tmp/m.txt; bash .githooks/prepare-commit-msg /tmp/m.txt 2>&1; }
stage_run(){ git add -f "$1" >/dev/null 2>&1; bash .githooks/pre-commit 2>&1; git reset -q >/dev/null 2>&1; rm -f "$1"; }

echo "--- W-8 claim-evidence ---"
o=$(msg "fix: everything works great");        echo "$o"|grep -q 'REJECT(W-8)' && ok "W-8 POS bare claim" || no "W-8 POS" "$o"
o=$(msg "fix: verified, 78 pass, src/runtime.ts:233"); echo "$o"|grep -q 'REJECT(W-8)' && no "W-8 NEG claim+artifact" "$o" || ok "W-8 NEG claim+artifact"
o=$(msg "fix: done a:1");                      echo "$o"|grep -q 'REJECT(W-8)' && ok "W-8 EDGE fake path a:1" || no "W-8 EDGE" "$o"
o=$(msg "feat: done");                         echo "$o"|grep -q 'REJECT(W-8)' && ok "W-8 EDGE bare 'done' (the prior session's gap)" || no "W-8 'done'" "$o"

echo "--- W-6 fake-wiring ---"
mkdir -p tests
printf 'import{it,expect}from"bun:test";\nit("x",()=>{const srcText="import { FireGate }";expect(srcText.includes("FireGate")).toBe(true)});\n' > tests/__p.test.ts
o=$(stage_run tests/__p.test.ts); echo "$o"|grep -q 'REJECT(W-6)' && ok "W-6 POS source-text fake-wiring" || no "W-6 POS" "$o"
printf 'import{it,expect}from"bun:test";\nit("x",()=>{const err="Timeout";expect(err.includes("Timeout")).toBe(true)});\n' > tests/__p.test.ts
o=$(stage_run tests/__p.test.ts); echo "$o"|grep -q 'REJECT(W-6)' && no "W-6 NEG legit err.includes" "$o" || ok "W-6 NEG legit err.includes"

echo "--- W-13 silent-fallback ---"
mkdir -p src
printf 'export function f(){ try{g()}catch{} }\nfunction g(){throw new Error("x")}\n' > src/__p.ts
o=$(stage_run src/__p.ts); echo "$o"|grep -q 'REJECT(W-13)' && ok "W-13 POS empty catch" || no "W-13 POS" "$o"
printf 'export function f(){ try{g()}catch(e){throw e} }\nfunction g(){throw new Error("x")}\n' > src/__p.ts
o=$(stage_run src/__p.ts); echo "$o"|grep -q 'REJECT(W-13)' && no "W-13 NEG real rethrow" "$o" || ok "W-13 NEG real rethrow"
printf 'export function f(){ try{g()}catch{ /* already dead */ } }\nfunction g(){throw new Error("x")}\n' > src/__p.ts
o=$(stage_run src/__p.ts); echo "$o"|grep -q 'REJECT(W-13)' && no "W-13 NEG named-reason ignore" "$o" || ok "W-13 NEG named-reason ignore (the audit fix)"
printf 'export function f(){ try{g()}catch{ /* ignore */ } }\nfunction g(){throw new Error("x")}\n' > src/__p.ts
o=$(stage_run src/__p.ts); echo "$o"|grep -q 'REJECT(W-13)' && ok "W-13 POS unnamed comment-only catch" || no "W-13 POS unnamed" "$o"

echo "--- W-9 doc-density ---"
printf '# t\n\nx\n' > .trident/__p.md; o=$(stage_run .trident/__p.md)
echo "$o"|grep -q 'REJECT(W-9)' && no "W-9 .trident exempt" "$o" || ok "W-9 .trident exempt (working state)"
printf '# t\n\nx\n' > docs__p.md; o=$(stage_run docs__p.md)
echo "$o"|grep -q 'REJECT(W-9)' && ok "W-9 POS thin authored doc" || no "W-9 POS" "$o"

echo "--- W-14 stub ---"
printf 'export function f(){ return { stubbed: true }; }\n' > src/__p.ts
o=$(stage_run src/__p.ts); echo "$o"|grep -q 'REJECT(W-14)' && ok "W-14 POS stub" || no "W-14 POS" "$o"

echo "--- the pre-push gates (W-2, W-3) via a REAL repo ---"
export GIT_TERMINAL_PROMPT=0
T=$(mktemp -d); BARE=$(mktemp -d); git init -q --bare "$BARE/r.git"
( cd "$T"; git init -q; git config user.email t@t; git config user.name t
  cp -r "$PWD/.githooks" "$T/.githooks" 2>/dev/null || cp -r "$OLDPWD/.githooks" "$T/.githooks"
  chmod +x .githooks/* .githooks/lib/* 2>/dev/null; git config core.hooksPath .githooks
  git remote add origin "$BARE/r.git"
  echo a>a.txt; git add a.txt; git commit -q --no-verify -m "feat: initial commit with a real file"
  git push -q origin HEAD:refs/heads/base 2>/dev/null
  echo b>b.txt; git add b.txt; git commit -q --no-verify -m "feat: created the widget" -m "created phantom-widget.ts"
  OUT=$(git push origin HEAD:refs/heads/feat-x 2>&1); echo "$OUT" | grep -q 'REJECT(W-3)' && echo "  PASS  W-3 phantom via a REAL push" || echo "  FAIL  W-3 via a real push -- $OUT"
  mkdir -p src; printf 'export const orphanZ=1;\n' > src/orphan-z.ts; git add -f src/orphan-z.ts
  git commit -q --no-verify -m "feat: added the orphan"
  OUT2=$(git push origin HEAD:refs/heads/feat-y 2>&1); echo "$OUT2" | grep -q 'REJECT(W-2)' && echo "  PASS  W-2 orphan via a REAL push" || echo "  FAIL  W-2 via a real push -- $OUT2"
)
rm -rf "$T" "$BARE"
echo ""
echo "=== P5 CORPUS v2: $PASS pass / $FAIL fail ==="
git status --porcelain | grep '__p\|docs__p' && echo "  ★ RESIDUE" || echo "  no residue"

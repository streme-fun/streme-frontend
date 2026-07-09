#!/usr/bin/env bash
# Signer isolation check (Agent Floor plan U7 / "First server-side signer").
#
# src/lib/resident/wallet.ts is the ONLY signer construction in the repo and
# may only be imported by src/lib/resident/engine.ts. Anything else touching
# it — app code, hooks, tests — fails this check (wired into check:all).
set -euo pipefail
cd "$(dirname "$0")/.."

allowed="src/lib/resident/engine.ts"
violations=""

# Any path-qualified import of the signer module, repo-wide.
hits=$(grep -rl --include='*.ts' --include='*.tsx' 'resident/wallet' src __tests__ 2>/dev/null \
  | grep -v "^src/lib/resident/wallet.ts$" \
  | grep -v "^${allowed}$" || true)
violations+="${hits}"

# Relative './wallet' imports from within the resident module itself.
hits=$(grep -rl --include='*.ts' -e '"\./wallet"' -e "'\./wallet'" src/lib/resident 2>/dev/null \
  | grep -v "^${allowed}$" || true)
[ -n "$hits" ] && violations+=$'\n'"${hits}"

violations=$(echo "$violations" | grep -v '^$' | sort -u || true)

if [ -n "$violations" ]; then
  echo "❌ Resident signer isolation violated — only ${allowed} may import src/lib/resident/wallet.ts:"
  echo "$violations"
  exit 1
fi
echo "✅ Resident signer isolation OK (wallet.ts imported only by engine.ts)"

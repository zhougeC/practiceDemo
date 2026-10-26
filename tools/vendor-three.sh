#!/usr/bin/env bash
# TASK-002 P0 build lock (plan.md 5.7 / M-30).
# Runs on the Mac only, with network access for the first install; it is a build-time
# tool and is never referenced by the delivered page. Output: vendor/three.min.js,
# vendor/three.LICENSE, vendor/VERSION.txt.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENDOR_DIR="$ROOT/tools/vendor"
OUT_DIR="$ROOT/vendor"
OUT="$OUT_DIR/three.min.js"
INPUT="$VENDOR_DIR/node_modules/three/build/three.module.js"
LICENSE_IN="$VENDOR_DIR/node_modules/three/LICENSE"
MAX_BYTES=819200

fail() { echo "FAIL: $*" >&2; exit 1; }
sha256() { shasum -a 256 "$1" | awk '{print $1}'; }
bytes() { stat -f%z "$1"; }
count() { grep -c "$1" "$2" || true; }
countE() { grep -cE "$1" "$2" || true; }

cd "$VENDOR_DIR"

# Step 1: install exactly the versions pinned in package.json/package-lock.json (M-30).
npm ci --no-audit --no-fund

[ -f "$INPUT" ] || fail "three build input missing: $INPUT"
[ -f "$LICENSE_IN" ] || fail "three LICENSE missing: $LICENSE_IN"

THREE_VERSION="$(node -p "require('./node_modules/three/package.json').version")"
ESBUILD_VERSION="$(node -p "require('./node_modules/esbuild/package.json').version")"
NODE_VERSION="$(node -v)"
[ "$THREE_VERSION" = "0.162.0" ] || fail "three is $THREE_VERSION, build lock requires 0.162.0"
[ "$ESBUILD_VERSION" = "0.24.0" ] || fail "esbuild is $ESBUILD_VERSION, build lock requires 0.24.0"

INPUT_SHA="$(sha256 "$INPUT")"

# Step 2: the exact plan.md 5.7 command: classic IIFE global THREE, minified, no source map,
# no legal comments (license is shipped separately as vendor/three.LICENSE).
BUILD_CMD=(npx --no-install esbuild node_modules/three/build/three.module.js \
  --bundle --format=iife --global-name=THREE --minify --target=es2018 \
  --legal-comments=none --outfile=../../vendor/three.min.js)
mkdir -p "$OUT_DIR"
"${BUILD_CMD[@]}"
cp "$LICENSE_IN" "$OUT_DIR/three.LICENSE"

# Step 3: build gates from plan.md 5.7. Every gate is fatal; no gate is skipped.
OUT_BYTES="$(bytes "$OUT")"
[ "$OUT_BYTES" -le "$MAX_BYTES" ] || fail "output is $OUT_BYTES B, limit is $MAX_BYTES B"
[ "$(count 'sourceMappingURL' "$OUT")" -eq 0 ] || fail "output contains sourceMappingURL"
[ "$(countE '^(import|export)[ {*]' "$OUT")" -eq 0 ] || fail "output has a top-level import/export"
[ "$(count 'import(' "$OUT")" -eq 0 ] || fail "output contains a dynamic import()"
case "$(head -c 10 "$OUT")" in
  'var THREE='*) : ;;
  *) fail "output does not start with 'var THREE='" ;;
esac

OUT_SHA="$(sha256 "$OUT")"
LICENSE_SHA="$(sha256 "$OUT_DIR/three.LICENSE")"

# Step 4: VERSION.txt records everything plan.md 5.7 requires, plus the license hash.
cat > "$OUT_DIR/VERSION.txt" <<EOF
three_version=$THREE_VERSION
esbuild_version=$ESBUILD_VERSION
node_version=$NODE_VERSION
input_path=tools/vendor/node_modules/three/build/three.module.js
input_sha256=$INPUT_SHA
output_path=vendor/three.min.js
output_sha256=$OUT_SHA
output_bytes=$OUT_BYTES
license_path=vendor/three.LICENSE
license_sha256=$LICENSE_SHA
command=cd tools/vendor && npm ci && npx --no-install esbuild node_modules/three/build/three.module.js --bundle --format=iife --global-name=THREE --minify --target=es2018 --legal-comments=none --outfile=../../vendor/three.min.js
EOF

echo "PASS build: three=$THREE_VERSION esbuild=$ESBUILD_VERSION node=$NODE_VERSION"
echo "PASS size: $OUT_BYTES B <= $MAX_BYTES B"
echo "PASS iife: starts with 'var THREE=', no top-level import/export, no sourceMappingURL"
echo "PASS output sha256: $OUT_SHA"
echo "PASS version file: vendor/VERSION.txt"

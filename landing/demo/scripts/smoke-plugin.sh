#!/usr/bin/env bash
set -euo pipefail

API="${API:-http://localhost:3001}"
PROMPT="${PROMPT:-modern team office, sunlit}"

echo "==> picking first ready brand…"
BRAND_ID=$(curl -sS "$API/api/brands" | jq -r '.[] | select(.profileStatus == "ready") | .id' | head -1)
if [ -z "$BRAND_ID" ]; then
  echo "no brand with ready profile found — seed/run extraction first" >&2
  exit 1
fi
echo "    brandId=$BRAND_ID"

echo "==> POST /api/generations/image…"
GEN_ID=$(curl -sS -X POST "$API/api/generations/image" \
  -H 'content-type: application/json' \
  -d "$(jq -n --arg p "$PROMPT" --arg b "$BRAND_ID" \
    '{prompt:$p,brandId:$b,layerName:"hero-image"}')" \
  | jq -r .id)
echo "    generationId=$GEN_ID"

echo "==> polling status (60s timeout)…"
deadline=$(( $(date +%s) + 60 ))
while :; do
  json=$(curl -sS "$API/api/generations/$GEN_ID")
  s=$(echo "$json" | jq -r .status)
  echo "    status=$s"
  [ "$s" = "done" ] && break
  if [ "$s" = "failed" ]; then
    echo "FAILED: $(echo "$json" | jq -r .error)" >&2
    exit 1
  fi
  if [ "$(date +%s)" -ge "$deadline" ]; then
    echo "TIMEOUT after 60s" >&2
    exit 1
  fi
  sleep 2
done

echo "==> asserting 3 variants…"
n=$(echo "$json" | jq '.output.variants | length')
if [ "$n" != "3" ]; then
  echo "expected 3 variants, got $n" >&2
  exit 1
fi

echo "==> asserting first variant served by storage proxy…"
KEY=$(echo "$json" | jq -r '.output.variants[0].s3Key')
ct=$(curl -sSI "$API/api/_storage/$KEY" | grep -i '^content-type:' | awk '{print $2}' | tr -d '\r')
case "$ct" in
  image/png*) echo "    content-type=$ct" ;;
  *) echo "expected image/png, got $ct" >&2; exit 1 ;;
esac

echo "==> asserting usage rollup includes image feature with non-zero cost…"
curl -sS "$API/api/usage?groupBy=feature&days=1" \
  | jq -e '.[] | select(.key == "image") | (.costUsd | tonumber > 0)' >/dev/null

echo "==> SMOKE OK · generationId=$GEN_ID"

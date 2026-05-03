#!/usr/bin/env bash
# Curl smoke for every Studio API endpoint. Exits non-zero on any failure.
# Run via `pnpm test:smoke` from the demo root.
set -euo pipefail

API="${API:-http://localhost:3001}"

echo "[smoke] healthz"
curl -fsS "$API/healthz" | jq -e '.ok == true' >/dev/null

echo "[smoke] /api/me"
curl -fsS "$API/api/me" | jq -e '.orgId and .userId' >/dev/null

echo "[smoke] /api/brands"
B=$(curl -fsS "$API/api/brands")
echo "$B" | jq -e 'type == "array" and length >= 2' >/dev/null
BID=$(echo "$B" | jq -r '.[0].id')

echo "[smoke] /api/brands/$BID"
curl -fsS "$API/api/brands/$BID" | jq -e '.brand.id and .stats and (.currentProfile != null)' >/dev/null

echo "[smoke] /api/brands/$BID/profiles"
PROFILES=$(curl -fsS "$API/api/brands/$BID/profiles")
echo "$PROFILES" | jq -e 'type == "array" and length >= 1' >/dev/null

PID=$(curl -fsS "$API/api/brands/$BID" | jq -r '.currentProfile.id')

echo "[smoke] /api/profiles/$PID"
curl -fsS "$API/api/profiles/$PID" | jq -e '.profile.brand_name and .status == "ready"' >/dev/null

echo "[smoke] /api/generations"
curl -fsS "$API/api/generations?limit=10" | jq -e '.items | type == "array" and length >= 1' >/dev/null

echo "[smoke] /api/generations?status=done"
curl -fsS "$API/api/generations?limit=5&status=done" | jq -e '.items | type == "array"' >/dev/null

echo "[smoke] /api/usage groupBy=day"
curl -fsS "$API/api/usage?groupBy=day&days=30" | jq -e 'type == "array" and length >= 1' >/dev/null

echo "[smoke] /api/usage groupBy=user"
curl -fsS "$API/api/usage?groupBy=user&days=30" | jq -e 'type == "array" and length >= 1' >/dev/null

echo "[smoke] /api/usage groupBy=brand"
curl -fsS "$API/api/usage?groupBy=brand&days=30" | jq -e 'type == "array"' >/dev/null

echo "[smoke] /api/usage groupBy=feature"
curl -fsS "$API/api/usage?groupBy=feature&days=30" | jq -e 'type == "array"' >/dev/null

echo "[smoke] /api/users"
curl -fsS "$API/api/users" | jq -e 'type == "array" and length >= 1' >/dev/null

# Pick a generation id and round-trip the detail endpoint
GID=$(curl -fsS "$API/api/generations?limit=1" | jq -r '.items[0].id // empty')
if [ -n "$GID" ]; then
  echo "[smoke] /api/generations/$GID"
  curl -fsS "$API/api/generations/$GID" | jq -e '.id == "'"$GID"'"' >/dev/null
fi

echo "all good"

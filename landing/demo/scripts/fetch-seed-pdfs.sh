#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/infra/seed-pdfs"
mkdir -p "$DIR"
SLACK_URL="https://cdn.shopify.com/s/files/1/0565/3423/7349/files/slack-2020.pdf?v=1620422766"
HEINEKEN_URL="https://cdn.shopify.com/s/files/1/0565/3423/7349/files/heineken-Brand_guidelines.pdf?v=1630653369"
[ -f "$DIR/slack-2020.pdf" ] || curl -fsSL "$SLACK_URL" -o "$DIR/slack-2020.pdf"
[ -f "$DIR/heineken.pdf" ]   || curl -fsSL "$HEINEKEN_URL" -o "$DIR/heineken.pdf"
echo "[seed-pdfs] ready in $DIR"
ls -lh "$DIR"

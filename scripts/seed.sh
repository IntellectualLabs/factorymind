#!/usr/bin/env bash
# Decompress seed data into data/ directory for the backend to load.
# Run this once after cloning: ./scripts/seed.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
SEED_DIR="$ROOT_DIR/data/seed"
DATA_DIR="$ROOT_DIR/data"

echo "Seeding FactoryMind database..."

for gz in "$SEED_DIR"/*.csv.gz; do
  name="$(basename "$gz" .gz)"
  dest="$DATA_DIR/$name"

  if [ -f "$dest" ]; then
    echo "  $name already exists, skipping"
  else
    echo "  Decompressing $name..."
    gunzip -k "$gz"
    mv "$SEED_DIR/$name" "$dest"
  fi
done

echo "Done. Data files in $DATA_DIR:"
ls -lh "$DATA_DIR"/*.csv 2>/dev/null || echo "  (no CSV files found — check seed directory)"

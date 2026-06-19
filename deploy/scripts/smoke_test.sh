#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://127.0.0.1}"

echo "Checking frontend: ${BASE_URL}/"
curl --fail --silent --show-error --location "${BASE_URL}/" >/dev/null

echo "Checking API health: ${BASE_URL}/api/health"
curl --fail --silent --show-error --location "${BASE_URL}/api/health" >/dev/null

echo "Smoke test passed."

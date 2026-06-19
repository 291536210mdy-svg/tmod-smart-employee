#!/usr/bin/env bash
set -euo pipefail

DATA_DIR="${1:-/var/lib/tmod-smart-employee/data}"
BACKUP_DIR="${2:-/var/backups/tmod-smart-employee}"
STAMP="$(date +%Y%m%d_%H%M%S)"
TARGET="${BACKUP_DIR}/local-data-${STAMP}.tar.gz"

mkdir -p "${BACKUP_DIR}"

if [ ! -d "${DATA_DIR}" ]; then
  echo "Data directory not found: ${DATA_DIR}" >&2
  exit 1
fi

tar -czf "${TARGET}" -C "$(dirname "${DATA_DIR}")" "$(basename "${DATA_DIR}")"
echo "Backup written to ${TARGET}"

#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="${ROOT_DIR}/.local/mysql-data"
RUN_DIR="${ROOT_DIR}/.local/mysql-run"
DB_NAME="${LOCAL_MYSQL_DATABASE:-ashtechpay_dev}"
MYSQL_PORT="${LOCAL_MYSQL_PORT:-3306}"
SOCKET="${RUN_DIR}/mysql.sock"
PID_FILE="${RUN_DIR}/mysql.pid"
LOG_FILE="${RUN_DIR}/mysql.log"
SCHEMA_DUMP="${ROOT_DIR}/exports/ashtechpay-supabase-mysql-fixed.sql"
SCHEMA_MARKER="${DATA_DIR}/.ashtechpay-schema-imported"

mkdir -p "${DATA_DIR}" "${RUN_DIR}"

if [[ ! -d "${DATA_DIR}/mysql" ]]; then
  echo "[LocalMySQL] Initializing MariaDB data directory"
  mariadb-install-db \
    --no-defaults \
    --datadir="${DATA_DIR}" \
    --auth-root-authentication-method=normal \
    --skip-test-db \
    >/dev/null
fi

if ! mariadb-admin --no-defaults --protocol=socket --socket="${SOCKET}" -uroot ping >/dev/null 2>&1; then
  echo "[LocalMySQL] Starting MariaDB on 127.0.0.1:${MYSQL_PORT}"
  mariadbd \
    --no-defaults \
    --datadir="${DATA_DIR}" \
    --socket="${SOCKET}" \
    --port="${MYSQL_PORT}" \
    --bind-address=127.0.0.1 \
    --pid-file="${PID_FILE}" \
    --log-error="${LOG_FILE}" \
    --max_allowed_packet=64M \
    --wait_timeout=28800 \
    --skip-name-resolve \
    >/dev/null 2>&1 &
fi

for attempt in {1..30}; do
  if mariadb-admin --no-defaults --protocol=socket --socket="${SOCKET}" -uroot ping >/dev/null 2>&1; then
    break
  fi
  if [[ "${attempt}" == "30" ]]; then
    echo "[LocalMySQL] MariaDB did not become ready" >&2
    tail -80 "${LOG_FILE}" >&2 || true
    exit 1
  fi
  sleep 1
done

mariadb --no-defaults --protocol=socket --socket="${SOCKET}" -uroot \
  -e "CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

if [[ ! -f "${SCHEMA_MARKER}" ]]; then
  if [[ ! -f "${SCHEMA_DUMP}" ]]; then
    echo "[LocalMySQL] Missing schema dump: ${SCHEMA_DUMP}" >&2
    exit 1
  fi
  echo "[LocalMySQL] Importing local schema snapshot"
  mariadb --no-defaults --protocol=socket --socket="${SOCKET}" -uroot "${DB_NAME}" < "${SCHEMA_DUMP}"
  touch "${SCHEMA_MARKER}"
fi

echo "[LocalMySQL] Ready: ${DB_NAME}"
export DB_DIALECT=mysql
export MYSQL_DATABASE_URL="mysql://root@127.0.0.1:${MYSQL_PORT}/${DB_NAME}"
exec npm run dev
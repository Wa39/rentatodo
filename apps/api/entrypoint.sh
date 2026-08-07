#!/bin/sh
set -e

# Alembic is idempotent — already-applied migrations are skipped.
alembic upgrade head

exec uvicorn app.main:app --host 0.0.0.0 --port "${APP_PORT:-8000}"

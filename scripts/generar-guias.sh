#!/usr/bin/env bash
# Genera las guías del sistema de presentismo.
#
# Prepara solo la primera vez un entorno de Python con reportlab dentro de
# scripts/.venv. Va en un entorno propio y no en el Python del sistema porque
# las distros recientes lo bloquean (PEP 668) y `pip install` falla.
#
#   pnpm run guias                      # usa la contraseña de MERY_PASS o un aviso
#   MERY_PASS='...' pnpm run guias      # con la contraseña real de Mery
#   EQUIPO_PASS='micaela=...;luna=...' pnpm run guias   # con las claves del equipo en la tabla
#   pnpm run guias -- otra/carpeta      # a otra carpeta
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV="$RAIZ/scripts/.venv"
DESTINO="${1:-$RAIZ/reportes}"

if [ ! -x "$VENV/bin/python" ]; then
  echo "Preparando el entorno de Python (solo la primera vez)…"
  python3 -m venv "$VENV"
  "$VENV/bin/pip" install --quiet --upgrade pip
  "$VENV/bin/pip" install --quiet -r "$RAIZ/scripts/requirements.txt"
fi

if [ -z "${MERY_PASS:-}" ]; then
  echo "Aviso: sin MERY_PASS, la guía de Mery sale sin la contraseña."
  echo "       Corré:  MERY_PASS='su-contraseña' pnpm run guias"
fi

"$VENV/bin/python" "$RAIZ/scripts/generar-guias-presentismo.py" "$DESTINO"

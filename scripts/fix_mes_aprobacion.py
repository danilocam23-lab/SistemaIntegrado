"""Script para normalizar el campo mes_aprobacion en todos los requerimientos existentes.

Convierte cualquier formato de mes (ENERO, enero 2025, ENE-25, etc.) al formato
canónico "Enero", "Febrero", ... "Diciembre".

Uso:
    cd api
    python ../scripts/fix_mes_aprobacion.py [--dry-run]
"""
from __future__ import annotations

import asyncio
import re
import sys
import unicodedata

# ── Asegura que el path de la app esté disponible ──────────────────────────
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "api"))

from app.config import get_settings
from app.db import init_db, cerrar_db
from app.documents.requerimiento import Requerimiento

MESES_MAP = {
    "enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5, "junio": 6,
    "julio": 7, "agosto": 8, "septiembre": 9, "setiembre": 9, "octubre": 10,
    "noviembre": 11, "diciembre": 12,
}

MESES_NOMBRES = {
    1: "Enero", 2: "Febrero", 3: "Marzo", 4: "Abril", 5: "Mayo", 6: "Junio",
    7: "Julio", 8: "Agosto", 9: "Septiembre", 10: "Octubre", 11: "Noviembre", 12: "Diciembre",
}


def quitar_tildes(s: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", s.lower())
        if unicodedata.category(c) != "Mn"
    )


def normalizar_mes(raw: str | None) -> str | None:
    """Convierte cualquier representación de mes al formato canónico."""
    if not raw:
        return None
    txt = raw.strip()
    txt_norm = quitar_tildes(txt)

    # Buscar nombre de mes (completo o abreviado 3 letras)
    for nombre, numero in MESES_MAP.items():
        nombre_norm = quitar_tildes(nombre)
        if nombre_norm in txt_norm or txt_norm.startswith(nombre_norm[:3]):
            return MESES_NOMBRES[numero]

    # Buscar número de mes (1-12)
    m = re.search(r'\b(\d{1,2})\b', txt)
    if m:
        num = int(m.group(1))
        if 1 <= num <= 12:
            return MESES_NOMBRES[num]

    return None  # No se pudo normalizar; se deja sin cambio


async def main(dry_run: bool = False) -> None:
    print("Conectando a MongoDB…")
    await init_db()

    requerimientos = await Requerimiento.find_all().to_list()
    print(f"Requerimientos encontrados: {len(requerimientos)}")

    modificados = 0
    sin_cambio = 0
    no_reconocidos: set[str] = set()

    for req in requerimientos:
        cambiado = False
        for entrega in req.entregas:
            if entrega.mes_aprobacion is None:
                continue
            original = entrega.mes_aprobacion
            nuevo = normalizar_mes(original)
            if nuevo is None:
                no_reconocidos.add(original)
                continue
            if nuevo != original:
                entrega.mes_aprobacion = nuevo
                cambiado = True
                print(f"  {req.codigo_req} entrega {entrega.numero}: '{original}' -> '{nuevo}'")
            else:
                sin_cambio += 1

        if cambiado:
            modificados += 1
            if not dry_run:
                await req.save()

    print()
    print(f"{'[DRY RUN] ' if dry_run else ''}Requerimientos modificados: {modificados}")
    print(f"Entregas ya en formato correcto: {sin_cambio}")
    if no_reconocidos:
        print(f"Valores no reconocidos (sin cambio): {sorted(no_reconocidos)}")
    else:
        print("Todos los valores fueron normalizados correctamente.")

    await cerrar_db()


if __name__ == "__main__":
    dry_run = "--dry-run" in sys.argv
    if dry_run:
        print("Modo DRY RUN: no se guardarán cambios.")
    asyncio.run(main(dry_run=dry_run))

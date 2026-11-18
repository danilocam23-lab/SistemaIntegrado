"""Sincronía del vocabulario de telemetría entre frontend (catalogo.ts) y backend."""
import re
from pathlib import Path

import pytest

from app.services.catalogo_uso import (
    EXPORTACIONES,
    FORMULARIOS,
    MODULOS,
    PANTALLAS,
    PREFIJOS_INTERACCION,
)

RUTA = Path(__file__).resolve().parents[2] / "web" / "src" / "analitica" / "catalogo.ts"


@pytest.fixture(scope="module")
def fuente() -> str:
    if not RUTA.exists():
        pytest.skip("No se encontró web/src/analitica/catalogo.ts")
    return RUTA.read_text(encoding="utf-8")


def _bloque(fuente: str, inicio: str, fin: str) -> str:
    i = fuente.index(inicio)
    return fuente[i:fuente.index(fin, i)]


def _lista(fuente: str, nombre: str) -> set[str]:
    cuerpo = _bloque(fuente, f"export const {nombre} = [", "] as const")
    return set(re.findall(r"'([^']+)'", cuerpo))


def test_pantallas_y_modulos_del_frontend_existen_en_backend(fuente):
    filas = re.findall(
        r"\['[^']+',\s*'([^']+)',\s*'([^']+)'\]",
        _bloque(fuente, "export const PANTALLAS = [", "] as const"),
    )
    assert filas, "No se pudo parsear PANTALLAS de catalogo.ts"
    faltan_p = sorted({p for p, _ in filas} - PANTALLAS)
    faltan_m = sorted({m for _, m in filas} - MODULOS)
    assert not faltan_p, f"Pantallas del frontend ausentes en catalogo_uso.PANTALLAS: {faltan_p}"
    assert not faltan_m, f"Módulos del frontend ausentes en catalogo_uso.MODULOS: {faltan_m}"


def test_prefijos_de_controles_explicitos_cubiertos(fuente):
    claves = re.findall(
        r"^\s*'([a-z0-9_]+)\.[^']*':\s*\[",
        _bloque(fuente, "export const CONTROLES = {", "} as const"),
        flags=re.MULTILINE,
    )
    assert claves, "No se pudo parsear CONTROLES de catalogo.ts"
    faltan = sorted({f"{c}." for c in claves} - set(PREFIJOS_INTERACCION))
    assert not faltan, f"Prefijos de CONTROLES ausentes en PREFIJOS_INTERACCION: {faltan}"
    assert "control." in PREFIJOS_INTERACCION  # controles automáticos (instrumentación)


def test_formularios_y_exportaciones_coinciden(fuente):
    assert _lista(fuente, "FORMULARIOS") <= FORMULARIOS
    assert _lista(fuente, "EXPORTACIONES") <= EXPORTACIONES

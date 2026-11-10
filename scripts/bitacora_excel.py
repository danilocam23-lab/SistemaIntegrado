"""Registra actividades en la bitácora Excel única del proyecto.

Uso (válido para cualquier IA o persona):
    python scripts/bitacora_excel.py tareas.json
    echo [...] | python scripts/bitacora_excel.py -

El JSON es una lista de objetos con las claves: solicitud, tarea, descripcion,
agente, ia, minutos, tokens, estado, archivos. Solo `solicitud` y `tarea` son
obligatorias. `tokens` es un entero estimado ("Tokens consumidos"), ubicado entre
"Duración (min)" y "Estado".
El archivo se crea únicamente si no existe; si existe, se agregan filas al final.
Si existe sin la columna "Tokens consumidos", se migra insertándola en su posición.
Las columnas se localizan por nombre de encabezado, no por índice fijo.
"""

import json
import sys
from copy import copy
from datetime import datetime
from pathlib import Path

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

RUTA = Path(__file__).resolve().parent.parent / "docs" / "bitacora-actividades.xlsx"
HOJA = "Actividades"
COLUMNAS = [
    ("ID", 6),
    ("Fecha", 12),
    ("Hora", 8),
    ("Solicitud", 40),
    ("Tarea", 50),
    ("Descripción", 60),
    ("Agente", 16),
    ("IA", 16),
    ("Duración (min)", 14),
    ("Tokens consumidos", 18),
    ("Estado", 12),
    ("Archivos", 45),
]


def _crear() -> None:
    libro = Workbook()
    hoja = libro.active
    hoja.title = HOJA
    hoja.append([nombre for nombre, _ in COLUMNAS])
    for i, (_, ancho) in enumerate(COLUMNAS, start=1):
        celda = hoja.cell(row=1, column=i)
        celda.font = Font(bold=True, color="FFFFFF")
        celda.fill = PatternFill("solid", fgColor="1F4E79")
        celda.alignment = Alignment(vertical="center")
        hoja.column_dimensions[get_column_letter(i)].width = ancho
    hoja.freeze_panes = "A2"
    hoja.auto_filter.ref = f"A1:{get_column_letter(len(COLUMNAS))}1"
    RUTA.parent.mkdir(parents=True, exist_ok=True)
    libro.save(RUTA)


COL_TOKENS = "Tokens consumidos"


def _indices(hoja) -> dict[str, int]:
    """Mapa encabezado → número de columna (base 1), leído de la fila 1."""
    return {
        str(c.value).strip(): c.column for c in hoja[1] if c.value is not None
    }


def _migrar(hoja) -> bool:
    """Inserta la columna de tokens tras 'Duración (min)' si falta. Devuelve si migró."""
    indices = _indices(hoja)
    if COL_TOKENS in indices:
        return False
    ancla = indices["Duración (min)"]
    nueva = ancla + 1
    ultima = hoja.max_column
    anchos = {
        i: hoja.column_dimensions[get_column_letter(i)].width for i in range(nueva, ultima + 1)
    }
    hoja.insert_cols(nueva)
    # insert_cols no desplaza los anchos: se reubican manualmente.
    for i, ancho in anchos.items():
        hoja.column_dimensions[get_column_letter(i + 1)].width = ancho
    hoja.column_dimensions[get_column_letter(nueva)].width = 18
    origen = hoja.cell(row=1, column=ancla)
    destino = hoja.cell(row=1, column=nueva, value=COL_TOKENS)
    destino.font = copy(origen.font)
    destino.fill = copy(origen.fill)
    destino.alignment = copy(origen.alignment)
    destino.border = copy(origen.border)
    destino.number_format = origen.number_format
    hoja.auto_filter.ref = f"A1:{get_column_letter(ultima + 1)}1"
    return True


def registrar(tareas: list[dict]) -> int:
    if not RUTA.exists():
        _crear()
    libro = load_workbook(RUTA)
    hoja = libro[HOJA] if HOJA in libro.sheetnames else libro.active
    _migrar(hoja)
    indices = _indices(hoja)
    col_id = indices["ID"]
    siguiente = max(
        (
            f[col_id - 1]
            for f in hoja.iter_rows(min_row=2, values_only=True)
            if isinstance(f[col_id - 1], int)
        ),
        default=0,
    )
    ahora = datetime.now()
    for t in tareas:
        siguiente += 1
        archivos = t.get("archivos", "")
        if isinstance(archivos, list):
            archivos = ", ".join(archivos)
        valores = {
            "ID": siguiente,
            "Fecha": t.get("fecha") or ahora.strftime("%Y-%m-%d"),
            "Hora": t.get("hora") or ahora.strftime("%H:%M"),
            "Solicitud": t["solicitud"],
            "Tarea": t["tarea"],
            "Descripción": t.get("descripcion", ""),
            "Agente": t.get("agente", ""),
            "IA": t.get("ia", ""),
            "Duración (min)": t.get("minutos"),
            COL_TOKENS: t.get("tokens"),
            "Estado": t.get("estado", "Completada"),
            "Archivos": archivos,
        }
        fila = hoja.max_row + 1
        for nombre, valor in valores.items():
            col = indices.get(nombre)
            if col is None:
                continue
            celda = hoja.cell(row=fila, column=col, value=valor)
            celda.alignment = Alignment(wrap_text=True, vertical="top")
    libro.save(RUTA)
    return len(tareas)


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    origen = sys.stdin.read() if sys.argv[1] == "-" else Path(sys.argv[1]).read_text("utf-8")
    datos = json.loads(origen)
    tareas = datos if isinstance(datos, list) else [datos]
    print(f"{registrar(tareas)} tarea(s) registradas en {RUTA}")


if __name__ == "__main__":
    main()

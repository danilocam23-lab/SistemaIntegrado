"""Test de `/api/estimaciones/upload/{id}` (ADR-0008 F3, P4).

`upload_estimacion` movió el parseo síncrono de `openpyxl` a un hilo
(`asyncio.to_thread`, ver `_leer_filas_excel`); este test construye un .xlsx
real en memoria y confirma que la carga sigue funcionando de punta a punta.
"""
import base64
from io import BytesIO

from openpyxl import Workbook

from tests.conftest import headers_con_token


def _xlsx_estimacion_base64() -> str:
    libro = Workbook()
    hoja = libro.active
    hoja.append(["Mi estimación"])
    hoja.append([None, "Cliente Uno"])
    hoja.append([None, "Iniciativa Uno"])
    hoja.append([None, "2025-01-01"])
    hoja.append([])
    hoja.append([])
    hoja.append(
        [
            "No.", "Epica", "Historia", "Tipo", "Sprint", "IdEpm", "IdHitss",
            "Actividad", "Complejidad", "HorasEst", "Mejor", "Peor", "Promedio",
            "Metodologia10", "HorasTotales",
        ]
    )
    hoja.append(
        [1, "E1", "H1", "Tarea", 1, "E-1", "H-1", "Actividad 1", "Baja", 5, 4, 6, 5, 5, 5]
    )
    salida = BytesIO()
    libro.save(salida)
    return base64.b64encode(salida.getvalue()).decode()


async def test_upload_estimacion_procesa_el_excel_en_un_hilo(
    cliente, fabrica_usuario, fabrica_aplicacion
):
    app = await fabrica_aplicacion()
    _, token = await fabrica_usuario([app.codigo], permisos=["requerimientos.editar"])

    resp = await cliente.post(
        "/api/estimaciones/upload/req-1",
        json={"file_base64": _xlsx_estimacion_base64(), "file_name": "estimacion.xlsx"},
        headers=headers_con_token(token, app.codigo),
    )
    assert resp.status_code == 201
    datos = resp.json()
    assert datos["titulo"] == "Mi estimación"
    assert len(datos["filas"]) == 1
    assert datos["filas"][0]["actividad"] == "Actividad 1"


async def test_upload_estimacion_archivo_sin_filas_validas_da_400(
    cliente, fabrica_usuario, fabrica_aplicacion
):
    app = await fabrica_aplicacion()
    _, token = await fabrica_usuario([app.codigo], permisos=["requerimientos.editar"])

    libro = Workbook()
    salida = BytesIO()
    libro.save(salida)
    vacio_base64 = base64.b64encode(salida.getvalue()).decode()

    resp = await cliente.post(
        "/api/estimaciones/upload/req-2",
        json={"file_base64": vacio_base64},
        headers=headers_con_token(token, app.codigo),
    )
    assert resp.status_code == 400

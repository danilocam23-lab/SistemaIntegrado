# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""El importador de Excel guarda ``solicitud.squad_id`` = código de la aplicación
(squad == aplicación), nunca el ``_id`` de un documento Squad ni ``None``."""
from io import BytesIO

import openpyxl
import pytest

from app.documents.requerimiento import Requerimiento
from app.documents.squad import Squad
from app.importer.excel_importer import ImportadorExcel

CABECERAS = [
    "COD. DEL REQ", "CODIGO DE SOLICITUD DE COTIZACION", "ESTADO DE REQUERIMIENTOS", "Squad",
]


def _libro(filas: list[list]) -> bytes:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Hoja1"
    ws.append(CABECERAS)
    for fila in filas:
        ws.append(fila)
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


@pytest.mark.parametrize("squad_excel", ["Squad Azul", None])
async def test_importador_guarda_codigo_de_aplicacion_como_squad_id(
    fabrica_aplicacion, squad_excel
):
    app = await fabrica_aplicacion()
    contenido = _libro(
        [["REQ-IMP-1", "SC-IMP-1", "ESTIMACION EN CURSO POR HITSS", squad_excel]]
    )
    resultado = await ImportadorExcel(app.codigo, contenido).ejecutar()
    assert resultado.requerimientos_creados == 1, resultado.errores

    req = await Requerimiento.find_one({"aplicacion_id": app.codigo, "codigo_req": "REQ-IMP-1"})
    assert req is not None
    assert req.solicitud.squad_id == app.codigo
    if squad_excel:
        # El alta del documento Squad se conserva, pero la solicitud no guarda su id.
        doc = await Squad.find_one({"aplicacion_id": app.codigo, "nombre": squad_excel})
        assert doc is not None
        assert req.solicitud.squad_id != str(doc.id)


async def test_importador_reimportar_corrige_squad_id_antiguo(fabrica_aplicacion):
    app = await fabrica_aplicacion()
    contenido = _libro([["REQ-IMP-2", "SC-IMP-2", "ESTIMACION EN CURSO POR HITSS", "Otro"]])
    await ImportadorExcel(app.codigo, contenido).ejecutar()
    req = await Requerimiento.find_one({"aplicacion_id": app.codigo, "codigo_req": "REQ-IMP-2"})
    assert req is not None
    req.solicitud.squad_id = "64b000000000000000000000"  # valor heredado (id de Squad)
    await req.save()

    await ImportadorExcel(app.codigo, contenido).ejecutar()
    req = await Requerimiento.get(req.id)
    assert req.solicitud.squad_id == app.codigo

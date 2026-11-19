# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""La conexión a Azure DevOps sale solo de ``azdo_config`` (nunca de ``configuracion``).

Cubre la resolución usuario > squad > app en ``crear_servicio_azdo`` /
``leer_config_azdo``, el aislamiento por aplicación, que las claves legacy ya no se
leen, el uso de la config del usuario en ``estimaciones`` y el script
``scripts/limpiar_config_azdo_legacy.py``.
"""
import importlib.util
import json
from pathlib import Path

import pytest
from pymongo import MongoClient

from app.config import get_settings
from app.documents.azdo_config import AzdoConfig
from app.documents.configuracion import Configuracion
from app.documents.estimacion import Estimacion
from app.documents.persona import Persona
from app.services.azdo_sync import crear_servicio_azdo, leer_config_azdo
from app.services.azure_devops import AzureDevOpsService
from tests.conftest import headers_con_token


async def _cfg(app_id, scope="app", org="https://dev.azure.com/o", pat="pat", **kw):
    return await AzdoConfig(
        aplicacion_id=app_id, scope=scope, org_url=org, pat=pat, **kw
    ).insert()


async def test_jerarquia_usuario_squad_app(fabrica_aplicacion):
    app = await fabrica_aplicacion()
    await _cfg(app.codigo, "app", "https://x/app", "pat-app", default_project="PApp")
    await _cfg(app.codigo, "squad", "https://x/squad", "pat-squad", squad_id="sq1")
    await _cfg(app.codigo, "user", "https://x/user", "pat-user", usuario_id="u1")

    svc = await crear_servicio_azdo(app.codigo, "azdo_", usuario_id="u1", squad_id="sq1")
    assert (svc.org_url, svc.pat) == ("https://x/user", "pat-user")
    svc = await crear_servicio_azdo(app.codigo, "azdo_", usuario_id="otro", squad_id="sq1")
    assert svc.org_url == "https://x/squad"
    svc = await crear_servicio_azdo(app.codigo, "azdo_", usuario_id="otro")
    assert svc.org_url == "https://x/app"
    assert await leer_config_azdo(app.codigo, "azdo_default_project") == "PApp"


async def test_target_epm_usa_scopes_epm(fabrica_aplicacion):
    app = await fabrica_aplicacion()
    await _cfg(app.codigo, "app", "https://x/hitss", "p1")
    await _cfg(app.codigo, "app_epm", "https://x/epm", "p2")
    assert (await crear_servicio_azdo(app.codigo, "azdo2_")).org_url == "https://x/epm"
    assert (await crear_servicio_azdo(app.codigo, "azdo_")).org_url == "https://x/hitss"


async def test_sin_config_lanza_value_error_aunque_exista_legacy(fabrica_aplicacion):
    app = await fabrica_aplicacion()
    for clave, valor in [
        ("azdo_org_url", "https://legacy"),
        ("azdo_pat", "legacy-pat"),
        ("azdo_default_project", "Legacy"),
    ]:
        await Configuracion(aplicacion_id=app.codigo, clave=clave, valor=valor).insert()

    with pytest.raises(ValueError, match="vista Azure DevOps"):
        await crear_servicio_azdo(app.codigo, "azdo_")
    assert await leer_config_azdo(app.codigo, "azdo_default_project") == ""
    assert await leer_config_azdo(app.codigo, "azdo_org_url", "def") == "def"


async def test_config_sin_pat_lanza_value_error(fabrica_aplicacion):
    app = await fabrica_aplicacion()
    await _cfg(app.codigo, "app", "https://x/app", "")
    with pytest.raises(ValueError):
        await crear_servicio_azdo(app.codigo)


async def test_aislamiento_por_aplicacion(fabrica_aplicacion):
    a = await fabrica_aplicacion()
    b = await fabrica_aplicacion()
    await _cfg(a.codigo, "app", "https://x/a", "pa")
    await _cfg(b.codigo, "user", "https://x/b-user", "pb", usuario_id="u1")

    assert (await crear_servicio_azdo(a.codigo)).org_url == "https://x/a"
    # la config de usuario de B no se ve desde A, ni siquiera con el mismo usuario_id
    assert (await crear_servicio_azdo(a.codigo, usuario_id="u1")).org_url == "https://x/a"
    with pytest.raises(ValueError):
        await crear_servicio_azdo(b.codigo)


async def test_estimaciones_usa_config_del_usuario(
    cliente, fabrica_usuario, fabrica_aplicacion, monkeypatch
):
    app = await fabrica_aplicacion()
    usuario, token = await fabrica_usuario([app.codigo], permisos=["requerimientos.editar"])
    persona = await Persona(
        aplicacion_id=app.codigo,
        nombre="P",
        email=usuario.email,
        usuario_id=str(usuario.id),
        activo=True,
    ).insert()
    await _cfg(app.codigo, "app", "https://x/app", "pat-app", default_project="PApp")
    await _cfg(
        app.codigo, "user", "https://x/user", "pat-user",
        usuario_id=str(persona.id), default_project="PUser",
    )
    est = await Estimacion(aplicacion_id=app.codigo, iniciativa="I").insert()
    vistos: list[tuple[str, str, str]] = []

    async def _tipos(self, proyecto):
        vistos.append((self.org_url, self.pat, proyecto))
        return {"feature": "Feature", "userStory": "User Story", "task": "Task"}

    monkeypatch.setattr(AzureDevOpsService, "obtener_tipos_work_item", _tipos)
    resp = await cliente.post(
        f"/api/estimaciones/{est.id}/crear-tareas-hitss",
        headers=headers_con_token(token, app.codigo),
    )
    assert resp.status_code == 200, resp.text
    assert vistos == [("https://x/user", "pat-user", "PUser")]


async def test_estimaciones_sin_config_da_400_aunque_haya_legacy(
    cliente, fabrica_usuario, fabrica_aplicacion
):
    app = await fabrica_aplicacion()
    _, token = await fabrica_usuario([app.codigo], permisos=["requerimientos.editar"])
    await Configuracion(aplicacion_id=app.codigo, clave="azdo_org_url", valor="https://l").insert()
    await Configuracion(aplicacion_id=app.codigo, clave="azdo_pat", valor="p").insert()
    est = await Estimacion(aplicacion_id=app.codigo, iniciativa="I").insert()
    resp = await cliente.post(
        f"/api/estimaciones/{est.id}/crear-tareas-epm",
        headers=headers_con_token(token, app.codigo),
    )
    assert resp.status_code == 400
    assert "vista Azure DevOps" in resp.text


# ── Script de limpieza ──

def _cargar_script():
    ruta = Path(__file__).resolve().parents[2] / "scripts" / "limpiar_config_azdo_legacy.py"
    spec = importlib.util.spec_from_file_location("limpiar_config_azdo_legacy", ruta)
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return modulo


@pytest.fixture
def db_sync():
    settings = get_settings()
    cliente = MongoClient(settings.mongo_url)
    yield cliente[settings.mongo_db]
    cliente.close()


async def _legacy(app_id, **claves):
    for clave, valor in claves.items():
        await Configuracion(aplicacion_id=app_id, clave=clave, valor=valor).insert()


async def test_script_dry_run_no_modifica(fabrica_aplicacion, db_sync):
    script = _cargar_script()
    app = await fabrica_aplicacion()
    await _legacy(
        app.codigo, azdo_org_url="https://l", azdo_pat="secreto", azdo_sync_interval="manual"
    )

    resumen = script.limpiar(db_sync, aplicar=False, aplicacion=app.codigo)

    assert resumen["aplicado"] is False and resumen["respaldo"] is None
    assert len(resumen["migrados"]) == 1
    assert db_sync["configuracion"].count_documents({"aplicacion_id": app.codigo}) == 3
    assert db_sync["azdo_config"].count_documents({"aplicacion_id": app.codigo}) == 0


def test_script_aplicar_exige_respaldo(db_sync):
    script = _cargar_script()
    with pytest.raises(ValueError):
        script.limpiar(db_sync, aplicar=True)


async def test_script_migra_respalda_y_borra_solo_claves_listadas(
    fabrica_aplicacion, db_sync, tmp_path
):
    script = _cargar_script()
    sin_cfg = await fabrica_aplicacion()
    con_cfg = await fabrica_aplicacion()
    await _legacy(
        sin_cfg.codigo,
        azdo_org_url="https://l", azdo_pat="secreto", azdo_default_project="P",
        azdo2_org_url="https://e", azdo2_pat="secreto2", azdo2_sync_interval="manual",
        registros_por_pagina="50",
    )
    await _legacy(con_cfg.codigo, azdo_org_url="https://l2", azdo_pat="otro")
    await _cfg(con_cfg.codigo, "app", "https://ya/existe", "pat-ya")

    resumen = script.limpiar(db_sync, aplicar=True, respaldo=tmp_path, aplicacion=sin_cfg.codigo)
    script.limpiar(db_sync, aplicar=True, respaldo=tmp_path, aplicacion=con_cfg.codigo)

    hitss = db_sync["azdo_config"].find_one({"aplicacion_id": sin_cfg.codigo, "scope": "app"})
    epm = db_sync["azdo_config"].find_one({"aplicacion_id": sin_cfg.codigo, "scope": "app_epm"})
    assert (hitss["org_url"], hitss["pat"], hitss["default_project"]) == (
        "https://l", "secreto", "P",
    )
    assert (epm["org_url"], epm["pat"]) == ("https://e", "secreto2")
    assert hitss["squad_id"] is None and hitss["usuario_id"] is None
    # la config existente no se pisa
    ya = db_sync["azdo_config"].find_one({"aplicacion_id": con_cfg.codigo, "scope": "app"})
    assert ya["org_url"] == "https://ya/existe"
    # solo quedan las claves no listadas
    restantes = {
        d["clave"] for d in db_sync["configuracion"].find({"aplicacion_id": sin_cfg.codigo})
    }
    assert restantes == {"registros_por_pagina"}
    assert db_sync["configuracion"].count_documents({"aplicacion_id": con_cfg.codigo}) == 0
    # respaldo con los documentos borrados; el resumen no expone el PAT
    assert resumen["respaldo"] and "secreto" not in json.dumps(resumen)
    respaldo = json.loads(Path(resumen["respaldo"]).read_text(encoding="utf-8"))
    assert {d["clave"] for d in respaldo} >= {"azdo_pat", "azdo2_pat", "azdo_default_project"}

    # idempotente
    otra = script.limpiar(db_sync, aplicar=True, respaldo=tmp_path, aplicacion=sin_cfg.codigo)
    assert otra["migrados"] == [] and otra["borrados"] == {} and otra["respaldo"] is None

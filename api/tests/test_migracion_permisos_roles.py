# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Migración de arranque: concede ``personas.ver_valores`` a roles de sistema existentes."""
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.bootstrap import migrar_permisos_roles_base
from app.documents.rol import Rol
from app.security.rbac import PERMISOS_CATALOGO, ROLES_BASE

PERMISO = "personas.ver_valores"


async def _rol(clave: str) -> Rol:
    rol = await Rol.find_one(Rol.clave == clave)
    assert rol is not None
    return rol


async def test_rol_base_existente_sin_el_permiso_lo_recibe_sin_alterar_el_resto():
    rol = await _rol("viewer")
    rol.permisos = [p for p in rol.permisos if p != PERMISO]
    await rol.save()
    antes = list(rol.permisos)

    assert await migrar_permisos_roles_base() == 1

    rol = await _rol("viewer")
    assert rol.permisos == [*antes, PERMISO]


async def test_es_idempotente_si_ya_lo_tiene():
    await migrar_permisos_roles_base()
    antes = (await _rol("admin_app")).permisos
    assert await migrar_permisos_roles_base() == 0
    assert (await _rol("admin_app")).permisos == antes


async def test_no_toca_rol_personalizado_ni_superadmin():
    custom = await Rol(
        clave=f"custom-{uuid.uuid4().hex[:6]}",
        nombre="Personalizado",
        descripcion="",
        es_sistema=False,
        permisos=["dashboard.ver"],
    ).insert()
    superadmin_antes = (await _rol("superadmin")).permisos

    await migrar_permisos_roles_base()

    assert (await Rol.get(custom.id)).permisos == ["dashboard.ver"]  # type: ignore[union-attr]
    assert (await _rol("superadmin")).permisos == superadmin_antes == ["*"]
    await custom.delete()


async def test_migracion_horas_anade_solo_dos_permisos_y_es_idempotente(monkeypatch):
    ver = "requerimientos.horas_siguiente_anio.ver"
    editar = "requerimientos.horas_siguiente_anio.editar"
    anteriores = [
        "concesion.sintetica", "personas.ver_valores",
        "requerimientos.analista.editar", "asignaciones.editar",
    ]
    admin = SimpleNamespace(
        clave="admin_app", es_sistema=True, permisos=list(anteriores),
        marcar_actualizado=lambda: None, save=AsyncMock(),
    )
    viewer = SimpleNamespace(
        clave="viewer", es_sistema=True, permisos=["personas.ver_valores"], save=AsyncMock(),
    )
    personalizado = SimpleNamespace(permisos=["requerimientos.editar"])
    superadmin = SimpleNamespace(permisos=["*"])

    async def buscar(consulta):
        return {"admin_app": admin, "viewer": viewer}.get(consulta["clave"])

    buscar_mock = AsyncMock(side_effect=buscar)
    monkeypatch.setattr(Rol, "find_one", buscar_mock)
    assert await migrar_permisos_roles_base() == 1
    assert admin.permisos == [*anteriores, ver, editar]
    assert await migrar_permisos_roles_base() == 0
    admin.save.assert_awaited_once()
    viewer.save.assert_not_awaited()
    assert personalizado.permisos == ["requerimientos.editar"]
    assert superadmin.permisos == ["*"]
    assert {llamada.args[0]["clave"] for llamada in buscar_mock.await_args_list} == {
        "admin_app", "viewer",
    }


@pytest.mark.parametrize("es_sistema", [False, True])
async def test_migracion_horas_respeta_roles_personalizados_y_concesiones(
    monkeypatch, es_sistema,
):
    permisos = ["concesion.sintetica"]
    rol = SimpleNamespace(
        clave="admin_app", es_sistema=es_sistema, permisos=list(permisos),
        marcar_actualizado=lambda: None, save=AsyncMock(),
    )

    async def buscar(consulta):
        return rol if consulta["clave"] == "admin_app" else None

    monkeypatch.setattr(Rol, "find_one", AsyncMock(side_effect=buscar))
    await migrar_permisos_roles_base()
    if es_sistema:
        assert rol.permisos[0] == permisos[0]
        assert "requerimientos.horas_siguiente_anio.ver" in rol.permisos
        assert "requerimientos.horas_siguiente_anio.editar" in rol.permisos
        assert "requerimientos.editar" not in rol.permisos
    else:
        assert rol.permisos == permisos
        rol.save.assert_not_awaited()


def test_catalogo_y_roles_base_horas_siguiente_anio():
    especiales = {
        "requerimientos.horas_siguiente_anio.ver",
        "requerimientos.horas_siguiente_anio.editar",
    }
    assert especiales <= set(PERMISOS_CATALOGO)
    roles = {rol["clave"]: rol["permisos"] for rol in ROLES_BASE}
    assert especiales <= set(roles["admin_app"])
    assert "requerimientos.editar" not in roles["admin_app"]
    assert especiales.isdisjoint(roles["viewer"])
    assert roles["superadmin"] == ["*"]

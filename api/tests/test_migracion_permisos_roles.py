# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Migración de arranque: concede ``personas.ver_valores`` a roles de sistema existentes."""
import uuid

from app.bootstrap import migrar_permisos_roles_base
from app.documents.rol import Rol

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

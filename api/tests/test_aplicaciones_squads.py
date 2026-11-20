# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Reglas de squads: último activo, squads inactivos, código/nombre y admin_app sin squads."""
import uuid

import pytest

from app.documents.aplicacion import Aplicacion
from app.middleware.aplicacion import codigos_autorizados
from tests.conftest import headers_con_token

RUTA = "/api/aplicaciones"


@pytest.fixture
async def solo_un_squad_activo(fabrica_aplicacion, monkeypatch):
    """Simula que el squad nuevo es el único activo sin tocar los datos de la BD compartida.

    Se sustituye la consulta que cuenta los demás squads activos; ningún otro squad se
    desactiva (el resto de la suite comparte la base).
    """
    async def sin_otros_activos(codigo: str) -> int:
        return 0

    monkeypatch.setattr("app.api.aplicaciones._contar_otros_activos", sin_otros_activos)
    return await fabrica_aplicacion()


async def test_no_desactiva_ultimo_squad_activo(cliente, fabrica_usuario, solo_un_squad_activo):
    _, token = await fabrica_usuario([], permisos=["aplicaciones.editar"])
    resp = await cliente.patch(
        f"{RUTA}/{solo_un_squad_activo.codigo}/estado",
        json={"activa": False},
        headers=headers_con_token(token),
    )
    assert resp.status_code == 409
    assert "último squad activo" in resp.json()["detail"]
    app = await Aplicacion.find_one(Aplicacion.codigo == solo_un_squad_activo.codigo)
    assert app is not None and app.activa is True


async def test_desactiva_squad_si_hay_otro_activo(cliente, fabrica_usuario, fabrica_aplicacion):
    a = await fabrica_aplicacion()
    await fabrica_aplicacion()
    _, token = await fabrica_usuario([], permisos=["aplicaciones.editar"])
    resp = await cliente.patch(
        f"{RUTA}/{a.codigo}/estado", json={"activa": False}, headers=headers_con_token(token)
    )
    assert resp.status_code == 200
    assert resp.json()["activa"] is False


async def test_squad_inactivo_da_403_claro(cliente, fabrica_usuario, fabrica_aplicacion):
    app = await fabrica_aplicacion()
    app.activa = False
    await app.save()
    usuario, token = await fabrica_usuario([app.codigo], permisos=["*"])
    assert app.codigo not in await codigos_autorizados(usuario)
    resp = await cliente.get("/api/personas", headers=headers_con_token(token, app.codigo))
    assert resp.status_code == 403
    assert resp.json()["detail"] == "El squad está inactivo"


async def test_superadmin_solo_autorizado_en_squads_activos(
    cliente, fabrica_aplicacion, superadmin_token
):
    from app.documents.enums import RolUsuario
    from app.documents.usuario import Usuario

    app = await fabrica_aplicacion()
    app.activa = False
    await app.save()
    superadmin = await Usuario.find_one(Usuario.rol == RolUsuario.SUPERADMIN)
    assert superadmin is not None
    assert app.codigo not in await codigos_autorizados(superadmin)
    h = headers_con_token(superadmin_token)
    resp = await cliente.get(f"{RUTA}?incluir_inactivas=false", headers=h)
    codigos = [x["codigo"] for x in resp.json()]
    assert app.codigo not in codigos
    resp = await cliente.get(RUTA, headers=h)
    assert app.codigo in [x["codigo"] for x in resp.json()]


@pytest.mark.parametrize(
    "codigo", ["__todas__", "__algo", "A", "-malo", "con espacio", "x" * 33, "ñandú"]
)
async def test_codigo_invalido_da_422(cliente, fabrica_usuario, codigo):
    _, token = await fabrica_usuario([], permisos=["aplicaciones.crear"])
    resp = await cliente.post(
        RUTA, json={"codigo": codigo, "nombre": f"N {uuid.uuid4().hex}"},
        headers=headers_con_token(token),
    )
    assert resp.status_code == 422, codigo


async def test_codigo_se_normaliza(cliente, fabrica_usuario):
    _, token = await fabrica_usuario([], permisos=["aplicaciones.crear"])
    sufijo = uuid.uuid4().hex[:8]
    resp = await cliente.post(
        RUTA, json={"codigo": f"  Sq-{sufijo} ", "nombre": f"Nombre {sufijo}"},
        headers=headers_con_token(token),
    )
    assert resp.status_code == 201
    assert resp.json()["codigo"] == f"sq-{sufijo}"


async def test_nombre_unico_insensible_a_mayusculas(cliente, fabrica_usuario, fabrica_aplicacion):
    existente = await fabrica_aplicacion(nombre=f"Squad Único {uuid.uuid4().hex[:6]}")
    _, token = await fabrica_usuario([], permisos=["aplicaciones.crear", "aplicaciones.editar"])
    h = headers_con_token(token)
    resp = await cliente.post(
        RUTA, json={"codigo": f"n-{uuid.uuid4().hex[:8]}", "nombre": existente.nombre.upper()},
        headers=h,
    )
    assert resp.status_code == 409
    otra = await fabrica_aplicacion()
    resp = await cliente.put(
        f"{RUTA}/{otra.codigo}", json={"nombre": existente.nombre.lower()}, headers=h
    )
    assert resp.status_code == 409
    # Renombrarse a sí mismo (cambiando solo mayúsculas) sí está permitido.
    resp = await cliente.put(
        f"{RUTA}/{existente.codigo}", json={"nombre": existente.nombre.upper()}, headers=h
    )
    assert resp.status_code == 200


async def test_admin_app_sin_squads_no_es_global(cliente, fabrica_usuario, fabrica_aplicacion):
    await fabrica_aplicacion()
    admin, token = await fabrica_usuario([], permisos=["*"], rol="admin_app")
    assert await codigos_autorizados(admin) == []
    resp = await cliente.get(RUTA, headers=headers_con_token(token))
    assert resp.status_code == 200
    assert resp.json() == []


async def test_admin_app_con_squads_ve_solo_los_suyos(cliente, fabrica_usuario, fabrica_aplicacion):
    mia = await fabrica_aplicacion()
    await fabrica_aplicacion()
    admin, token = await fabrica_usuario([mia.codigo], permisos=["*"], rol="admin_app")
    assert await codigos_autorizados(admin) == [mia.codigo]
    resp = await cliente.get(RUTA, headers=headers_con_token(token))
    assert [x["codigo"] for x in resp.json()] == [mia.codigo]


async def test_admin_app_sin_squads_no_lista_usuarios(cliente, fabrica_usuario, fabrica_aplicacion):
    app = await fabrica_aplicacion()
    await fabrica_usuario([app.codigo])
    _, token = await fabrica_usuario([], permisos=["admin.usuarios.ver"], rol="admin_app")
    resp = await cliente.get("/api/usuarios", headers=headers_con_token(token))
    assert resp.status_code == 200
    assert resp.json() == []


# --- Modo consolidado y escritura con squad inactivo -------------------------------------


async def test_consolidado_exige_permiso_o_mas_de_un_squad(
    cliente, fabrica_usuario, fabrica_aplicacion
):
    a, b = await fabrica_aplicacion(), await fabrica_aplicacion()
    url = "/api/personas"

    _, solo_uno = await fabrica_usuario([a.codigo], permisos=["personas.ver"])
    resp = await cliente.get(url, headers=headers_con_token(solo_uno, "__todas__"))
    assert resp.status_code == 403
    assert "más de un squad" in resp.json()["detail"]

    # Con permiso explícito de consolidado basta con un squad.
    _, con_permiso = await fabrica_usuario([a.codigo], permisos=["personas.ver", "consolidado.ver"])
    resp = await cliente.get(url, headers=headers_con_token(con_permiso, "__todas__"))
    assert resp.status_code == 200

    # Con más de un squad asignado, también.
    _, dos = await fabrica_usuario([a.codigo, b.codigo], permisos=["personas.ver"])
    resp = await cliente.get(url, headers=headers_con_token(dos, "__todas__"))
    assert resp.status_code == 200


async def test_escritura_con_squad_inactivo_da_403(cliente, fabrica_usuario, fabrica_aplicacion):
    app = await fabrica_aplicacion()
    _, token = await fabrica_usuario([app.codigo], permisos=["requerimientos.crear"])
    app.activa = False
    await app.save()
    resp = await cliente.post(
        "/api/requerimientos",
        json={
            "codigo_req": "REQ-INACT",
            "solicitud": {"codigo_sc": "SC-1"},
            "estado": "ESTIMACION EN CURSO POR HITSS",
        },
        headers=headers_con_token(token, app.codigo),
    )
    assert resp.status_code == 403
    assert resp.json()["detail"] == "El squad está inactivo"

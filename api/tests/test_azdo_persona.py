# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Tests de Azure DevOps ligados a la Persona del usuario autenticado.

Cubren la resolución de config de scope ``user`` sin ``usuario_id`` explícito,
el endpoint ``/azdo/personas-config`` (alcance por usuario vs. superadmin), la
validación de propiedad al guardar y que el proyecto por defecto del esquema
sale de ``cfg.default_project`` y no del documento legacy ``Configuracion``.
"""
from app.documents.azdo_config import AzdoConfig
from app.documents.configuracion import Configuracion
from app.documents.persona import Persona
from app.services.azure_devops import AzureDevOpsService
from tests.conftest import headers_con_token


async def _persona_de(usuario, app, nombre="Persona Test") -> Persona:
    return await Persona(
        aplicacion_id=app.codigo,
        nombre=nombre,
        email=usuario.email,
        usuario_id=str(usuario.id),
        activo=True,
    ).insert()


def _parchear_red(monkeypatch) -> None:
    async def _tipos_proceso(self, proyecto):
        return []

    async def _jerarquia(self, proyecto):
        return []

    async def _tipos_work_item(self, proyecto):
        return {}

    monkeypatch.setattr(AzureDevOpsService, "obtener_tipos_proceso", _tipos_proceso)
    monkeypatch.setattr(AzureDevOpsService, "obtener_jerarquia_backlog", _jerarquia)
    # Con `jerarquia`/`tipos_proceso` vacíos, `esquema_tipos` cae en el cálculo
    # por defecto de `activos` (_tipos_esquema_por_defecto), que también
    # consulta los tipos de work item; se mockea para no golpear la red real.
    monkeypatch.setattr(AzureDevOpsService, "obtener_tipos_work_item", _tipos_work_item)


async def test_proyectos_resuelve_config_user_sin_usuario_id(
    cliente, fabrica_usuario, fabrica_aplicacion, monkeypatch
):
    app = await fabrica_aplicacion()
    usuario, token = await fabrica_usuario([app.codigo], permisos=["azure_devops.ver"])
    persona = await _persona_de(usuario, app)
    await AzdoConfig(
        aplicacion_id=app.codigo,
        scope="user",
        usuario_id=str(persona.id),
        org_url="https://dev.azure.com/user-scope",
        pat="pat-user",
        default_project="Proyecto Usuario",
    ).insert()

    async def _obtener_proyectos(self):
        return [{"nombre": "Proyecto Usuario"}]

    monkeypatch.setattr(AzureDevOpsService, "obtener_proyectos", _obtener_proyectos)

    resp = await cliente.get(
        "/api/azdo/proyectos",
        headers=headers_con_token(token, app.codigo),
    )

    assert resp.status_code == 200
    assert resp.json() == [{"nombre": "Proyecto Usuario"}]


async def test_esquema_tipos_resuelve_config_user_sin_usuario_id(
    cliente, fabrica_usuario, fabrica_aplicacion, monkeypatch
):
    app = await fabrica_aplicacion()
    usuario, token = await fabrica_usuario([app.codigo], permisos=["azure_devops.ver"])
    persona = await _persona_de(usuario, app)
    await AzdoConfig(
        aplicacion_id=app.codigo,
        scope="user",
        usuario_id=str(persona.id),
        org_url="https://dev.azure.com/user-scope",
        pat="pat-user",
        default_project="Proyecto Usuario",
    ).insert()
    _parchear_red(monkeypatch)

    resp = await cliente.get(
        "/api/azdo/esquema/tipos",
        headers=headers_con_token(token, app.codigo),
    )

    assert resp.status_code == 200
    assert resp.json()["proyecto"] == "Proyecto Usuario"


async def test_esquema_tipos_incluye_activos_configurados(
    cliente, fabrica_usuario, fabrica_aplicacion, monkeypatch
):
    app = await fabrica_aplicacion()
    usuario, token = await fabrica_usuario([app.codigo], permisos=["azure_devops.ver"])
    persona = await _persona_de(usuario, app)
    await AzdoConfig(
        aplicacion_id=app.codigo,
        scope="user",
        usuario_id=str(persona.id),
        org_url="https://dev.azure.com/user-scope",
        pat="pat-user",
        default_project="Proyecto Usuario",
        tipos_esquema_activos=["Contextualización", "Epic", "Feature"],
    ).insert()
    _parchear_red(monkeypatch)

    resp = await cliente.get(
        "/api/azdo/esquema/tipos",
        headers=headers_con_token(token, app.codigo),
    )

    assert resp.status_code == 200
    assert resp.json()["activos"] == ["Contextualización", "Epic", "Feature"]


async def test_personas_config_usuario_normal_solo_se_ve_a_si_mismo(
    cliente, fabrica_usuario, fabrica_aplicacion
):
    app = await fabrica_aplicacion()
    usuario, token = await fabrica_usuario([app.codigo], permisos=["azure_devops.ver"])
    persona = await _persona_de(usuario, app)
    # Otra persona activa que NO debe aparecer para un usuario normal.
    await Persona(aplicacion_id=app.codigo, nombre="Otra", email="otra@x.com", activo=True).insert()

    resp = await cliente.get(
        "/api/azdo/personas-config",
        headers=headers_con_token(token, app.codigo),
    )

    assert resp.status_code == 200
    datos = resp.json()
    assert datos["puede_elegir_cualquiera"] is False
    assert datos["persona_propia_id"] == str(persona.id)
    assert len(datos["personas"]) == 1
    assert datos["personas"][0]["id"] == str(persona.id)


async def test_personas_config_superadmin_ve_todas(
    cliente, superadmin_token, fabrica_aplicacion
):
    app = await fabrica_aplicacion()
    p1 = await Persona(
        aplicacion_id=app.codigo, nombre="AAA", email="a@x.com", activo=True
    ).insert()
    p2 = await Persona(
        aplicacion_id=app.codigo, nombre="BBB", email="b@x.com", activo=True
    ).insert()

    resp = await cliente.get(
        "/api/azdo/personas-config",
        headers=headers_con_token(superadmin_token, app.codigo),
    )

    assert resp.status_code == 200
    datos = resp.json()
    assert datos["puede_elegir_cualquiera"] is True
    ids = {p["id"] for p in datos["personas"]}
    assert {str(p1.id), str(p2.id)}.issubset(ids)


async def test_personas_config_superadmin_operativo_aisla_por_aplicacion(
    cliente, superadmin_token, fabrica_aplicacion
):
    app_a = await fabrica_aplicacion()
    app_b = await fabrica_aplicacion()
    p_a = await Persona(
        aplicacion_id=app_a.codigo, nombre="EnA", email="ena@x.com", activo=True
    ).insert()
    p_b = await Persona(
        aplicacion_id=app_b.codigo, nombre="EnB", email="enb@x.com", activo=True
    ).insert()

    resp = await cliente.get(
        "/api/azdo/personas-config",
        headers=headers_con_token(superadmin_token, app_a.codigo),
    )

    assert resp.status_code == 200
    datos = resp.json()
    assert datos["puede_elegir_cualquiera"] is True
    ids = {p["id"] for p in datos["personas"]}
    assert str(p_a.id) in ids
    assert str(p_b.id) not in ids


async def test_guardar_config_de_otra_persona_devuelve_403(
    cliente, fabrica_usuario, fabrica_aplicacion
):
    app = await fabrica_aplicacion()
    usuario, token = await fabrica_usuario([app.codigo], permisos=["azure_devops.editar"])
    await _persona_de(usuario, app)
    otra = await Persona(
        aplicacion_id=app.codigo, nombre="Ajena", email="ajena@x.com", activo=True
    ).insert()

    resp = await cliente.put(
        "/api/azdo/config",
        json={
            "org_url": "https://dev.azure.com/hack",
            "pat": "pat-ajeno",
            "default_project": "X",
            "usuario_id": str(otra.id),
            "target": "hitss",
        },
        headers=headers_con_token(token, app.codigo),
    )

    assert resp.status_code == 403


async def test_proyecto_esquema_sale_de_config_no_del_legacy(
    cliente, fabrica_usuario, fabrica_aplicacion, monkeypatch
):
    app = await fabrica_aplicacion()
    usuario, token = await fabrica_usuario([app.codigo], permisos=["azure_devops.ver"])
    persona = await _persona_de(usuario, app)
    await AzdoConfig(
        aplicacion_id=app.codigo,
        scope="user",
        usuario_id=str(persona.id),
        org_url="https://dev.azure.com/real",
        pat="pat-real",
        default_project="ProyectoReal",
    ).insert()
    # Legacy con un valor distinto que NO debe usarse.
    await Configuracion(
        aplicacion_id=app.codigo,
        clave="azdo_default_project",
        valor="ProyectoLegacy",
    ).insert()
    _parchear_red(monkeypatch)

    resp = await cliente.get(
        "/api/azdo/esquema/tipos",
        headers=headers_con_token(token, app.codigo),
    )

    assert resp.status_code == 200
    assert resp.json()["proyecto"] == "ProyectoReal"


async def test_esquema_arbol_con_usuario_id_ajeno_devuelve_403(
    cliente, fabrica_usuario, fabrica_aplicacion, monkeypatch
):
    app = await fabrica_aplicacion()
    usuario, token = await fabrica_usuario([app.codigo], permisos=["azure_devops.ver"])
    persona = await _persona_de(usuario, app)
    otra = await Persona(
        aplicacion_id=app.codigo, nombre="Ajena", email="ajena@x.com", activo=True
    ).insert()
    await AzdoConfig(
        aplicacion_id=app.codigo,
        scope="user",
        usuario_id=str(persona.id),
        org_url="https://dev.azure.com/user-scope",
        pat="pat-user",
        default_project="Proyecto Usuario",
    ).insert()

    async def _arbol(self, *args, **kwargs):
        return ([], False)

    monkeypatch.setattr(AzureDevOpsService, "obtener_work_items_esquema", _arbol)
    _parchear_red(monkeypatch)

    # Con el usuario_id de OTRA persona: 403.
    resp_ajeno = await cliente.get(
        f"/api/azdo/esquema/arbol?usuario_id={otra.id}&origen=vivo",
        headers=headers_con_token(token, app.codigo),
    )
    assert resp_ajeno.status_code == 403

    # Con su PROPIO usuario_id: no 403.
    resp_propio = await cliente.get(
        f"/api/azdo/esquema/arbol?usuario_id={persona.id}&tipos=Task&origen=vivo",
        headers=headers_con_token(token, app.codigo),
    )
    assert resp_propio.status_code != 403


async def test_esquema_arbol_404_de_azure_mensaje_menciona_el_proyecto(
    cliente, fabrica_usuario, fabrica_aplicacion, monkeypatch
):
    app = await fabrica_aplicacion()
    _, token = await fabrica_usuario([app.codigo], permisos=["azure_devops.ver"])
    await AzdoConfig(
        aplicacion_id=app.codigo,
        scope="app",
        org_url="https://dev.azure.com/real",
        pat="pat-real",
        default_project="EPM_FABRICA DE DESARROLLO_76805",
    ).insert()

    async def _arbol_404(self, *args, **kwargs):
        raise RuntimeError(
            "Azure DevOps API 404: TF200016: The following project does not exist"
        )

    monkeypatch.setattr(AzureDevOpsService, "obtener_work_items_esquema", _arbol_404)

    resp = await cliente.get(
        "/api/azdo/esquema/arbol?target=hitss&limite=2000&tipos=Task&origen=vivo",
        headers=headers_con_token(token, app.codigo),
    )

    assert resp.status_code == 404
    detalle = resp.json()["detail"]
    assert "EPM_FABRICA DE DESARROLLO_76805" in detalle
    assert detalle != "No se pudo obtener el esquema de Azure DevOps."
    # El cuerpo crudo de Azure no debe filtrarse al cliente.
    assert "TF200016" not in detalle


async def test_config_con_usuario_id_propio_devuelve_pat_en_claro(
    cliente, fabrica_usuario, fabrica_aplicacion
):
    app = await fabrica_aplicacion()
    usuario, token = await fabrica_usuario([app.codigo], permisos=["azure_devops.ver"])
    persona = await _persona_de(usuario, app)
    await AzdoConfig(
        aplicacion_id=app.codigo,
        scope="user",
        usuario_id=str(persona.id),
        org_url="https://dev.azure.com/user-scope",
        pat="pat-secreto",
        default_project="Proyecto Usuario",
    ).insert()

    resp = await cliente.get(
        f"/api/azdo/config?usuario_id={persona.id}",
        headers=headers_con_token(token, app.codigo),
    )

    assert resp.status_code == 200
    datos = resp.json()
    assert datos["pat"] == "pat-secreto"
    assert datos["pat_guardado"] is True


async def test_config_con_usuario_id_ajeno_devuelve_403(
    cliente, fabrica_usuario, fabrica_aplicacion
):
    app = await fabrica_aplicacion()
    usuario, token = await fabrica_usuario([app.codigo], permisos=["azure_devops.ver"])
    await _persona_de(usuario, app)
    otra = await Persona(
        aplicacion_id=app.codigo, nombre="Ajena", email="ajena@x.com", activo=True
    ).insert()
    await AzdoConfig(
        aplicacion_id=app.codigo,
        scope="user",
        usuario_id=str(otra.id),
        org_url="https://dev.azure.com/ajeno",
        pat="pat-ajeno",
        default_project="Proyecto Ajeno",
    ).insert()

    resp = await cliente.get(
        f"/api/azdo/config?usuario_id={otra.id}",
        headers=headers_con_token(token, app.codigo),
    )

    assert resp.status_code == 403
    assert "pat-ajeno" not in resp.text


async def test_config_superadmin_obtiene_pat_de_otra_persona(
    cliente, superadmin_token, fabrica_aplicacion
):
    app = await fabrica_aplicacion()
    otra = await Persona(
        aplicacion_id=app.codigo, nombre="Ajena", email="ajena@x.com", activo=True
    ).insert()
    await AzdoConfig(
        aplicacion_id=app.codigo,
        scope="user",
        usuario_id=str(otra.id),
        org_url="https://dev.azure.com/ajeno",
        pat="pat-ajeno",
        default_project="Proyecto Ajeno",
    ).insert()

    resp = await cliente.get(
        f"/api/azdo/config?usuario_id={otra.id}",
        headers=headers_con_token(superadmin_token, app.codigo),
    )

    assert resp.status_code == 200
    assert resp.json()["pat"] == "pat-ajeno"


async def test_config_all_no_expone_pat(
    cliente, fabrica_usuario, fabrica_aplicacion
):
    app = await fabrica_aplicacion()
    usuario, token = await fabrica_usuario([app.codigo], permisos=["azure_devops.ver"])
    persona = await _persona_de(usuario, app)
    await AzdoConfig(
        aplicacion_id=app.codigo,
        scope="user",
        usuario_id=str(persona.id),
        org_url="https://dev.azure.com/user-scope",
        pat="pat-secreto",
        default_project="Proyecto Usuario",
    ).insert()

    resp = await cliente.get(
        "/api/azdo/config/all",
        headers=headers_con_token(token, app.codigo),
    )

    assert resp.status_code == 200
    elementos = resp.json()
    assert elementos, "debe haber al menos una configuración"
    for elemento in elementos:
        assert "pat" not in elemento
    assert "pat-secreto" not in resp.text


async def test_esquema_tipos_404_de_azure_mensaje_menciona_el_proyecto(
    cliente, fabrica_usuario, fabrica_aplicacion, monkeypatch
):
    app = await fabrica_aplicacion()
    _, token = await fabrica_usuario([app.codigo], permisos=["azure_devops.ver"])
    await AzdoConfig(
        aplicacion_id=app.codigo,
        scope="app",
        org_url="https://dev.azure.com/real",
        pat="pat-real",
        default_project="EPM_FABRICA DE DESARROLLO_76805",
    ).insert()

    async def _tipos_404(self, proyecto):
        raise RuntimeError("Azure DevOps API 404: TF200016: does not exist")

    monkeypatch.setattr(AzureDevOpsService, "obtener_tipos_proceso", _tipos_404)

    resp = await cliente.get(
        "/api/azdo/esquema/tipos",
        headers=headers_con_token(token, app.codigo),
    )

    assert resp.status_code == 404
    assert "EPM_FABRICA DE DESARROLLO_76805" in resp.json()["detail"]

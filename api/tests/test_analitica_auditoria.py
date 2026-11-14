"""Identidad, resultados confirmados y aislamiento de la auditoría."""
import asyncio
import json
from uuid import UUID

from app.documents.acta_trabajo import ActaTrabajo
from app.documents.auditoria import Auditoria
from app.documents.identidad_analitica import IdentidadAnalitica
from app.documents.usuario import Usuario
from app.services.identidad_analitica import obtener_id_analitico
from tests.conftest import headers_con_token


async def test_identidad_estable_en_solicitudes_concurrentes(
    cliente, fabrica_aplicacion, fabrica_usuario,
):
    aplicacion = await fabrica_aplicacion()
    usuario, token = await fabrica_usuario([aplicacion.codigo])
    respuestas = await asyncio.gather(*(
        cliente.get("/api/auth/me", headers=headers_con_token(token)) for _ in range(4)
    ))
    assert all(r.status_code == 200 for r in respuestas)
    ids = {r.json()["id_analitico"] for r in respuestas}
    assert len(ids) == 1
    identificador = ids.pop()
    assert UUID(identificador).version == 4
    assert identificador != str(usuario.id)
    actualizado = await Usuario.get(usuario.id)
    assert actualizado is not None
    correspondencia = await IdentidadAnalitica.find_one({"usuario_id": str(usuario.id)})
    assert correspondencia is not None and correspondencia.id_analitico == identificador
    assert await obtener_id_analitico(actualizado) == identificador
    assert all(r.json()["id"] == str(usuario.id) for r in respuestas)
    # Guardar una copia previa del usuario no debe sobrescribir la correspondencia.
    usuario.nombre = "Nombre editado"
    await usuario.save()
    assert await obtener_id_analitico(usuario) == identificador


async def test_login_sigue_funcionando_y_no_audita_credenciales(
    cliente, fabrica_aplicacion, fabrica_usuario,
):
    aplicacion = await fabrica_aplicacion()
    usuario, _ = await fabrica_usuario([aplicacion.codigo])
    respuesta = await cliente.post(
        "/api/auth/login",
        json={"email": usuario.email, "password": "no-se-usa-en-tests"},
    )
    assert respuesta.status_code == 200
    datos = respuesta.json()
    assert UUID(datos["usuario"]["id_analitico"]).version == 4
    me = await cliente.get(
        "/api/auth/me", headers=headers_con_token(datos["access_token"])
    )
    assert me.status_code == 200
    evento = await Auditoria.find_one({"usuario_id": str(usuario.id), "accion": "login"})
    assert evento is not None and evento.resultado == "exito"
    contenido = json.dumps(evento.model_dump(mode="json"))
    assert usuario.email not in contenido
    assert datos["access_token"] not in contenido
    assert usuario.password_hash not in contenido
    assert "no-se-usa-en-tests" not in contenido
    fallo = await cliente.post(
        "/api/auth/login", json={"email": usuario.email, "password": "secreto-incorrecto"},
    )
    assert fallo.status_code == 401
    evento_fallido = await Auditoria.find_one({
        "usuario_id": None, "accion": "login", "resultado": "fallo",
    })
    assert evento_fallido is not None and evento_fallido.codigo_http == 401
    assert "secreto-incorrecto" not in json.dumps(evento_fallido.model_dump(mode="json"))


async def test_acta_audita_actor_recurso_y_fallo_sin_exito_falso(
    cliente, fabrica_aplicacion, fabrica_usuario,
):
    aplicacion = await fabrica_aplicacion()
    usuario, token = await fabrica_usuario([aplicacion.codigo])
    headers = headers_con_token(token, aplicacion.codigo)
    respuesta = await cliente.post(
        "/api/actas", headers=headers,
        json={"codigo": "ACTA-PRUEBA", "direccion": "contenido-confidencial-prueba"},
    )
    assert respuesta.status_code == 201
    recurso_id = respuesta.json().get("id") or respuesta.json().get("_id")
    evento = await Auditoria.find_one({
        "usuario_id": str(usuario.id), "recurso_tipo": "actas", "accion": "crear",
    })
    assert evento is not None and evento.resultado == "exito"
    assert evento.recurso_id == recurso_id
    assert evento.aplicaciones_codigos == [aplicacion.codigo]
    assert "contenido-confidencial-prueba" not in json.dumps(evento.model_dump(mode="json"))
    fallo = await cliente.put(
        "/api/actas/000000000000000000000000", headers=headers,
        json={"codigo": "INEXISTENTE"},
    )
    assert fallo.status_code == 404
    fallido = await Auditoria.find_one({
        "usuario_id": str(usuario.id), "accion": "editar", "recurso_tipo": "actas",
    })
    assert fallido is not None and fallido.resultado == "fallo"
    assert fallido.codigo_http == 404
    assert fallido.ruta == "/actas/{acta_id}"
    assert await Auditoria.find({
        "usuario_id": str(usuario.id), "accion": "editar", "resultado": "exito",
    }).count() == 0


async def test_transicion_requerimiento_por_codigo_conserva_recurso_real(
    cliente, fabrica_aplicacion, fabrica_usuario,
):
    aplicacion = await fabrica_aplicacion()
    usuario, token = await fabrica_usuario(
        [aplicacion.codigo], permisos=["requerimientos.crear", "requerimientos.editar"],
    )
    headers = headers_con_token(token, aplicacion.codigo)
    codigo = f"RQ-{aplicacion.codigo}"
    creado = await cliente.post(
        "/api/requerimientos", headers=headers,
        json={
            "codigo_req": codigo, "solicitud": {"codigo_sc": f"SC-{aplicacion.codigo}"},
            "estado": "ESTIMACION EN CURSO POR HITSS",
        },
    )
    assert creado.status_code == 201
    recurso_id = creado.json().get("id") or creado.json().get("_id")
    respuesta = await cliente.post(
        f"/api/requerimientos/{codigo}/transicion", headers=headers,
        json={"nuevo_estado": "ESTIMACION EN ESPERA DE APROBACION POR EPM"},
    )
    assert respuesta.status_code == 200
    evento = await Auditoria.find_one({
        "usuario_id": str(usuario.id), "accion": "transicion",
    })
    assert evento is not None and evento.resultado == "exito"
    assert evento.recurso_id == recurso_id
    assert evento.ruta == "/requerimientos/{codigo_req}/transicion"


async def test_auditoria_permisos_y_eventos_consolidados_sin_fuga(
    cliente, fabrica_aplicacion, fabrica_usuario,
):
    propia, ajena = await fabrica_aplicacion(), await fabrica_aplicacion()
    lector, token = await fabrica_usuario(
        [propia.codigo], permisos=["admin.auditoria.ver"],
    )
    _, sin_permiso = await fabrica_usuario([propia.codigo])
    denegado = await cliente.get(
        "/api/auditoria", headers=headers_con_token(sin_permiso, propia.codigo),
    )
    assert denegado.status_code == 403
    for codigos, marca in (
        ([propia.codigo], "propia"),
        ([ajena.codigo], "ajena"),
        ([propia.codigo, ajena.codigo], "consolidada-ajena"),
    ):
        await Auditoria(
            usuario_id=str(lector.id), aplicaciones_codigos=codigos,
            recurso_tipo="actas", accion=marca, resultado="exito",
            codigo_http=200, duracion_ms=1, ruta="/actas", metodo="GET",
        ).insert()
    respuesta = await cliente.get(
        "/api/auditoria", headers=headers_con_token(token, propia.codigo),
        params={"usuario_id": str(lector.id)},
    )
    assert respuesta.status_code == 200
    assert respuesta.json()["total"] == 1
    assert respuesta.json()["eventos"][0]["accion"] == "propia"
    global_denegado = await cliente.get(
        "/api/auditoria/plataforma", headers=headers_con_token(token),
    )
    assert global_denegado.status_code == 403


async def test_identidad_protegida_no_resuelve_usuarios_ajenos(
    cliente, fabrica_aplicacion, fabrica_usuario,
):
    propia, ajena = await fabrica_aplicacion(), await fabrica_aplicacion()
    _, token = await fabrica_usuario([propia.codigo], permisos=["admin.auditoria.ver"])
    objetivo_propio, _ = await fabrica_usuario([propia.codigo])
    objetivo_ajeno, _ = await fabrica_usuario([ajena.codigo])
    id_propio = await obtener_id_analitico(objetivo_propio)
    id_ajeno = await obtener_id_analitico(objetivo_ajeno)
    respuesta = await cliente.get(
        f"/api/auditoria/identidad/{id_propio}",
        headers=headers_con_token(token, propia.codigo),
    )
    assert respuesta.status_code == 200
    assert respuesta.json()["usuario_id"] == str(objetivo_propio.id)
    assert "password_hash" not in respuesta.json()
    denegado = await cliente.get(
        f"/api/auditoria/identidad/{id_ajeno}",
        headers=headers_con_token(token, propia.codigo),
    )
    assert denegado.status_code == 404


async def test_header_no_validado_no_atribuye_operacion_a_app_ajena(
    cliente, fabrica_aplicacion, fabrica_usuario,
):
    propia, ajena = await fabrica_aplicacion(), await fabrica_aplicacion()
    usuario, token = await fabrica_usuario([propia.codigo])
    respuesta = await cliente.post(
        "/api/actas", headers=headers_con_token(token, ajena.codigo),
        json={"codigo": "NO-CREAR"},
    )
    assert respuesta.status_code == 403
    evento = await Auditoria.find_one({
        "usuario_id": str(usuario.id), "recurso_tipo": "actas", "accion": "crear",
    })
    assert evento is not None and evento.resultado == "fallo"
    assert evento.aplicaciones_codigos == [] and evento.plataforma
    assert ajena.codigo not in json.dumps(evento.model_dump(mode="json"))


async def test_fallo_auditoria_no_convierte_postcommit_en_500(
    cliente, fabrica_aplicacion, fabrica_usuario, monkeypatch, caplog,
):
    aplicacion = await fabrica_aplicacion()
    usuario, token = await fabrica_usuario([aplicacion.codigo])

    async def fallar_insert(*_args, **_kwargs):
        raise RuntimeError("Fallo simulado de persistencia")

    monkeypatch.setattr(Auditoria, "insert", fallar_insert)
    respuesta = await cliente.post(
        "/api/actas", headers=headers_con_token(token, aplicacion.codigo),
        json={"codigo": "CONFIRMADA"},
    )
    assert respuesta.status_code == 201
    assert await ActaTrabajo.find({
        "aplicacion_id": aplicacion.codigo, "codigo": "CONFIRMADA",
    }).count() == 1
    assert "AUDITORIA_NO_PERSISTIDA" in caplog.text
    assert str(usuario.id) in caplog.text


async def test_plataforma_solo_superadmin_y_fechas_validadas(cliente, superadmin_token):
    respuesta = await cliente.get(
        "/api/auditoria/plataforma",
        headers=headers_con_token(superadmin_token),
        params={"desde": "2026-12-01", "hasta": "2026-01-01"},
    )
    assert respuesta.status_code == 422

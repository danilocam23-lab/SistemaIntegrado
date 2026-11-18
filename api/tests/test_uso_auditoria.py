"""Login auditado sin PII, eventos de uso y resumen de uso con aislamiento."""
import json
from datetime import UTC, datetime
from types import SimpleNamespace

import pytest

from app.config import get_settings
from app.documents.auditoria import Auditoria
from app.documents.evento_uso import EventoUso
from app.services import eventos_uso
from app.services.auditoria import hmac_email
from app.services.eventos_uso import reiniciar_limites
from tests.conftest import headers_con_token

URL_EVENTOS = "/api/auditoria/eventos-uso"


@pytest.fixture(autouse=True)
def _limpiar_limites():
    reiniciar_limites()


def _ev(event="app_page_view", screen="dashboard", **extra):
    return {
        "event": event, "screen": screen, "module": extra.pop("module", "dashboard"),
        "interaction_id": extra.pop("interaction_id", None),
        "action_name": extra.pop("action_name", None),
        "ts": datetime.now(UTC).isoformat(), **extra,
    }


async def test_login_fallido_sin_pii_con_usuario_y_huella(
    cliente, fabrica_aplicacion, fabrica_usuario,
):
    app = await fabrica_aplicacion()
    usuario, _ = await fabrica_usuario([app.codigo])
    r = await cliente.post(
        "/api/auth/login", json={"email": usuario.email, "password": "clave-mala-xyz"},
        headers={"User-Agent": "X" * 500},
    )
    assert r.status_code == 401
    ev = await Auditoria.find_one({"usuario_id": str(usuario.id), "resultado": "fallo"})
    assert ev is not None and ev.accion == "login"
    assert ev.email_hmac == hmac_email(usuario.email)
    assert ev.aplicaciones_codigos == [app.codigo] and not ev.plataforma
    assert ev.user_agent is not None and len(ev.user_agent) <= 200
    contenido = json.dumps(ev.model_dump(mode="json"))
    assert usuario.email not in contenido and "clave-mala-xyz" not in contenido
    # Email inexistente: sin usuario_id, solo huella.
    await cliente.post("/api/auth/login", json={"email": "nadie@x.com", "password": "abc"})
    anonimo = await Auditoria.find_one({"email_hmac": hmac_email("nadie@x.com")})
    assert anonimo is not None and anonimo.usuario_id is None
    assert "nadie@x.com" not in json.dumps(anonimo.model_dump(mode="json"))


async def test_token_invalido_no_genera_auditoria_anonima(cliente, fabrica_aplicacion):
    app = await fabrica_aplicacion()
    antes = await Auditoria.find({"recurso_tipo": "actas"}).count()
    r = await cliente.post(
        "/api/actas", headers=headers_con_token("token-basura", app.codigo),
        json={"codigo": "X"},
    )
    assert r.status_code == 401
    assert await Auditoria.find({"recurso_tipo": "actas"}).count() == antes


async def test_admin_app_no_ve_logins_ni_eventos_de_otra_app(
    cliente, fabrica_aplicacion, fabrica_usuario,
):
    a, b = await fabrica_aplicacion(), await fabrica_aplicacion()
    _, token_a = await fabrica_usuario([a.codigo], permisos=["admin.auditoria.ver"])
    ua, _ = await fabrica_usuario([a.codigo])
    ub, token_b = await fabrica_usuario([b.codigo])
    for u in (ua, ub):
        ok = await cliente.post(
            "/api/auth/login", json={"email": u.email, "password": "no-se-usa-en-tests"},
        )
        assert ok.status_code == 200
    ev = await cliente.post(
        URL_EVENTOS, headers=headers_con_token(token_b, b.codigo), json={"eventos": [_ev()]},
    )
    assert ev.status_code == 202

    h = headers_con_token(token_a, a.codigo)
    logins = await cliente.get("/api/auditoria", headers=h, params={"accion": "login"})
    usuarios = {e["usuario_id"] for e in logins.json()["eventos"]}
    assert str(ua.id) in usuarios and str(ub.id) not in usuarios
    resumen = await cliente.get("/api/auditoria/resumen-uso", headers=h)
    assert resumen.status_code == 200
    ids = {f["usuario_id"] for f in resumen.json()}
    assert str(ua.id) in ids and str(ub.id) not in ids


async def test_resumen_uso_cuenta_y_exige_permiso(
    cliente, fabrica_aplicacion, fabrica_usuario,
):
    a = await fabrica_aplicacion()
    _, token_admin = await fabrica_usuario([a.codigo], permisos=["admin.auditoria.ver"])
    u, token_u = await fabrica_usuario([a.codigo])
    await cliente.post(
        "/api/auth/login", json={"email": u.email, "password": "no-se-usa-en-tests"},
    )
    await cliente.post("/api/auth/login", json={"email": u.email, "password": "mala"})
    lote = [
        _ev(screen="personas"), _ev(screen="dashboard"), _ev(screen="dashboard"),
        _ev("app_interaction", interaction_id="filtro.opcion", action_name="click"),
        _ev("app_interaction", interaction_id="filtro.opcion"),
        _ev("app_export"),
    ]
    r = await cliente.post(
        URL_EVENTOS, headers=headers_con_token(token_u, a.codigo), json={"eventos": lote},
    )
    assert r.json() == {"aceptados": 6, "duplicados": 0}
    denegado = await cliente.get(
        "/api/auditoria/resumen-uso", headers=headers_con_token(token_u, a.codigo),
    )
    assert denegado.status_code == 403
    res = await cliente.get(
        "/api/auditoria/resumen-uso", headers=headers_con_token(token_admin, a.codigo),
        params={"usuario_id": str(u.id)},
    )
    assert res.status_code == 200 and len(res.json()) == 1
    fila = res.json()[0]
    assert fila["nombre"] == u.nombre
    assert fila["ingresos"] == 1 and fila["ingresos_fallidos"] == 1
    assert fila["ultimo_ingreso"] is not None
    assert fila["pantallas"][0] == {"screen": "dashboard", "module": "dashboard", "vistas": 2}
    assert fila["acciones_total"] == 3 and fila["formularios"] == 0
    assert fila["tiempo_total_ms"] == 0
    assert fila["interacciones_top"] == [{"interaction_id": "filtro.opcion", "veces": 2}]


async def test_eventos_uso_lista_blanca_y_descarte_silencioso(
    cliente, fabrica_aplicacion, fabrica_usuario,
):
    a = await fabrica_aplicacion()
    u, token = await fabrica_usuario([a.codigo])
    lote = [
        _ev(),
        _ev("evento_inventado"),
        _ev(screen="Pantalla Con Espacios"),
        _ev(screen="pantalla_fuera_de_catalogo"),
        _ev(module="modulo_inventado"),
        _ev(module="x" * 81),
        {"event": "app_page_view", "ts": "no-es-fecha"},
        "basura",
    ]
    r = await cliente.post(
        URL_EVENTOS, headers=headers_con_token(token, a.codigo), json={"eventos": lote},
    )
    assert r.status_code == 202 and r.json() == {"aceptados": 1, "duplicados": 0}
    guardados = await EventoUso.find({"usuario_id": str(u.id)}).to_list()
    assert len(guardados) == 1 and guardados[0].aplicacion_id == a.codigo
    sin_auth = await cliente.post(URL_EVENTOS, json={"eventos": []})
    assert sin_auth.status_code == 401
    grande = await cliente.post(
        URL_EVENTOS, headers=headers_con_token(token),
        json={"eventos": [_ev() for _ in range(51)]},
    )
    assert grande.status_code == 422


async def test_eventos_uso_rate_limit(cliente, fabrica_aplicacion, fabrica_usuario):
    a = await fabrica_aplicacion()
    _, token = await fabrica_usuario([a.codigo])
    h = headers_con_token(token, a.codigo)
    lote = {"eventos": [_ev() for _ in range(50)]}
    for esperado in (202, 202, 429):
        assert (await cliente.post(URL_EVENTOS, headers=h, json=lote)).status_code == esperado


async def _post(cliente, token, eventos, app=None):
    return await cliente.post(
        URL_EVENTOS, headers=headers_con_token(token, app), json={"eventos": eventos},
    )


async def _resumen(cliente, token, app, **params):
    r = await cliente.get(
        "/api/auditoria/resumen-uso", headers=headers_con_token(token, app), params=params,
    )
    assert r.status_code == 200, r.text
    return {f["usuario_id"]: f for f in r.json()}


async def test_eventos_sin_aplicacion_solo_superadmin_consolidado(
    cliente, fabrica_aplicacion, fabrica_usuario, superadmin_token,
):
    a = await fabrica_aplicacion()
    _, token_admin = await fabrica_usuario([a.codigo], permisos=["admin.auditoria.ver"])
    u, token_u = await fabrica_usuario([a.codigo])
    # Consolidado y aplicación no autorizada: se guardan con aplicacion_id None.
    assert (await _post(cliente, token_u, [_ev()], "__todas__")).status_code == 202
    assert (await _post(cliente, token_u, [_ev()], "app-inexistente-xyz")).status_code == 202
    guardados = await EventoUso.find({"usuario_id": str(u.id)}).to_list()
    assert len(guardados) == 2 and all(g.aplicacion_id is None for g in guardados)
    assert str(u.id) not in await _resumen(cliente, token_admin, a.codigo)
    consolidado = await _resumen(cliente, superadmin_token, "__todas__", usuario_id=str(u.id))
    assert consolidado[str(u.id)]["pantallas"][0]["vistas"] == 2
    # Superadmin con una app concreta tampoco ve los eventos sin aplicación.
    assert str(u.id) not in await _resumen(cliente, superadmin_token, a.codigo)


async def test_superadmin_con_aplicacion_concreta_filtra_por_ella(
    cliente, fabrica_aplicacion, fabrica_usuario, superadmin_token,
):
    a, b = await fabrica_aplicacion(), await fabrica_aplicacion()
    ua, token_a = await fabrica_usuario([a.codigo])
    ub, token_b = await fabrica_usuario([b.codigo])
    await _post(cliente, token_a, [_ev()], a.codigo)
    await _post(cliente, token_b, [_ev()], b.codigo)
    en_a = await _resumen(cliente, superadmin_token, a.codigo)
    assert str(ua.id) in en_a and str(ub.id) not in en_a
    todo = await _resumen(cliente, superadmin_token, "__todas__")
    assert str(ua.id) in todo and str(ub.id) in todo


async def test_usuario_con_dos_apps_visible_a_cada_admin_por_login(
    cliente, fabrica_aplicacion, fabrica_usuario,
):
    a, b = await fabrica_aplicacion(), await fabrica_aplicacion()
    _, token_a = await fabrica_usuario([a.codigo], permisos=["admin.auditoria.ver"])
    _, token_b = await fabrica_usuario([b.codigo], permisos=["admin.auditoria.ver"])
    u, token_u = await fabrica_usuario([a.codigo, b.codigo])
    ok = await cliente.post(
        "/api/auth/login", json={"email": u.email, "password": "no-se-usa-en-tests"},
    )
    assert ok.status_code == 200
    await _post(cliente, token_u, [_ev()], a.codigo)
    en_a = await _resumen(cliente, token_a, a.codigo)
    en_b = await _resumen(cliente, token_b, b.codigo)
    assert en_a[str(u.id)]["ingresos"] == 1 and en_a[str(u.id)]["pantallas"]
    # En la app b el login cuenta, pero los eventos hechos en a no.
    assert en_b[str(u.id)]["ingresos"] == 1 and en_b[str(u.id)]["pantallas"] == []


async def test_usuario_id_con_operador_no_altera_ambito(
    cliente, fabrica_aplicacion, fabrica_usuario,
):
    a, b = await fabrica_aplicacion(), await fabrica_aplicacion()
    _, token_a = await fabrica_usuario([a.codigo], permisos=["admin.auditoria.ver"])
    ub, token_b = await fabrica_usuario([b.codigo])
    await _post(cliente, token_b, [_ev()], b.codigo)
    assert await _resumen(cliente, token_a, a.codigo, usuario_id='{"$ne": null}') == {}
    assert await _resumen(cliente, token_a, a.codigo, usuario_id=str(ub.id)) == {}
    r = await cliente.get(
        "/api/auditoria/resumen-uso?usuario_id[$ne]=x",
        headers=headers_con_token(token_a, a.codigo),
    )
    assert r.status_code == 200 and all(f["usuario_id"] != str(ub.id) for f in r.json())


async def test_dedupe_por_id_y_aceptados(cliente, fabrica_aplicacion, fabrica_usuario):
    a = await fabrica_aplicacion()
    u, token = await fabrica_usuario([a.codigo])
    evento = _ev(id="evt-0001")
    r1 = await _post(cliente, token, [evento, dict(evento), _ev(id="evt-0002")], a.codigo)
    assert r1.json() == {"aceptados": 3, "duplicados": 1}
    r2 = await _post(cliente, token, [evento], a.codigo)
    assert r2.json() == {"aceptados": 1, "duplicados": 1}
    assert await EventoUso.find({"usuario_id": str(u.id)}).count() == 2
    # Sin id no se deduplica; un id mal formado descarta el evento.
    r3 = await _post(cliente, token, [_ev(), _ev(), _ev(id="id con espacios")], a.codigo)
    assert r3.json() == {"aceptados": 2, "duplicados": 0}


async def test_cuerpo_demasiado_grande_413_y_json_invalido_422(
    cliente, fabrica_aplicacion, fabrica_usuario,
):
    a = await fabrica_aplicacion()
    _, token = await fabrica_usuario([a.codigo])
    h = headers_con_token(token, a.codigo)
    grande = {"eventos": [{"event": "app_page_view", "relleno": "x" * 40000}]}
    assert (await cliente.post(URL_EVENTOS, headers=h, json=grande)).status_code == 413
    invalido = await cliente.post(URL_EVENTOS, headers=h, content=b"no-es-json")
    assert invalido.status_code == 422
    sin_clave = await cliente.post(URL_EVENTOS, headers=h, json={"otro": []})
    assert sin_clave.status_code == 422


async def test_interaction_id_desconocido_consume_cupo_diario(
    cliente, fabrica_aplicacion, fabrica_usuario, monkeypatch,
):
    monkeypatch.setattr(get_settings(), "eventos_uso_ids_nuevos_por_dia", 2)
    a = await fabrica_aplicacion()
    _, token = await fabrica_usuario([a.codigo])
    lote = [
        _ev("app_interaction", interaction_id=f"ctrl.nuevo_{i}") for i in range(3)
    ] + [_ev("app_interaction", interaction_id="menu.navegar")]
    r = await _post(cliente, token, lote, a.codigo)
    assert r.json()["aceptados"] == 3  # 2 nuevos dentro del cupo + 1 conocido


async def test_formularios_y_tiempo_se_agregan_aparte(
    cliente, fabrica_aplicacion, fabrica_usuario,
):
    a = await fabrica_aplicacion()
    _, token_admin = await fabrica_usuario([a.codigo], permisos=["admin.auditoria.ver"])
    u, token = await fabrica_usuario([a.codigo])
    lote = [
        _ev("app_form", screen="requerimientos", interaction_id="entrega", action_name="start"),
        _ev("app_interaction", interaction_id="menu.navegar"),
        _ev("app_screen_engagement", duracion_ms=1500),
        _ev("app_screen_engagement", duracion_ms=500),
        _ev("app_screen_engagement", duracion_ms=10**12),  # se acota al tope
        _ev("app_screen_engagement", duracion_ms=-5),  # inválido: descartado
        _ev("app_screen_engagement", duracion_ms="12"),  # inválido: descartado
    ]
    assert (await _post(cliente, token, lote, a.codigo)).json()["aceptados"] == 5
    fila = (await _resumen(cliente, token_admin, a.codigo))[str(u.id)]
    assert fila["acciones_total"] == 1 and fila["formularios"] == 1
    assert fila["tiempo_total_ms"] == 2000 + eventos_uso.DURACION_MAX_MS


async def test_resumen_uso_rango_maximo_y_defecto(
    cliente, fabrica_aplicacion, fabrica_usuario,
):
    a = await fabrica_aplicacion()
    _, token = await fabrica_usuario([a.codigo], permisos=["admin.auditoria.ver"])
    h = headers_con_token(token, a.codigo)
    excesivo = await cliente.get(
        "/api/auditoria/resumen-uso", headers=h, params={"desde": "2020-01-01T00:00:00Z"},
    )
    assert excesivo.status_code == 422
    invertido = await cliente.get(
        "/api/auditoria/resumen-uso", headers=h,
        params={"desde": "2026-02-01T00:00:00Z", "hasta": "2026-01-01T00:00:00Z"},
    )
    assert invertido.status_code == 422
    assert (await cliente.get("/api/auditoria/resumen-uso", headers=h)).status_code == 200


async def test_auditoria_oculta_ip_ua_y_hmac_salvo_superadmin(
    cliente, fabrica_aplicacion, fabrica_usuario, superadmin_token,
):
    a = await fabrica_aplicacion()
    _, token_admin = await fabrica_usuario([a.codigo], permisos=["admin.auditoria.ver"])
    u, _ = await fabrica_usuario([a.codigo])
    await cliente.post(
        "/api/auth/login", json={"email": u.email, "password": "no-se-usa-en-tests"},
        headers={"User-Agent": "agente-prueba"},
    )
    params = {"accion": "login", "usuario_id": str(u.id)}
    admin = await cliente.get(
        "/api/auditoria", headers=headers_con_token(token_admin, a.codigo), params=params,
    )
    fila = admin.json()["eventos"][0]
    assert not {"ip", "user_agent", "email_hmac"} & fila.keys()
    sup = await cliente.get(
        "/api/auditoria", headers=headers_con_token(superadmin_token, a.codigo), params=params,
    )
    fila = sup.json()["eventos"][0]
    assert fila["user_agent"] == "agente-prueba" and fila["email_hmac"] and fila["ip"]


async def test_ip_cliente_respeta_proxy_solo_si_es_de_confianza(
    cliente, fabrica_aplicacion, fabrica_usuario, monkeypatch,
):
    a = await fabrica_aplicacion()
    u, _ = await fabrica_usuario([a.codigo])
    cuerpo = {"email": u.email, "password": "mala"}
    cabecera = {"X-Forwarded-For": "6.6.6.6, 203.0.113.9"}
    await cliente.post("/api/auth/login", json=cuerpo, headers=cabecera)
    ev = await Auditoria.find({"usuario_id": str(u.id)}).sort("-creado_en").first_or_none()
    assert ev is not None and ev.ip not in ("6.6.6.6", "203.0.113.9")
    monkeypatch.setattr(get_settings(), "auditoria_confiar_proxy", True)
    await cliente.post("/api/auth/login", json=cuerpo, headers=cabecera)
    ev = await Auditoria.find({"usuario_id": str(u.id)}).sort("-creado_en").first_or_none()
    assert ev is not None and ev.ip == "203.0.113.9"
    await cliente.post("/api/auth/login", json=cuerpo, headers={"X-Forwarded-For": "basura"})
    ev = await Auditoria.find({"usuario_id": str(u.id)}).sort("-creado_en").first_or_none()
    assert ev is not None and ev.ip not in (None, "basura")


def test_hmac_usa_clave_propia_con_fallback_a_jwt(monkeypatch):
    base = hmac_email("x@y.com")
    monkeypatch.setattr(get_settings(), "auditoria_hmac_secret", "clave-propia-de-auditoria")
    assert hmac_email("x@y.com") != base
    monkeypatch.setattr(get_settings(), "auditoria_hmac_secret", "")
    assert hmac_email("x@y.com") == base


def test_rate_limit_purga_claves_inactivas(monkeypatch):
    reiniciar_limites()
    assert eventos_uso.limite_excedido("usuario-inactivo", 1) is False
    assert "usuario-inactivo" in eventos_uso._envios
    inicio = eventos_uso.time.monotonic()
    monkeypatch.setattr(eventos_uso, "time", SimpleNamespace(monotonic=lambda: inicio + 500))
    eventos_uso._ultima_purga = 0.0
    eventos_uso.limite_excedido("otro", 1)
    assert "usuario-inactivo" not in eventos_uso._envios

"""Validación, límite de ritmo, persistencia idempotente y resumen de eventos de uso."""
import re
import time
from collections import deque
from datetime import UTC, datetime, timedelta
from typing import Any

from pymongo.errors import BulkWriteError

from app.config import get_settings
from app.documents.auditoria import Auditoria
from app.documents.base import ahora
from app.documents.evento_uso import EventoUso
from app.services.catalogo_uso import MODULOS, PANTALLAS, interaccion_conocida

EVENTOS_PERMITIDOS = frozenset({
    "app_page_view", "app_interaction", "app_screen_engagement",
    "app_session", "app_export", "app_form",
})
# Acciones "reales" del usuario; app_form se cuenta aparte (formularios).
EVENTOS_ACCION = ["app_interaction", "app_export"]
DURACION_MAX_MS = 4 * 3600 * 1000  # tope por evento de permanencia: 4 h
_TOKEN = re.compile(r"[a-z0-9_.:-]{1,80}")
_ID_EVENTO = re.compile(r"[A-Za-z0-9_.:-]{1,64}")
_VENTANA_S = 60.0
_envios: dict[str, deque[tuple[float, int]]] = {}
_ultima_purga = 0.0
_ids_nuevos: dict[str, set[str]] = {}
_dia_ids_nuevos = ""


def _token(valor: object) -> str | None:
    if isinstance(valor, str) and _TOKEN.fullmatch(valor):
        return valor
    return None


def _fecha(valor: object) -> datetime | None:
    if not isinstance(valor, str) or len(valor) > 40:
        return None
    try:
        fecha = datetime.fromisoformat(valor.replace("Z", "+00:00"))
    except ValueError:
        return None
    fecha = fecha.replace(tzinfo=UTC) if fecha.tzinfo is None else fecha.astimezone(UTC)
    ahora_utc = datetime.now(UTC)
    retencion = timedelta(days=get_settings().eventos_uso_retencion_dias)
    if fecha > ahora_utc + timedelta(days=1) or fecha < ahora_utc - retencion:
        return None
    return fecha


def _cupo_id_nuevo(usuario_id: str, valor: str) -> bool:
    """Admite un id desconocido mientras el usuario no agote su cupo diario (por proceso)."""
    global _dia_ids_nuevos
    hoy = datetime.now(UTC).date().isoformat()
    if hoy != _dia_ids_nuevos:
        _ids_nuevos.clear()
        _dia_ids_nuevos = hoy
    vistos = _ids_nuevos.setdefault(usuario_id, set())
    if valor in vistos:
        return True
    if len(vistos) >= get_settings().eventos_uso_ids_nuevos_por_dia:
        return False
    vistos.add(valor)
    return True


def normalizar_evento(crudo: Any, usuario_id: str | None = None) -> dict | None:
    """Devuelve el evento saneado o ``None`` si no cumple el vocabulario (ver catalogo_uso)."""
    if not isinstance(crudo, dict) or crudo.get("event") not in EVENTOS_PERMITIDOS:
        return None
    ts = _fecha(crudo.get("ts"))
    if ts is None:
        return None
    limpio: dict = {"event": crudo["event"], "ts": ts}
    for campo, catalogo in (("screen", PANTALLAS), ("module", MODULOS)):
        valor = crudo.get(campo)
        if valor is not None and (not isinstance(valor, str) or valor not in catalogo):
            return None
        limpio[campo] = valor
    accion = crudo.get("action_name")
    if accion is not None and _token(accion) is None:
        return None
    limpio["action_name"] = accion
    interaccion = crudo.get("interaction_id")
    if interaccion is not None:
        if _token(interaccion) is None:
            return None
        if not interaccion_conocida(interaccion) and not (
            usuario_id is not None and _cupo_id_nuevo(usuario_id, interaccion)
        ):
            return None
    limpio["interaction_id"] = interaccion
    evento_id = crudo.get("id")
    if evento_id is not None and not (
        isinstance(evento_id, str) and _ID_EVENTO.fullmatch(evento_id)
    ):
        return None
    limpio["evento_id"] = evento_id
    duracion = crudo.get("duracion_ms")
    limpio["duracion_ms"] = None
    if crudo["event"] == "app_screen_engagement" and duracion is not None:
        if isinstance(duracion, bool) or not isinstance(duracion, int) or duracion < 0:
            return None
        limpio["duracion_ms"] = min(duracion, DURACION_MAX_MS)
    return limpio


def _purgar_envios(ahora_m: float) -> None:
    """Elimina las claves inactivas para que ``_envios`` no crezca sin límite."""
    global _ultima_purga
    if ahora_m - _ultima_purga < _VENTANA_S:
        return
    _ultima_purga = ahora_m
    inactivas = [u for u, c in _envios.items() if not c or ahora_m - c[-1][0] > _VENTANA_S]
    for uid in inactivas:
        del _envios[uid]


def limite_excedido(usuario_id: str, cantidad: int) -> bool:
    """Ventana deslizante de 60 s por usuario; registra el envío si cabe."""
    ahora_m = time.monotonic()
    _purgar_envios(ahora_m)
    cola = _envios.setdefault(usuario_id, deque())
    while cola and ahora_m - cola[0][0] > _VENTANA_S:
        cola.popleft()
    usados = sum(n for _, n in cola)
    if usados + cantidad > get_settings().eventos_uso_limite_por_minuto:
        if not cola:
            del _envios[usuario_id]
        return True
    cola.append((ahora_m, cantidad))
    return False


def reiniciar_limites() -> None:
    _envios.clear()
    _ids_nuevos.clear()


async def guardar_eventos(
    usuario_id: str, aplicacion_id: str | None, eventos: list[dict]
) -> int:
    """Inserta idempotentemente; devuelve cuántos eran duplicados (mismo ``id`` y usuario)."""
    if not eventos:
        return 0
    marca = ahora()
    docs = [
        {**e, "usuario_id": usuario_id, "aplicacion_id": aplicacion_id,
         "creado_en": marca, "actualizado_en": marca}
        for e in eventos
    ]
    try:
        await EventoUso.get_pymongo_collection().insert_many(docs, ordered=False)
    except BulkWriteError as exc:
        errores = exc.details.get("writeErrors", [])
        if any(err.get("code") != 11000 for err in errores):
            raise
        return len(errores)
    return 0


async def resumen_uso(
    filtro_login: dict, filtro_eventos: dict, usuario_id: str | None
) -> dict[str, dict]:
    """Agrega por usuario con ``aggregate`` de Mongo (ingresos, pantallas, acciones, tiempo).

    ``acciones_total`` cuenta app_interaction y app_export; ``formularios`` cuenta app_form;
    ``tiempo_total_ms`` suma ``duracion_ms`` de app_screen_engagement. Cada agregación
    lleva ``$limit`` (``resumen_uso_max_filas``) y nunca se materializa sin tope.
    """
    tope = get_settings().resumen_uso_max_filas
    if usuario_id:
        filtro_login = {**filtro_login, "usuario_id": usuario_id}
        filtro_eventos = {**filtro_eventos, "usuario_id": usuario_id}
    else:
        filtro_login = {**filtro_login, "usuario_id": {"$ne": None}}
    por_usuario: dict[str, dict] = {}

    def _u(uid: str) -> dict:
        return por_usuario.setdefault(uid, {
            "usuario_id": uid, "ingresos": 0, "ingresos_fallidos": 0,
            "ultimo_ingreso": None, "pantallas": [], "acciones_total": 0,
            "formularios": 0, "tiempo_total_ms": 0, "interacciones_top": [],
        })

    logins = await (await Auditoria.get_pymongo_collection().aggregate([
        {"$match": filtro_login},
        {"$group": {
            "_id": "$usuario_id",
            "ingresos": {"$sum": {"$cond": [{"$eq": ["$resultado", "exito"]}, 1, 0]}},
            "fallidos": {"$sum": {"$cond": [{"$eq": ["$resultado", "fallo"]}, 1, 0]}},
            "ultimo": {"$max": {"$cond": [{"$eq": ["$resultado", "exito"]}, "$creado_en", None]}},
        }},
        {"$limit": tope},
    ])).to_list(tope)
    for fila in logins:
        u = _u(fila["_id"])
        u["ingresos"], u["ingresos_fallidos"], u["ultimo_ingreso"] = (
            fila["ingresos"], fila["fallidos"], fila["ultimo"],
        )

    col = EventoUso.get_pymongo_collection()
    pantallas = await (await col.aggregate([
        {"$match": {**filtro_eventos, "event": "app_page_view", "screen": {"$ne": None}}},
        {"$group": {
            "_id": {"u": "$usuario_id", "s": "$screen", "m": "$module"}, "vistas": {"$sum": 1},
        }},
        {"$sort": {"vistas": -1}},
        {"$limit": tope},
    ])).to_list(tope)
    for fila in pantallas:
        _u(fila["_id"]["u"])["pantallas"].append({
            "screen": fila["_id"]["s"], "module": fila["_id"]["m"], "vistas": fila["vistas"],
        })

    acciones = await (await col.aggregate([
        {"$match": {
            **filtro_eventos,
            "event": {"$in": [*EVENTOS_ACCION, "app_form", "app_screen_engagement"]},
        }},
        {"$group": {
            "_id": "$usuario_id",
            "n": {"$sum": {"$cond": [{"$in": ["$event", EVENTOS_ACCION]}, 1, 0]}},
            "f": {"$sum": {"$cond": [{"$eq": ["$event", "app_form"]}, 1, 0]}},
            "t": {"$sum": {"$cond": [
                {"$eq": ["$event", "app_screen_engagement"]},
                {"$ifNull": ["$duracion_ms", 0]}, 0,
            ]}},
        }},
        {"$limit": tope},
    ])).to_list(tope)
    for fila in acciones:
        u = _u(fila["_id"])
        u["acciones_total"], u["formularios"], u["tiempo_total_ms"] = (
            fila["n"], fila["f"], fila["t"],
        )

    interacciones = await (await col.aggregate([
        {"$match": {
            **filtro_eventos, "event": "app_interaction", "interaction_id": {"$ne": None},
        }},
        {"$group": {
            "_id": {"u": "$usuario_id", "i": "$interaction_id"}, "veces": {"$sum": 1},
        }},
        {"$sort": {"veces": -1}},
        {"$limit": tope},
    ])).to_list(tope)
    for fila in interacciones:
        tops = _u(fila["_id"]["u"])["interacciones_top"]
        if len(tops) < 10:
            tops.append({"interaction_id": fila["_id"]["i"], "veces": fila["veces"]})
    return por_usuario

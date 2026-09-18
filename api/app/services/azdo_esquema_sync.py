# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Sincronización del espejo de esquema de Azure DevOps hacia Mongo.

A diferencia de ``azdo_sync`` (sync por sprint), aquí se refleja el **proyecto
entero sin filtro de iteración**: las épicas y features cuelgan de la raíz del
proyecto, no de los sprints, así que un espejo filtrado por iteración no
permitiría reconstruir la cadena Épica → Feature → Historia → Tarea.

La WIQL del proyecto puede superar el tope de 20.000 work items de Azure DevOps
(VS402337), que rechaza la consulta entera. Para evitarlo se particiona una WIQL
por tipo de work item y, si una partición aún supera el tope, se subdivide
recursivamente por rango de ``[System.Id]`` hasta que cada tramo cabe.
"""
import logging
from datetime import UTC, datetime, timedelta

import httpx
from beanie import PydanticObjectId
from pymongo import UpdateOne

from app.documents.azdo import AzdoEsquemaItem, AzdoEsquemaSyncLog
from app.services.azure_devops import AzureDevOpsService, normalizar_org_key

logger = logging.getLogger(__name__)

# Azure DevOps rechaza la consulta entera al superar este tope de work items.
_ERROR_LIMITE = "VS402337"
# Profundidad máxima de subdivisión por rango de id. Con un rango inicial
# [1, max] y bisección, 12 niveles cubren rangos de hasta ~4096 veces el tope,
# más que suficiente para cualquier proyecto real.
PROFUNDIDAD_MAXIMA = 12
# Tope global de particiones: cortafuegos para no martillear Azure si algo va mal.
TOPE_PARTICIONES = 400
# Una corrida "en_curso" más vieja que esto se considera muerta (el worker de
# IIS pudo reciclarse a mitad de la sync) y no bloquea una nueva.
CADUCIDAD = timedelta(minutes=30)


def _es_error_limite(exc: Exception) -> bool:
    return isinstance(exc, RuntimeError) and _ERROR_LIMITE in str(exc)


class _ContadorParticiones:
    """Cuenta las consultas WIQL emitidas y aborta si superan el tope global."""

    def __init__(self, tope: int = TOPE_PARTICIONES) -> None:
        self.tope = tope
        self.total = 0

    def registrar(self) -> None:
        self.total += 1
        if self.total > self.tope:
            raise RuntimeError(
                f"La sincronización superó el tope de {self.tope} particiones; "
                "se aborta para no saturar Azure DevOps."
            )


async def _recolectar_rango(
    svc: AzureDevOpsService,
    cliente,
    proyecto: str,
    tipo: str,
    id_min: int,
    id_max: int,
    profundidad: int,
    contador: _ContadorParticiones,
) -> list[int]:
    """Recoge los ids de un tipo dentro de ``[id_min, id_max]``, subdividiendo
    por la mitad cada vez que Azure responde VS402337."""
    if id_min > id_max:  # rango vacío: devuelve rápido, no se subdivide
        return []
    contador.registrar()
    try:
        return await svc.obtener_ids_esquema(
            cliente, proyecto, [tipo], id_min=id_min, id_max=id_max
        )
    except RuntimeError as exc:
        if not _es_error_limite(exc):
            raise
    if profundidad >= PROFUNDIDAD_MAXIMA or id_min >= id_max:
        raise RuntimeError(
            f"No se pudo acotar el rango [{id_min}, {id_max}] del tipo '{tipo}' por "
            f"debajo del tope de Azure DevOps tras {profundidad} niveles."
        )
    medio = (id_min + id_max) // 2
    izquierda = await _recolectar_rango(
        svc, cliente, proyecto, tipo, id_min, medio, profundidad + 1, contador
    )
    derecha = await _recolectar_rango(
        svc, cliente, proyecto, tipo, medio + 1, id_max, profundidad + 1, contador
    )
    return izquierda + derecha


async def _recolectar_ids_tipo(
    svc: AzureDevOpsService,
    cliente,
    proyecto: str,
    tipo: str,
    contador: _ContadorParticiones,
) -> list[int]:
    """Recoge todos los ids de un tipo, particionando por rango solo si hace falta.

    Empieza sin cotas (una sola consulta). Al detectar VS402337 descubre el id
    máximo con ``$top=1`` (consulta que nunca dispara el tope) y particiona el
    rango ``[1, max]`` por bisección hasta converger.
    """
    contador.registrar()
    try:
        return await svc.obtener_ids_esquema(cliente, proyecto, [tipo])
    except RuntimeError as exc:
        if not _es_error_limite(exc):
            raise
    id_max = await svc.obtener_id_maximo_esquema(cliente, proyecto, [tipo])
    if id_max <= 0:
        return []
    return await _recolectar_rango(svc, cliente, proyecto, tipo, 1, id_max, 0, contador)


def _operacion_upsert(
    item: dict, target: str, org_key: str, proyecto: str, marca: datetime
) -> UpdateOne:
    datos = {
        "target": target,
        "org_key": org_key,
        "proyecto": proyecto,
        "azdo_id": item["azdo_id"],
        "parent_id": item.get("parent_id"),
        "tipo": item.get("tipo", ""),
        "titulo": item.get("titulo", ""),
        "estado": item.get("estado"),
        "asignado_a": item.get("asignado_a"),
        "original_estimate": item.get("original_estimate", 0) or 0,
        "completed_work": item.get("completed_work", 0) or 0,
        "remaining_work": item.get("remaining_work", 0) or 0,
        "iteration_path": item.get("iteration_path") or "",
        "area_path": item.get("area_path") or "",
        "tags": item.get("tags") or "",
        "url": item.get("url") or "",
        "ultima_sync": marca,
    }
    return UpdateOne(
        {"org_key": org_key, "proyecto": proyecto, "azdo_id": item["azdo_id"]},
        {"$set": {**datos, "actualizado_en": marca}, "$setOnInsert": {"creado_en": marca}},
        upsert=True,
    )


async def _persistir_particion(
    items: list[dict], target: str, org_key: str, proyecto: str, marca: datetime
) -> None:
    """Un único ``bulk_write`` de upserts por partición (ADR-0008 F3.3: evita el
    N+1 de un ``save()`` por ítem)."""
    if not items:
        return
    operaciones = [
        _operacion_upsert(item, target, org_key, proyecto, marca) for item in items
    ]
    await AzdoEsquemaItem.get_pymongo_collection().bulk_write(operaciones)


async def ejecutar_sincronizacion_esquema(
    log_id: PydanticObjectId,
    org_url: str,
    pat: str,
    target: str,
    proyecto: str,
    tipos: list[str],
) -> None:
    """Ejecuta la corrida completa en segundo plano y actualiza su ``AzdoEsquemaSyncLog``.

    Marca cada documento escrito con ``ultima_sync = marca`` (instante de
    arranque). Solo si la corrida termina **sin ningún error** purga los
    documentos con ``ultima_sync < marca`` (los que Azure ya no devuelve). Si
    alguna partición falla, no se purga: una purga tras una sync parcial
    vaciaría el árbol del usuario.
    """
    org_key = normalizar_org_key(org_url)
    marca = datetime.now(UTC)
    svc = AzureDevOpsService(org_url, pat)
    contador = _ContadorParticiones()
    log = await AzdoEsquemaSyncLog.get(log_id)

    total = 0
    completadas = 0
    try:
        async with httpx.AsyncClient(timeout=120) as cliente:
            for tipo in tipos:
                ids = await _recolectar_ids_tipo(svc, cliente, proyecto, tipo, contador)
                items = await svc.obtener_lote_esquema(cliente, proyecto, ids)
                await _persistir_particion(items, target, org_key, proyecto, marca)
                total += len(items)
                completadas += 1
                if log is not None:
                    log.work_items = total
                    log.particiones_completadas = completadas
                    log.marcar_actualizado()
                    await log.save()
    except Exception as exc:  # noqa: BLE001 - se registra en el log y no se purga
        logger.warning("Fallo la sincronización de esquema AzDO: %s", exc)
        if log is not None:
            log.estado = "error"
            log.error = str(exc)[:500]
            log.finalizado_en = datetime.now(UTC)
            log.marcar_actualizado()
            await log.save()
        return

    # Corrida limpia: purga los documentos que Azure ya no devuelve.
    await AzdoEsquemaItem.find(
        {"org_key": org_key, "proyecto": proyecto, "ultima_sync": {"$lt": marca}}
    ).delete()
    if log is not None:
        log.estado = "success"
        log.work_items = total
        log.particiones_completadas = completadas
        log.finalizado_en = datetime.now(UTC)
        log.marcar_actualizado()
        await log.save()


async def preparar_corrida(
    target: str, org_key: str, proyecto: str, particiones_totales: int
) -> AzdoEsquemaSyncLog | None:
    """Crea el log ``en_curso`` respetando la guardia de concurrencia.

    Devuelve ``None`` si ya hay una corrida viva (``en_curso`` no caducada) para
    ese ``(org_key, proyecto)``. Una corrida ``en_curso`` con más de 30 minutos
    se considera muerta, se marca como ``error`` y no bloquea la nueva.
    """
    ahora = datetime.now(UTC)
    en_curso = await AzdoEsquemaSyncLog.find(
        AzdoEsquemaSyncLog.org_key == org_key,
        AzdoEsquemaSyncLog.proyecto == proyecto,
        AzdoEsquemaSyncLog.estado == "en_curso",
    ).to_list()
    for vieja in en_curso:
        iniciado = vieja.iniciado_en
        if iniciado.tzinfo is None:
            iniciado = iniciado.replace(tzinfo=UTC)
        if ahora - iniciado < CADUCIDAD:
            return None
        vieja.estado = "error"
        vieja.error = (
            "Corrida marcada como muerta: superó los 30 minutos en_curso "
            "(posible reciclado del worker de IIS)."
        )
        vieja.finalizado_en = ahora
        vieja.marcar_actualizado()
        await vieja.save()

    return await AzdoEsquemaSyncLog(
        target=target,
        org_key=org_key,
        proyecto=proyecto,
        estado="en_curso",
        particiones_totales=particiones_totales,
        iniciado_en=ahora,
    ).insert()

# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Scheduler de tareas periódicas (APScheduler): espejo de esquema de Azure DevOps,
carga automática de Solicitudes Fábrica y recálculo de squads."""
import asyncio
import logging
from datetime import UTC, datetime

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.services.azdo_esquema_sync import sincronizar_todas_las_configuraciones_con_pat
from app.services.soporte_solicitudes_fabrica_service import SoporteSolicitudesFabricaService
from app.services.vigencia import recalcular_squads_todas

_log = logging.getLogger("scheduler")
_scheduler: AsyncIOScheduler | None = None


async def _tarea_recalcular_squads_membresias() -> None:
    """Recalcula el derivado ``Persona.squads`` (ADR-0010): una membresía con ``hasta``
    futuro caduca sin que nadie escriba."""
    try:
        cambiadas = await recalcular_squads_todas()
        _log.info("[scheduler] Squads derivados recalculados: %s personas cambiaron", cambiadas)
    except Exception as exc:  # noqa: BLE001
        _log.warning("[scheduler] Recalcular squads derivados falló: %s", exc)


async def _tarea_carga_excel_solicitudes_fabrica() -> None:
    """Carga automática (cada hora en punto) del Excel de Solicitudes Fábrica desde
    la ruta local configurada en Configuración > Carga de Excel. No pide
    confirmación: carga los registros sin error y omite (dejando registrado en
    el log) los que tengan error, para que se revisen manualmente en la vista."""
    try:
        resultado = await SoporteSolicitudesFabricaService.sincronizar_automatico()
        if resultado is not None:
            _log.info(
                "[scheduler] Carga automática Solicitudes Fábrica: %s cargados, %s omitidos por error",
                resultado.get("registros_creados"),
                resultado.get("registros_omitidos"),
            )
    except Exception as exc:  # noqa: BLE001
        _log.warning("[scheduler] Carga automática Solicitudes Fábrica falló: %s", exc)


async def _tarea_sync_esquema_azdo_automatico() -> None:
    """Sincronización automática del espejo de esquema de Azure DevOps (del
    que depende Horas de Azure en Asignaciones), 2 veces al día, para toda
    AzdoConfig que ya tenga PAT configurado — independiente del campo
    sync_interval."""
    try:
        await sincronizar_todas_las_configuraciones_con_pat()
    except Exception as exc:  # noqa: BLE001
        _log.warning("[scheduler] Auto-sync de esquema AzDO falló: %s", exc)


async def _verificar_y_recuperar_carga_excel() -> None:
    """Si el proceso backend se reinició (p. ej. por reciclaje del pool de IIS
    por inactividad) y con eso se perdió el horario programado más reciente
    (el inicio de la hora actual), ejecuta la carga una sola vez al arrancar
    para autorecuperarse, en vez de esperar en silencio a la siguiente hora."""
    from app.documents.soporte_solicitud_fabrica import SoporteSolicitudFabricaSyncLog

    slot_objetivo = datetime.now(UTC).replace(minute=0, second=0, microsecond=0)

    ultimo = (
        await SoporteSolicitudFabricaSyncLog.find(SoporteSolicitudFabricaSyncLog.aplicacion_id == "__todas__")
        .sort("-iniciado_en")
        .first_or_none()
    )
    if ultimo is not None and ultimo.iniciado_en is not None and ultimo.iniciado_en.replace(tzinfo=UTC) >= slot_objetivo:
        return  # Ya se ejecutó para este horario, nada que recuperar.

    _log.info(
        "[scheduler] No se encontró carga automática de Solicitudes Fábrica para el horario %s UTC "
        "(probablemente el proceso se reinició antes de que corriera). Recuperando ahora.",
        slot_objetivo.isoformat(),
    )
    await _tarea_carga_excel_solicitudes_fabrica()


def iniciar_scheduler() -> None:
    """Arranca el scheduler. Se llama desde el lifespan de la aplicación."""
    global _scheduler
    if _scheduler is not None:
        return
    _scheduler = AsyncIOScheduler()
    _scheduler.add_job(
        _tarea_carga_excel_solicitudes_fabrica,
        "cron",
        hour="*",
        minute=0,
        id="carga_excel_solicitudes_fabrica",
        max_instances=1,
        coalesce=True,
    )
    _scheduler.add_job(
        _tarea_sync_esquema_azdo_automatico,
        "cron",
        hour="11,17",
        id="azdo_esquema_sync_automatico",
    )
    # 05:10 UTC = 00:10 en Bogotá: justo pasada la medianoche local
    _scheduler.add_job(
        _tarea_recalcular_squads_membresias,
        "cron",
        hour=5,
        minute=10,
        id="recalcular_squads_membresias",
    )
    _scheduler.start()
    _log.info("Scheduler de carga automática de Solicitudes Fábrica iniciado (cada hora en punto)")
    _log.info("Scheduler de auto-sync de esquema AzDO iniciado (6:00 y 12:00 hora Colombia)")
    asyncio.create_task(_verificar_y_recuperar_carga_excel())


def detener_scheduler() -> None:
    """Apaga el scheduler (sin esperar a que terminen los jobs en curso), si hay
    uno corriendo. Se llama desde el ``lifespan`` de ``app/main.py`` al cerrar."""
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None

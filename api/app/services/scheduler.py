"""Scheduler de auto-sincronización con Azure DevOps (APScheduler).

Cada 30 minutos revisa las aplicaciones con auto-sync activo (configuración
``azdo_sync_interval`` = hourly | daily) y sincroniza las iteraciones mapeadas
en los sprints de sus asignaciones.
"""
import asyncio
import logging
from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.documents.aplicacion import Aplicacion
from app.documents.asignacion import Asignacion
from app.documents.azdo import AzdoSyncLog
from app.services.azdo_sync import leer_config_azdo, sincronizar_iteracion
from app.services.soporte_solicitudes_fabrica_service import SoporteSolicitudesFabricaService

_log = logging.getLogger("scheduler")
_scheduler: AsyncIOScheduler | None = None

# Horarios de la carga automática de Solicitudes Fábrica en hora de Colombia
# (UTC-5, sin horario de verano) expresados en horas UTC, para poder detectar
# si el proceso se reinició y se "saltó" alguno de ellos (ver
# ``_verificar_y_recuperar_carga_excel``).
_HORAS_UTC_CARGA_EXCEL = [11, 17, 23]  # 6:00, 12:00, 18:00 hora Colombia


def _toca_sincronizar(ultima: datetime | None, intervalo: str) -> bool:
    if ultima is None:
        return True
    horas = (datetime.now(timezone.utc) - ultima).total_seconds() / 3600
    if intervalo == "hourly":
        return horas >= 1
    if intervalo == "daily":
        return horas >= 24
    return False


async def _tarea_sync_azdo() -> None:
    """Recorre las aplicaciones y sincroniza las que tengan auto-sync pendiente."""
    apps = await Aplicacion.find(Aplicacion.activa == True).to_list()  # noqa: E712
    for app in apps:
        intervalo = await leer_config_azdo(app.codigo, "azdo_sync_interval", "manual")
        if intervalo == "manual":
            continue
        ultimo = (
            await AzdoSyncLog.find(AzdoSyncLog.aplicacion_id == app.codigo)
            .sort("-iniciado_en")
            .first_or_none()
        )
        if not _toca_sincronizar(ultimo.iniciado_en if ultimo else None, intervalo):
            continue

        # Las iteraciones a sincronizar viven en los mapeos AzDO de los sprints.
        asignaciones = await Asignacion.find(Asignacion.aplicacion_id == app.codigo).to_list()
        vistos: set[tuple[str, str]] = set()
        for asig in asignaciones:
            for proyecto in asig.proyectos:
                for sprint in proyecto.sprints:
                    mapping = sprint.azdo_mapping
                    if mapping is None:
                        continue
                    clave = (mapping.azdo_project, mapping.iteration_path)
                    if clave in vistos:
                        continue
                    vistos.add(clave)
                    try:
                        await sincronizar_iteracion(app.codigo, clave[0], clave[1])
                    except Exception as exc:  # noqa: BLE001
                        _log.warning("[scheduler] sync AzDO falló (%s): %s", app.codigo, exc)


async def _tarea_carga_excel_solicitudes_fabrica() -> None:
    """Carga automática (3 veces al día) del Excel de Solicitudes Fábrica desde
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


async def _verificar_y_recuperar_carga_excel() -> None:
    """Si el proceso backend se reinició (p. ej. por reciclaje del pool de IIS
    por inactividad) y con eso se perdió el horario programado más reciente
    (6:00, 12:00 o 18:00 hora Colombia), ejecuta la carga una sola vez al
    arrancar para autorecuperarse, en vez de esperar en silencio al siguiente
    horario."""
    from app.documents.soporte_solicitud_fabrica import SoporteSolicitudFabricaSyncLog

    ahora_utc = datetime.now(timezone.utc)
    hoy = ahora_utc.date()
    slot_objetivo: datetime | None = None
    for h in sorted(_HORAS_UTC_CARGA_EXCEL, reverse=True):
        candidato = datetime(hoy.year, hoy.month, hoy.day, h, 0, 0, tzinfo=timezone.utc)
        if candidato <= ahora_utc:
            slot_objetivo = candidato
            break
    if slot_objetivo is None:
        return  # Todavía no ha pasado ningún horario programado hoy.

    ultimo = (
        await SoporteSolicitudFabricaSyncLog.find(SoporteSolicitudFabricaSyncLog.aplicacion_id == "__todas__")
        .sort("-iniciado_en")
        .first_or_none()
    )
    if ultimo is not None and ultimo.iniciado_en is not None and ultimo.iniciado_en.replace(tzinfo=timezone.utc) >= slot_objetivo:
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
    _scheduler.add_job(_tarea_sync_azdo, "interval", minutes=30, id="azdo_sync")
    _scheduler.add_job(
        _tarea_carga_excel_solicitudes_fabrica,
        "cron",
        hour="6,12,18",
        id="carga_excel_solicitudes_fabrica",
    )
    _scheduler.start()
    _log.info("Scheduler de Azure DevOps iniciado (revisión cada 30 min)")
    _log.info("Scheduler de carga automática de Solicitudes Fábrica iniciado (6:00, 12:00 y 18:00)")
    asyncio.create_task(_verificar_y_recuperar_carga_excel())


def detener_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None

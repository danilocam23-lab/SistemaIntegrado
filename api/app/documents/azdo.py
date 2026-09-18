# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Colecciones operativas: integración con Azure DevOps."""
from datetime import datetime

from pymongo import ASCENDING, DESCENDING, IndexModel

from app.documents.base import DocumentoBase, DocumentoOperativo


class AzdoWorkItem(DocumentoOperativo):
    """Work item de Azure DevOps sincronizado a la plataforma."""

    azdo_id: int
    asignacion_id: str | None = None
    proyecto_id: str | None = None
    sprint_id: str | None = None
    persona_id: str | None = None
    tipo: str
    titulo: str
    estado: str | None = None
    asignado_a: str | None = None
    original_estimate: float = 0
    completed_work: float = 0
    remaining_work: float = 0
    fecha_inicio: datetime | None = None
    iteration_path: str | None = None
    area_path: str | None = None
    tags: str | None = None
    url: str | None = None
    ultima_sync: datetime | None = None

    class Settings:
        name = "azdo_work_items"
        indexes = [
            IndexModel(
                [("aplicacion_id", ASCENDING), ("azdo_id", ASCENDING)], unique=True, name="uq_app_azdo_id"
            )
        ]


class AzdoSyncLog(DocumentoOperativo):
    """Registro histórico de una sincronización con Azure DevOps."""

    sprint_id: str | None = None
    estado: str
    work_items: int = 0
    total_completado: float = 0
    total_restante: float = 0
    total_original: float = 0
    error: str | None = None
    iniciado_en: datetime
    finalizado_en: datetime | None = None

    class Settings:
        name = "azdo_sync_log"
        indexes = [IndexModel([("aplicacion_id", ASCENDING), ("sprint_id", ASCENDING)], name="ix_app_sprint")]


class AzdoEsquemaItem(DocumentoBase):
    """Espejo sincronizado del árbol de esquema de un proyecto de Azure DevOps.

    A diferencia de ``AzdoWorkItem``, esta colección **no** hereda de
    ``DocumentoOperativo`` y por tanto **no lleva ``aplicacion_id``**. Es
    deliberado y correcto, no un fallo de aislamiento:

    * El espejo refleja Azure DevOps (un mismo proyecto compartido por todos los
      squads), no datos de un tenant. La clave de identidad es
      ``(org_key, proyecto, azdo_id)``.
    * El aislamiento entre squads en esta funcionalidad lo da el filtro por
      iteraciones permitidas (``_iteraciones_permitidas_contexto`` +
      ``_iteracion_habilitada`` en el router), ya implementado y probado, no la
      partición por tenant.
    * Si la clave llevara ``aplicacion_id`` habría una asimetría fatal: en modo
      consolidado la config se resuelve a la *primera* aplicación con
      configuración (p. ej. ``1``/CRM), así que la sync guardaría bajo ``1``;
      pero un usuario en modo operativo sobre ``2``/XRM resolvería
      ``aplicacion_id="2"`` y no encontraría nada. Escribir y leer por
      ``(org_key, proyecto)`` elimina esa asimetría.

    Vive en una colección propia (``azdo_esquema_items``), no en
    ``azdo_work_items``, para que borrar una Persona
    (``AzdoWorkItem.find(persona_id == ...).delete()`` en ``personas.py``) no
    abra agujeros en el árbol jerárquico del esquema.
    """

    target: str  # "hitss" | "epm"
    org_key: str  # org_url normalizada (minúsculas, sin barra final)
    proyecto: str
    azdo_id: int
    parent_id: int | None = None
    tipo: str
    titulo: str
    estado: str | None = None
    asignado_a: str | None = None
    original_estimate: float = 0
    completed_work: float = 0
    remaining_work: float = 0
    iteration_path: str = ""
    area_path: str = ""
    tags: str = ""
    url: str = ""
    ultima_sync: datetime

    class Settings:
        name = "azdo_esquema_items"
        indexes = [
            IndexModel(
                [("org_key", ASCENDING), ("proyecto", ASCENDING), ("azdo_id", ASCENDING)],
                unique=True,
                name="uq_orgkey_proyecto_azdo_id",
            ),
            IndexModel(
                [("org_key", ASCENDING), ("proyecto", ASCENDING), ("iteration_path", ASCENDING)],
                name="ix_orgkey_proyecto_iteration",
            ),
            IndexModel(
                [("org_key", ASCENDING), ("proyecto", ASCENDING), ("parent_id", ASCENDING)],
                name="ix_orgkey_proyecto_parent",
            ),
        ]


class AzdoEsquemaSyncLog(DocumentoBase):
    """Estado de una corrida de sincronización del espejo de esquema.

    Documento propio (no ``AzdoSyncLog``) por dos razones: ``AzdoSyncLog``
    hereda de ``DocumentoOperativo`` (exige ``aplicacion_id``, justo lo que este
    espejo evita, ver ``AzdoEsquemaItem``) y su forma es específica de la sync
    por sprint (``sprint_id``, totales de horas). Aquí la identidad de la corrida
    es ``(org_key, proyecto)`` y el progreso se mide en particiones.
    """

    target: str
    org_key: str
    proyecto: str
    estado: str  # "en_curso" | "success" | "error"
    work_items: int = 0
    particiones_completadas: int = 0
    particiones_totales: int = 0
    error: str | None = None
    iniciado_en: datetime
    finalizado_en: datetime | None = None

    class Settings:
        name = "azdo_esquema_sync_log"
        indexes = [
            IndexModel(
                [("org_key", ASCENDING), ("proyecto", ASCENDING), ("iniciado_en", DESCENDING)],
                name="ix_orgkey_proyecto_iniciado_desc",
            ),
        ]

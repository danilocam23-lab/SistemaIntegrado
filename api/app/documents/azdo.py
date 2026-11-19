# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Colecciones operativas: integración con Azure DevOps."""
from datetime import datetime

from pymongo import ASCENDING, DESCENDING, IndexModel

from app.documents.base import DocumentoBase


class AzdoEsquemaItem(DocumentoBase):
    """Espejo sincronizado del árbol de esquema de un proyecto de Azure DevOps.

    A diferencia de las colecciones operativas, esta colección **no** hereda de
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

    Vive en una colección propia (``azdo_esquema_items``), independiente de las
    personas, para que borrar una Persona no abra agujeros en el árbol jerárquico.
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
    fecha_inicio: datetime | None = None
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
            IndexModel(
                [
                    ("org_key", ASCENDING),
                    ("proyecto", ASCENDING),
                    ("parent_id", ASCENDING),
                    ("tipo", ASCENDING),
                ],
                name="ix_orgkey_proyecto_parent_tipo",
            ),
        ]


class AzdoEsquemaSyncLog(DocumentoBase):
    """Estado de una corrida de sincronización del espejo de esquema.

    Documento propio, sin ``aplicacion_id`` (ver ``AzdoEsquemaItem``): la identidad
    de la corrida es ``(org_key, proyecto)`` y el progreso se mide en particiones.
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

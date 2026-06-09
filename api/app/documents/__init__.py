"""Modelos Beanie (colecciones MongoDB).

``ALL_DOCUMENTS`` es la lista que recibe ``init_beanie``.
"""
from app.documents.acta_trabajo import ActaTrabajo
from app.documents.aplicacion import Aplicacion
from app.documents.aplicativo import Aplicativo
from app.documents.asignacion import Asignacion
from app.documents.azdo import AzdoSyncLog, AzdoWorkItem
from app.documents.azdo_config import AzdoConfig
from app.documents.bitacora import Bitacora
from app.documents.capacidad import Capacidad
from app.documents.categoria import Categoria
from app.documents.configuracion import Configuracion
from app.documents.estimacion import Estimacion
from app.documents.festivo import Festivo
from app.documents.orden_compra import OrdenCompra
from app.documents.persona import Persona
from app.documents.requerimiento import Requerimiento
from app.documents.squad import Squad
from app.documents.tarifa import Tarifa
from app.documents.usuario import Usuario

ALL_DOCUMENTS = [
    # Plataforma
    Aplicacion,
    Usuario,
    # Operativas — base
    Persona,
    Categoria,
    Configuracion,
    Bitacora,
    # Operativas — dominio de liquidación (Fase 3)
    Aplicativo,
    Squad,
    Tarifa,
    Festivo,
    ActaTrabajo,
    OrdenCompra,
    Requerimiento,
    # Operativas — dominio de carga de trabajo (Fase 4)
    Asignacion,
    Capacidad,
    Estimacion,
    AzdoWorkItem,
    AzdoSyncLog,
    AzdoConfig,
]

__all__ = [
    "ALL_DOCUMENTS",
    "Aplicacion",
    "Usuario",
    "Persona",
    "Categoria",
    "Configuracion",
    "Bitacora",
    "Aplicativo",
    "Squad",
    "Tarifa",
    "Festivo",
    "ActaTrabajo",
    "OrdenCompra",
    "Requerimiento",
    "Asignacion",
    "Capacidad",
    "Estimacion",
    "AzdoWorkItem",
    "AzdoSyncLog",
    "AzdoConfig",
]

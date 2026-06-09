"""Colección operativa: configuración de Azure DevOps.

Almacena la conexión a Azure DevOps (org URL, PAT, proyecto por defecto)
con soporte opcional por Squad y/o Usuario.
"""
from pymongo import ASCENDING, IndexModel

from app.documents.base import DocumentoOperativo


class AzdoConfig(DocumentoOperativo):
    """Configuración de conexión a Azure DevOps.

    El campo ``scope`` determina el nivel de la configuración:
    - ``"app"`` → configuración global de la aplicación (por defecto)
    - ``"squad"`` → configuración específica de un squad
    - ``"user"`` → configuración específica de un usuario

    La resolución es jerárquica: user > squad > app.
    """

    scope: str = "app"  # "app" | "squad" | "user"
    squad_id: str | None = None
    usuario_id: str | None = None

    # Conexión
    org_url: str = ""
    pat: str = ""
    default_project: str = ""
    sync_interval: str = "manual"  # "manual" | "hourly" | "daily"

    # Campos requeridos descubiertos (campo_ref → valor por defecto)
    learned_fields: dict[str, dict] | None = None

    class Settings:
        name = "azdo_config"
        indexes = [
            IndexModel(
                [
                    ("aplicacion_id", ASCENDING),
                    ("scope", ASCENDING),
                    ("squad_id", ASCENDING),
                    ("usuario_id", ASCENDING),
                ],
                unique=True,
                name="uq_app_scope_squad_user",
            )
        ]

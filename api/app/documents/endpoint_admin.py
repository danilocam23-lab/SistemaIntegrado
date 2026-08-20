"""Colección de plataforma: catálogo administrable de endpoints documentados."""
from pymongo import ASCENDING, IndexModel

from app.documents.base import DocumentoBase


class EndpointAdmin(DocumentoBase):
    """Entrada del catálogo de endpoints gestionado desde /admin/endpoints.

    Es una colección global de plataforma (no pertenece a una aplicación/tenant),
    igual que ``Rol``: documenta rutas de la API y puede editarse en caliente
    desde la interfaz de administración sin requerir un despliegue.
    """

    modulo: str
    metodo: str
    ruta: str
    descripcion: str = ""
    parametros: str = ""
    cuerpo: str = ""
    permisos: str = ""
    activo: bool = True

    class Settings:
        name = "endpoints_admin"
        indexes = [IndexModel([("modulo", ASCENDING), ("ruta", ASCENDING)], name="ix_modulo_ruta")]

"""Resolución de la aplicación activa (aislamiento multi-tenant).

Cada petición a recursos operativos debe traer la cabecera ``X-Aplicacion``:

* un código de aplicación  -> modo operativo (lectura y escritura)
* el centinela ``__todas__`` -> modo consolidado (solo lectura, roles admin)
"""
from fastapi import Depends, Header, HTTPException, status

from app.documents.aplicacion import Aplicacion
from app.documents.enums import ROLES_ADMIN, RolUsuario
from app.documents.usuario import Usuario
from app.security.deps import usuario_actual

CONSOLIDADO = "__todas__"


class ContextoAplicacion:
    """Aplicación(es) sobre las que opera la petición."""

    def __init__(self, codigos: list[str], modo_consolidado: bool, nombre_app: str | None = None) -> None:
        self.codigos = codigos
        self.modo_consolidado = modo_consolidado
        self.nombre_app = nombre_app

    @property
    def codigo(self) -> str:
        """Código único (solo válido en modo operativo)."""
        return self.codigos[0]

    def filtro(self) -> dict:
        """Filtro Mongo para aplicar ``aplicacion_id`` en los repositorios."""
        if self.modo_consolidado:
            return {"aplicacion_id": {"$in": self.codigos}}
        return {"aplicacion_id": self.codigos[0]}

    def filtro_con_squad(self) -> dict:
        """Filtro Mongo para colecciones con campo ``squads`` (lista, ej. Persona).

        Filtra únicamente por ``aplicacion_id``: el aislamiento multi-tenant ya
        garantiza que solo se devuelven registros del contexto correcto, sin
        descartar personas que no tengan ningún squad asignado.
        """
        return self.filtro()


async def _codigos_autorizados(usuario: Usuario) -> list[str]:
    """Códigos de aplicación a los que el usuario tiene acceso.

    El superadmin ve todas las aplicaciones activas; el resto, solo las asignadas.
    """
    if usuario.rol == RolUsuario.SUPERADMIN:
        apps = await Aplicacion.find(Aplicacion.activa == True).to_list()  # noqa: E712
        return [a.codigo for a in apps]
    return list(usuario.aplicaciones_codigos)


async def contexto_aplicacion(
    x_aplicacion: str | None = Header(default=None, alias="X-Aplicacion"),
    usuario: Usuario = Depends(usuario_actual),
) -> ContextoAplicacion:
    """Dependencia: resuelve y valida la aplicación activa."""
    autorizadas = await _codigos_autorizados(usuario)
    if not x_aplicacion:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Falta la cabecera X-Aplicacion")

    if x_aplicacion == CONSOLIDADO:
        if usuario.rol not in ROLES_ADMIN:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                "El modo consolidado solo está disponible para roles de administración",
            )
        if not autorizadas:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Sin aplicaciones autorizadas")
        return ContextoAplicacion(autorizadas, modo_consolidado=True)

    if x_aplicacion not in autorizadas:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Sin acceso a esa aplicación")
    app = await Aplicacion.find_one(Aplicacion.codigo == x_aplicacion)
    nombre = app.nombre if app else None
    return ContextoAplicacion([x_aplicacion], modo_consolidado=False, nombre_app=nombre)


async def contexto_escritura(
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
) -> ContextoAplicacion:
    """Como ``contexto_aplicacion`` pero rechaza el modo consolidado (solo lectura)."""
    if ctx.modo_consolidado:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "El modo consolidado es de solo lectura; seleccione una aplicación concreta",
        )
    return ctx

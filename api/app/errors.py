"""Excepciones de dominio y manejo centralizado de errores (ADR-0008 F2.6).

Antes de esto, cada router repetía su propio ``try/except ValueError ->
HTTPException(400, str(exc))`` (E1 del ADR: 10 copias idénticas) y algunos
puntos devolvían el texto crudo de una excepción de bajo nivel al cliente
(E4: ``soporte.py``/``azdo.py`` con ``str(exc)``), exponiendo detalles
internos (URLs de OneDrive, mensajes de la API de Azure DevOps, rutas de
archivo del servidor).

Las jerarquía de aquí reemplaza ese patrón: los routers y servicios lanzan
una de estas excepciones con un mensaje ya pensado para el usuario final, y
el handler global registrado en ``app/main.py`` se encarga de mapearla al
código HTTP y al cuerpo de respuesta uniforme ``{"detail", "error_id"}``.

``ValueError`` crudo (todavía el más usado en ``services/``, no migrado por
completo en esta ola) sigue funcionando: hay un handler global aparte que lo
traduce a 400 con el mismo mensaje, porque en este backend todo ``ValueError``
que llega hasta el router fue escrito deliberadamente como mensaje de
negocio (nunca envuelve una excepción de bajo nivel sin traducir).
"""


class ErrorDominio(Exception):
    """Excepción base de una regla de negocio violada.

    ``mensaje`` es siempre texto seguro para mostrar al usuario final: quien
    lanza ``ErrorDominio`` (o una subclase) es responsable de no incluir en
    ``mensaje`` ningún detalle interno (traceback, ruta de servidor, URL con
    credenciales, cuerpo crudo de una API externa). Ese detalle interno, si
    existe, se registra aparte con ``logger.exception``/``logger.error`` en el
    sitio donde se captura la excepción original, nunca se pasa a
    ``ErrorDominio``.
    """

    status_code: int = 400

    def __init__(self, mensaje: str, *, status_code: int | None = None) -> None:
        super().__init__(mensaje)
        self.mensaje = mensaje
        if status_code is not None:
            self.status_code = status_code


class NoEncontrado(ErrorDominio):
    """El recurso solicitado no existe (o no es visible para esta aplicación)."""

    status_code = 404


class Conflicto(ErrorDominio):
    """La operación no es válida en el estado actual del recurso/servidor."""

    status_code = 409


class EntradaInvalida(ErrorDominio):
    """Un parámetro de la petición no es válido (p. ej. no referencia nada real).

    Distinto de los 422 automáticos de Pydantic (que validan *forma*): esto es
    para cuando la forma es correcta pero el valor no existe en el dominio
    (ADR-0008 E6, p. ej. ``aplicacion`` en ``/api/integracion/*``).
    """

    status_code = 422


class ErrorIntegracion(ErrorDominio):
    """Fallo de un sistema externo (Azure DevOps, OneDrive/SharePoint, ...).

    El mensaje debe ser neutro ("No se pudo conectar con Azure DevOps"), sin
    el cuerpo de la respuesta de la API externa ni la URL exacta: eso va al
    log con ``logger.exception``/``exc_info`` en el punto donde se atrapó la
    excepción original (``httpx.HTTPError``, ``RuntimeError``, ...).
    """

    status_code = 502

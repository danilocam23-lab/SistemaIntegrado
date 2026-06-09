"""Emisión y validación de tokens JWT."""
from datetime import timedelta

from jose import JWTError, jwt

from app.config import get_settings
from app.documents.base import ahora


def crear_token(usuario_id: str, rol: str) -> str:
    """Genera un JWT firmado para el usuario indicado."""
    settings = get_settings()
    expira = ahora() + timedelta(minutes=settings.jwt_expira_minutos)
    payload = {"sub": str(usuario_id), "rol": rol, "exp": expira}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algoritmo)


def decodificar_token(token: str) -> dict | None:
    """Devuelve el payload del token, o ``None`` si es inválido o expiró."""
    settings = get_settings()
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algoritmo])
    except JWTError:
        return None

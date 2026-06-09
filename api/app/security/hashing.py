"""Hashing y verificación de contraseñas con bcrypt.

Se usa la librería ``bcrypt`` directamente; passlib quedó sin mantenimiento y es
incompatible con bcrypt 4.x. bcrypt solo considera los primeros 72 bytes de la
contraseña, por eso se trunca de forma explícita para evitar el error de longitud.
"""
import bcrypt

_LIMITE_BYTES = 72


def hash_password(password: str) -> str:
    secreto = password.encode("utf-8")[:_LIMITE_BYTES]
    return bcrypt.hashpw(secreto, bcrypt.gensalt()).decode("utf-8")


def verificar_password(password: str, password_hash: str) -> bool:
    try:
        secreto = password.encode("utf-8")[:_LIMITE_BYTES]
        return bcrypt.checkpw(secreto, password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        # Hash no válido (p. ej. usuarios migrados con hash SHA-256): no autentica.
        return False

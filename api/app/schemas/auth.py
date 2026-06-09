"""Esquemas de autenticación."""
from pydantic import BaseModel


class LoginIn(BaseModel):
    email: str
    password: str


class UsuarioOut(BaseModel):
    id: str
    nombre: str
    email: str
    rol: str
    activo: bool
    aplicaciones_codigos: list[str]
    permisos: list[str]


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    usuario: UsuarioOut

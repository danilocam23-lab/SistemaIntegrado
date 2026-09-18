# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Esquemas de autenticación."""
from pydantic import BaseModel


class LoginIn(BaseModel):
    """Credenciales de inicio de sesión."""

    email: str
    password: str


class UsuarioOut(BaseModel):
    """Usuario autenticado, con su rol y permisos ya resueltos, tal como lo
    consume el frontend (``AuthContext``)."""

    id: str
    nombre: str
    email: str
    rol: str
    rol_id: str | None = None
    rol_nombre: str | None = None
    activo: bool
    aplicaciones_codigos: list[str]
    permisos: list[str]


class TokenOut(BaseModel):
    """Respuesta de ``POST /api/auth/login``: el JWT y el usuario autenticado."""

    access_token: str
    token_type: str = "bearer"
    usuario: UsuarioOut

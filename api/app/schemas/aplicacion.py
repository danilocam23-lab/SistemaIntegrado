# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Esquemas del módulo de administración de aplicaciones."""
import re

from pydantic import BaseModel, field_validator

PATRON_CODIGO = re.compile(r"^[a-z0-9][a-z0-9_-]{1,31}$")


class AplicacionIn(BaseModel):
    """Datos para dar de alta una aplicación (tenant) nueva."""

    codigo: str
    nombre: str
    descripcion: str = ""
    iteraciones: str = ""

    @field_validator("codigo")
    @classmethod
    def _validar_codigo(cls, valor: str) -> str:
        """Normaliza (strip + minúsculas) y valida el código del squad."""
        codigo = valor.strip().lower()
        if codigo.startswith("__"):
            raise ValueError("El código no puede empezar por '__' (prefijo reservado)")
        if not PATRON_CODIGO.fullmatch(codigo):
            raise ValueError(
                "Código inválido: use de 2 a 32 caracteres en minúsculas, dígitos, '-' o '_', "
                "empezando por letra o dígito"
            )
        return codigo


class AplicacionUpdate(BaseModel):
    """Campos editables de una aplicación existente; todos opcionales."""

    nombre: str | None = None
    descripcion: str | None = None
    iteraciones: str | None = None


class EstadoIn(BaseModel):
    """Activa o desactiva una aplicación."""

    activa: bool


class AplicacionOut(BaseModel):
    """Aplicación tal como se devuelve al cliente."""

    id: str
    codigo: str
    nombre: str
    descripcion: str
    iteraciones: str
    activa: bool
    creada_por: str | None = None

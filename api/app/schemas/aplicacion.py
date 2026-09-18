# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Esquemas del módulo de administración de aplicaciones."""
from pydantic import BaseModel


class AplicacionIn(BaseModel):
    """Datos para dar de alta una aplicación (tenant) nueva."""

    codigo: str
    nombre: str
    descripcion: str = ""
    iteraciones: str = ""


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

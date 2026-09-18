# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Colección de plataforma: aplicaciones (tenants)."""
from pymongo import ASCENDING, IndexModel

from app.documents.base import DocumentoBase


class Aplicacion(DocumentoBase):
    """Una aplicación (tenant) de la plataforma: CRM, BI, Soporte, EPM-HITSS, ..."""

    codigo: str
    nombre: str
    descripcion: str = ""
    iteraciones: str = ""
    activa: bool = True
    creada_por: str | None = None

    def iteraciones_lista(self) -> list[str]:
        """Devuelve las rutas de iteración normalizadas, sin vacíos ni duplicados."""
        rutas: list[str] = []
        vistas: set[str] = set()
        for linea in self.iteraciones.splitlines():
            for parte in linea.split(";"):
                ruta = parte.strip()
                if ruta and ruta not in vistas:
                    rutas.append(ruta)
                    vistas.add(ruta)
        return rutas

    class Settings:
        name = "aplicaciones"
        indexes = [IndexModel([("codigo", ASCENDING)], unique=True, name="uq_codigo")]

// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import client from '../../api/client'

/**
 * Desactiva a la persona con fecha de efecto (el backend cierra en cascada los squads que
 * siguen abiertos). PUT parcial: solo viaja lo indicado; `squads` no se envía a propósito.
 */
export async function desactivarPersona(personaId: string, nombre: string, fechaEfecto: string): Promise<void> {
  await client.put(`/personas/${personaId}`, {
    nombre,
    activo: false,
    fecha_efecto_desactivacion: fechaEfecto,
  })
}

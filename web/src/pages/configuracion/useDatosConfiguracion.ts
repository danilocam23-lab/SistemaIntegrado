// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useLista } from '../../api/hooks'
import type { Configuracion as Config } from '../../types'

export function useDatosConfiguracion() {
  // INVARIANTE 2: una sola useLista('/configuracion'); datos y recargar se inyectan a las secciones.
  return useLista<Config>('/configuracion')
}

export type DatosConfiguracionState = ReturnType<typeof useDatosConfiguracion>

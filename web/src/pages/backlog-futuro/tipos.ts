// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

export interface FormState {
  id: string | null
  nombreIniciativa: string
  tipoDemanda: string
  squadId: string
  horasAproximadas: string
  fechaTentativaInicio: string
  estado: string
  volvioActa: boolean
  actaId: string
  responsableId: string
}

export const FORM_VACIO: FormState = {
  id: null,
  nombreIniciativa: '',
  tipoDemanda: '',
  squadId: '',
  horasAproximadas: '',
  fechaTentativaInicio: '',
  estado: 'PENDIENTE',
  volvioActa: false,
  actaId: '',
  responsableId: '',
}

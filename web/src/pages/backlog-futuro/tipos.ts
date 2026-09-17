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

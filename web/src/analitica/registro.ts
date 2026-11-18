// Registro propio de uso (auditoría interna). Cola en memoria con envío por lotes.
// Fábrica pura e inyectable: sin red, almacenamiento ni temporizadores reales (ver index.ts).
// Nunca lanza hacia la aplicación y no reintenta indefinidamente.
//
// Atribución: cada entrada guarda, al agregarse, la aplicación activa y la clave seudónima de
// la sesión. Al enviar se agrupa por aplicación (un POST por grupo) y solo viajan las entradas
// cuya sesión sigue siendo la vigente; las demás se descartan (nunca se reatribuyen).

export interface EventoUso {
  /** Id corto único por evento (sin PII); permite idempotencia en el backend. */
  id?: string
  event: string
  screen?: string
  module?: string
  interaction_id?: string
  action_name?: string
  /** Duración en ms (entero, 0–86400000), p. ej. de app_screen_engagement. */
  duracion_ms?: number
  ts: string
}

interface EntornoRegistro {
  /** Envía un lote de UNA aplicación y devuelve el estado HTTP. Debe rechazar ante fallo de red. */
  enviar: (eventos: EventoUso[], keepalive: boolean, aplicacion: string | null) => Promise<number>
  /** Aplicación activa (X-Aplicacion) en este instante. */
  aplicacionActual: () => string | null
  /** Clave seudónima de la sesión vigente (nunca el token); null si no hay sesión. */
  sesionActual: () => string | null
  programar: (accion: () => void, ms: number) => unknown
  cancelar: (id: unknown) => void
}

interface Entrada {
  evento: EventoUso
  intentos: number
  aplicacion: string | null
  sesion: string | null
}

export const LOTE_MAXIMO = 50
export const UMBRAL_ENVIO = 20
export const INTERVALO_ENVIO_MS = 10_000
export const COLA_MAXIMA = 200
export const INTENTOS_MAXIMOS = 2

export function crearRegistroUso(entorno: EntornoRegistro) {
  let cola: Entrada[] = []
  let temporizador: unknown = null
  let enVuelo = false

  function detener() {
    if (temporizador === null) return
    entorno.cancelar(temporizador)
    temporizador = null
  }

  function programar() {
    if (temporizador !== null || cola.length === 0) return
    temporizador = entorno.programar(() => { temporizador = null; void vaciar() }, INTERVALO_ENVIO_MS)
  }

  /** Separa las entradas de la sesión vigente y agrupa por aplicación, en lotes de LOTE_MAXIMO. */
  function prepararLotes(entradas: Entrada[]): Entrada[][] {
    const sesion = entorno.sesionActual()
    if (sesion === null) return []
    const grupos = new Map<string | null, Entrada[]>()
    for (const entrada of entradas) {
      if (entrada.sesion !== sesion) continue // otro usuario/token: se descarta, no se reatribuye
      const grupo = grupos.get(entrada.aplicacion)
      if (grupo) grupo.push(entrada)
      else grupos.set(entrada.aplicacion, [entrada])
    }
    const lotes: Entrada[][] = []
    for (const grupo of grupos.values()) {
      for (let i = 0; i < grupo.length; i += LOTE_MAXIMO) lotes.push(grupo.slice(i, i + LOTE_MAXIMO))
    }
    return lotes
  }

  async function enviarLote(lote: Entrada[], urgente: boolean) {
    let estado: number | null = null
    try {
      estado = await entorno.enviar(lote.map(entrada => entrada.evento), urgente, lote[0].aplicacion)
    } catch { estado = null }
    if (estado !== null && estado >= 200 && estado < 300) return
    // 429 (límite por usuario) y demás 4xx: el lote se descarta sin reintento ni bucles.
    const reintentable = estado === null || estado >= 500 || estado === 408
    if (urgente || !reintentable) return
    // Un único reintento por evento; luego se descarta.
    const volver = lote.filter(entrada => ++entrada.intentos < INTENTOS_MAXIMOS)
    cola = [...volver, ...cola].slice(-COLA_MAXIMA)
  }

  /** `urgente`: descarga de página, logout o cambio de aplicación/usuario; keepalive y sin reintentos. */
  function vaciar(urgente = false): Promise<void> {
    detener()
    if (cola.length === 0) return Promise.resolve()
    if (urgente) {
      const lotes = prepararLotes(cola)
      cola = []
      for (const lote of lotes) void enviarLote(lote, true)
      return Promise.resolve()
    }
    if (enVuelo) { programar(); return Promise.resolve() }
    const lotes = prepararLotes(cola)
    cola = []
    if (lotes.length === 0) return Promise.resolve()
    enVuelo = true
    const enviarTodos = async () => { for (const lote of lotes) await enviarLote(lote, false) }
    return enviarTodos().finally(() => {
      enVuelo = false
      if (cola.length >= UMBRAL_ENVIO) void vaciar()
      else programar()
    })
  }

  return {
    agregar(evento: EventoUso) {
      cola.push({
        evento, intentos: 0,
        aplicacion: entorno.aplicacionActual(), sesion: entorno.sesionActual(),
      })
      if (cola.length > COLA_MAXIMA) cola.splice(0, cola.length - COLA_MAXIMA)
      if (cola.length >= UMBRAL_ENVIO) void vaciar()
      else programar()
    },
    vaciar,
    descartar() { cola = []; detener() },
    pendientes: () => cola.length,
  }
}

export type RegistroUso = ReturnType<typeof crearRegistroUso>

// Ejecutar desde web; datos sintéticos, sin navegador, red ni dependencias nuevas.
// Verifica la detección de ediciones concurrentes del detalle de requerimiento.
import assert from 'node:assert/strict'
import { cargarTypeScript } from './cargar-typescript.mjs'

const rutaHook = new URL('../src/pages/requerimiento-detalle/useRequerimientoDetalle.ts', import.meta.url)
const copiar = valor => JSON.parse(JSON.stringify(valor))
const evento = () => ({ preventDefault() {} })
const esperar = () => new Promise(resolve => setImmediate(resolve))

const reqInicial = {
  id: 'id-prueba', codigo_req: 'REQ-PRUEBA', aplicacion_id: 'squad-prueba',
  nombre: 'Nombre', estado: 'ACTIVO', solicitud: { codigo_sc: 'SC-1' }, entregas: [],
  actualizado_en: '2026-11-20T10:00:00',
}

async function montarHook({ errorPut = null, marcaPatch = '2026-11-20T10:05:00' } = {}) {
  const estados = []
  const efectos = []
  const llamadas = []
  let cursor = 0
  let primera = true
  const transporte = {
    async get(url) {
      llamadas.push({ metodo: 'GET', url })
      if (url.startsWith('/bitacora')) return { data: [] }
      return { data: url.endsWith('/liquidacion') ? { total: 0 } : copiar(reqInicial) }
    },
    async patch(url, cuerpo) {
      llamadas.push({ metodo: 'PATCH', url, cuerpo: copiar(cuerpo) })
      return { data: { ...copiar(reqInicial), nombre: 'No reemplazar', actualizado_en: marcaPatch } }
    },
    async put(url, cuerpo) {
      llamadas.push({ metodo: 'PUT', url, cuerpo: copiar(cuerpo) })
      if (errorPut) throw errorPut
      return { data: {} }
    },
  }
  const { useRequerimientoDetalle } = cargarTypeScript(rutaHook, {}, {
    react: {
      useState(inicial) {
        const indice = cursor++
        if (!(indice in estados)) estados[indice] = typeof inicial === 'function' ? inicial() : inicial
        return [estados[indice], nuevo => {
          estados[indice] = typeof nuevo === 'function' ? nuevo(estados[indice]) : nuevo
        }]
      },
      useCallback: funcion => funcion,
      useEffect: efecto => { if (primera) efectos.push(efecto) },
    },
    '../../api/client': { default: transporte },
    '../../api/hooks': { mensajeError: error => error.message },
    '../../analitica': { analitica: { prepararEnvioFormulario: () => () => {} } },
  })
  const opciones = {
    modoConsolidado: false, puedeEditarReq: true, puedeEditarTipificacion: true,
    puedeVerHorasSiguienteAnio: true, puedeEditarHorasSiguienteAnio: true,
  }
  function leer() {
    cursor = 0
    const resultado = useRequerimientoDetalle('REQ-PRUEBA', opciones)
    primera = false
    return resultado
  }
  leer()
  efectos.forEach(efecto => efecto())
  await esperar()
  return { leer, llamadas }
}

const cuentaGetReq = llamadas => llamadas.filter(l => l.metodo === 'GET' && l.url === '/requerimientos/REQ-PRUEBA').length

// (1) El PUT envía actualizado_en leído al cargar.
{
  const p = await montarHook()
  await p.leer().guardar(evento())
  const put = p.llamadas.find(l => l.metodo === 'PUT')
  assert.ok(put, 'Se envía el PUT')
  assert.equal(put.cuerpo.actualizado_en, reqInicial.actualizado_en, 'El PUT incluye actualizado_en del cliente')
  console.log('OK: guardar envía actualizado_en en el PUT.')
}

// (2) Un 409 no recarga solo, muestra el mensaje y expone hayConflicto; el botón recarga.
{
  const error409 = Object.assign(new Error('El requerimiento fue modificado por otra persona; recarga'), {
    response: { status: 409 },
  })
  const p = await montarHook({ errorPut: error409 })
  const antes = cuentaGetReq(p.llamadas)
  await p.leer().guardar(evento())
  await esperar()
  const detalle = p.leer()
  assert.equal(detalle.hayConflicto, true, 'Expone hayConflicto')
  assert.match(detalle.aviso, /modificado por otra persona/, 'Muestra el mensaje del servidor')
  assert.equal(cuentaGetReq(p.llamadas), antes, 'No recarga automáticamente ante el 409')
  await detalle.recargarTrasConflicto()
  assert.equal(cuentaGetReq(p.llamadas), antes + 1, 'Recarga solo al pulsar el botón')
  assert.equal(p.leer().hayConflicto, false)
  assert.equal(p.leer().aviso, '')

  // Un error distinto de 409 no marca conflicto.
  const p2 = await montarHook({ errorPut: Object.assign(new Error('Otro'), { response: { status: 422 } }) })
  await p2.leer().guardar(evento())
  assert.equal(p2.leer().hayConflicto, false)
  console.log('OK: 409 conserva lo tecleado, expone hayConflicto y recarga solo bajo demanda.')
}

// (3) guardarHorasSiguienteAnio adopta actualizado_en de la respuesta sin pisar el resto.
{
  const p = await montarHook({ marcaPatch: '2026-11-20T10:05:00' })
  p.leer().campos.actualizar('horasSiguienteAnio', '40')
  p.leer().campos.actualizar('nombreActa', 'Borrador sin guardar')
  await p.leer().guardarHorasSiguienteAnio(evento())
  const detalle = p.leer()
  assert.equal(detalle.req.actualizado_en, '2026-11-20T10:05:00', 'Toma actualizado_en de la respuesta')
  assert.equal(detalle.req.nombre, 'Nombre', 'No pisa el resto del estado con la respuesta')
  assert.equal(detalle.campos.valores.nombreActa, 'Borrador sin guardar', 'Conserva borradores')
  await detalle.guardar(evento())
  const put = p.llamadas.find(l => l.metodo === 'PUT')
  assert.equal(put.cuerpo.actualizado_en, '2026-11-20T10:05:00', 'El siguiente PUT usa la marca nueva')
  console.log('OK: el PATCH de horas actualiza solo actualizado_en y el PUT posterior lo usa.')
}

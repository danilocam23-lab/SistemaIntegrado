// Ejecutar desde web; datos sintéticos, sin navegador, red ni dependencias nuevas.
import assert from 'node:assert/strict'
import { cargarTypeScript } from './cargar-typescript.mjs'

const { convertirHorasSiguienteAnio } = cargarTypeScript(
  new URL('../src/pages/requerimiento-detalle/horasSiguienteAnio.ts', import.meta.url),
)

for (const vacio of ['', '   ']) {
  assert.equal(convertirHorasSiguienteAnio(vacio), null, 'Vaciar permite limpiar con null')
}
for (const [entrada, esperado] of [['0', 0], ['0.25', 0.25], ['120.75', 120.75], [' 8.5 ', 8.5]]) {
  assert.equal(convertirHorasSiguienteAnio(entrada), esperado, 'Conserva cero y fracciones')
}
for (const invalido of ['-1', '-0.25', 'NaN', 'Infinity', '-Infinity', '1e309', 'texto']) {
  assert.throws(
    () => convertirHorasSiguienteAnio(invalido),
    /debe ser finito y mayor o igual a cero/,
    'Rechaza negativos y no finitos antes del PUT',
  )
}
assert.equal(JSON.stringify({ horas_siguiente_anio: convertirHorasSiguienteAnio('') }), '{"horas_siguiente_anio":null}')
assert.equal(JSON.stringify({ horas_siguiente_anio: convertirHorasSiguienteAnio('0') }), '{"horas_siguiente_anio":0}')
console.log('OK: limpieza, cero, fracciones, negativos, no finitos y serialización de horas.')

// Pruebas de conducta: se ejecutan el hook y el componente reales con módulos
// simulados, sin servidor ni librerías de testing adicionales.
const rutaHook = new URL('../src/pages/requerimiento-detalle/useRequerimientoDetalle.ts', import.meta.url)
const rutaPagina = new URL('../src/pages/RequerimientoDetalle.tsx', import.meta.url)
const copiar = valor => JSON.parse(JSON.stringify(valor))
const camposProtegidos = [
  'horas_siguiente_anio',
  'fecha_entrega_comprometida_siguiente_anio',
  'fecha_real_entrega_siguiente_anio',
]
const reqInicial = {
  id: 'id-prueba', codigo_req: 'REQ-PRUEBA', aplicacion_id: 'squad-prueba',
  nombre: 'Nombre persistido', estado: 'ACTIVO', solicitud: { codigo_sc: 'SC-PRUEBA' },
  entregas: [], horas_siguiente_anio: 12.5,
  fecha_entrega_comprometida_siguiente_anio: '2027-02-01T10:00:00',
  fecha_real_entrega_siguiente_anio: null,
}
const eventoFormulario = () => ({ preventDefault() {} })
const esperar = () => new Promise(resolve => setImmediate(resolve))

async function montarHook(opciones = {}, cambiosReq = {}) {
  const estados = []
  const efectos = []
  const llamadas = []
  let cursor = 0
  let primera = true
  let errorPatch = ''
  let errorBitacora = false
  let liberarPatch = null
  let bloquearPatch = false
  const req = { ...copiar(reqInicial), ...cambiosReq }
  const transporte = {
    async get(url) {
      llamadas.push({ metodo: 'GET', url })
      if (url.startsWith('/bitacora')) {
        if (errorBitacora) throw new Error('Bitácora no disponible')
        return { data: [{ id: 'evento-prueba' }] }
      }
      return { data: url.endsWith('/liquidacion') ? { total: 0 } : copiar(req) }
    },
    async patch(url, cuerpo, config) {
      llamadas.push({ metodo: 'PATCH', url, cuerpo: copiar(cuerpo), config: copiar(config) })
      if (bloquearPatch) await new Promise(resolve => { liberarPatch = resolve })
      if (errorPatch) throw new Error(errorPatch)
      // Si el hook aplicara esta respuesta completa, pisaría datos generales.
      return { data: { ...req, nombre: 'No reemplazar borrador' } }
    },
    async put(url, cuerpo, config) {
      llamadas.push({ metodo: 'PUT', url, cuerpo: copiar(cuerpo), config: copiar(config) })
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
  const permisos = {
    modoConsolidado: false, puedeEditarReq: false, puedeEditarTipificacion: false,
    puedeVerHorasSiguienteAnio: false, puedeEditarHorasSiguienteAnio: false, ...opciones,
  }
  function leer() {
    cursor = 0
    const resultado = useRequerimientoDetalle('REQ-PRUEBA', permisos)
    primera = false
    return resultado
  }
  leer()
  efectos.forEach(efecto => efecto())
  await esperar()
  return {
    leer, llamadas, permisos,
    fallarPatch: mensaje => { errorPatch = mensaje },
    fallarBitacora: () => { errorBitacora = true },
    bloquear: () => { bloquearPatch = true },
    liberar: () => liberarPatch(),
  }
}

function arbolPagina(detalle, permisos) {
  const modulos = {
    // La página ahora usa useEffect + client para cargar /requerimientos/transiciones.
    react: { useState: valor => [valor, () => {}], useEffect: () => {} },
    '../api/client': { default: { get: () => new Promise(() => {}) } },
    'react-router-dom': { Link: 'enlace', useParams: () => ({ reqId: 'REQ-PRUEBA' }) },
    '../context/AuthContext': { useAuth: () => ({
      tienePermiso: permiso => ({
        'requerimientos.editar': permisos.puedeEditarReq,
        'requerimientos.horas_siguiente_anio.ver': permisos.puedeVerHorasSiguienteAnio,
        'requerimientos.horas_siguiente_anio.editar': permisos.puedeEditarHorasSiguienteAnio,
      })[permiso] ?? false,
    }) },
    '../context/AplicacionContext': { useAplicacion: () => ({ modoConsolidado: false }) },
    '../api/hooks': { useLista: () => ({ datos: [] }), useEstados: () => ({ estadosReq: [], estadosEnt: [] }) },
    '../components/ui': Object.fromEntries(
      ['Aviso', 'Boton', 'Campo', 'Chip', 'EncabezadoPagina', 'Icono', 'Selector', 'Tarjeta']
        .map(nombre => [nombre, nombre]),
    ),
    '../components/Modal': { default: 'Modal' },
    './requerimiento-detalle/useRequerimientoDetalle': { useRequerimientoDetalle: () => detalle },
    './requerimiento-detalle/useHistorialEstados': { useHistorialEstados: () => ({}) },
    './requerimiento-detalle/useFormularioEntrega': { useFormularioEntrega: () => ({ valores: {} }) },
    './requerimiento-detalle/usePersonasDelSquad': { usePersonasDelSquad: () => ({
      resolverNombreSquad: () => 'Squad de prueba',
    }) },
  }
  for (const nombre of [
    'ModalHistorialEstados', 'ModalEditarEntrega', 'SeccionLiquidacion', 'SeccionBitacora',
    'SeccionEntregas', 'FormularioEntrega', 'SeccionResumen', 'SeccionSeguimientoHitss',
  ]) modulos[`./requerimiento-detalle/${nombre}`] = { default: nombre }
  modulos['./requerimiento-detalle/SeccionDatosGenerales'] = {
    default: 'SeccionDatosGenerales', ID_FORMULARIO_DATOS_GENERALES: 'formulario-datos-generales',
  }
  return cargarTypeScript(rutaPagina, {}, modulos).default()
}

function descendientes(nodo) {
  if (Array.isArray(nodo)) return nodo.flatMap(descendientes)
  if (!nodo || typeof nodo !== 'object' || !nodo.props) return []
  return [nodo, ...descendientes(nodo.props.children)]
}

for (const general of [false, true]) {
  for (const ver of [false, true]) {
    for (const editar of [false, true]) {
      const prueba = await montarHook({
        puedeEditarReq: general, puedeVerHorasSiguienteAnio: ver, puedeEditarHorasSiguienteAnio: editar,
      })
      const detalleVista = prueba.leer()
      const nodos = descendientes(arbolPagina(detalleVista, prueba.permisos))
      const formularios = nodos.filter(nodo => nodo.type === 'form')
      assert.equal(formularios.length, Number(ver), 'Sin ver no se monta la tarjeta ni sus campos')
      if (ver) {
        const formulario = formularios[0]
        const campos = descendientes(formulario).filter(nodo => nodo.type === 'Campo')
        assert.equal(campos.length, 3)
        assert.ok(campos.every(campo => campo.props.disabled === !editar))
        assert.ok(campos.every(campo => !campo.props.form), 'Los campos no pertenecen al formulario general')
        const numero = campos.find(campo => campo.props.type === 'number')
        assert.equal(numero.props.min, '0')
        assert.equal(numero.props.step, 'any')
        const botones = descendientes(formulario).filter(nodo => nodo.type === 'Boton')
        assert.equal(botones.length, Number(editar))
        if (editar) assert.equal(botones[0].props.type, 'submit')
        assert.equal(formulario.props.onSubmit, detalleVista.guardarHorasSiguienteAnio)
        assert.notEqual(formulario.props.onSubmit, detalleVista.guardar, 'Nunca envía el formulario general')
      } else {
        assert.ok(!nodos.some(nodo => nodo.type === 'Campo'))
      }
      await prueba.leer().guardarHorasSiguienteAnio(eventoFormulario())
      assert.equal(prueba.llamadas.filter(llamada => llamada.metodo === 'PATCH').length, Number(ver && editar))
      // El estado oculto inválido no debe siquiera validarse sin ambos permisos.
      prueba.leer().campos.actualizar('horasSiguienteAnio', ver && editar ? '0' : '-1')
      await prueba.leer().guardar(eventoFormulario())
      const puts = prueba.llamadas.filter(llamada => llamada.metodo === 'PUT')
      assert.equal(puts.length, Number(general))
      if (general) {
        for (const campo of camposProtegidos) assert.equal(Object.hasOwn(puts[0].cuerpo, campo), ver && editar)
        if (ver && editar) assert.equal(puts[0].cuerpo.horas_siguiente_anio, 0)
      }
    }
  }
}
console.log('OK: matriz de visibilidad, solo lectura, edición independiente y omisión de campos en PUT.')

const sinCampos = await montarHook({}, Object.fromEntries(camposProtegidos.map(campo => [campo, undefined])))
for (const campo of camposProtegidos) {
  assert.equal(Object.hasOwn(sinCampos.leer().req, campo), false, 'La lectura saneada conserva campos ausentes, no null')
}
assert.equal(sinCampos.leer().campos.valores.horasSiguienteAnio, '')

for (const [entrada, esperado] of [['0', 0], ['0.25', 0.25], ['', null]]) {
  const prueba = await montarHook({ puedeVerHorasSiguienteAnio: true, puedeEditarHorasSiguienteAnio: true })
  prueba.leer().campos.actualizar('nombreActa', 'Borrador general sin guardar')
  prueba.leer().campos.actualizar('seguimiento', 'Borrador Hitss sin guardar')
  prueba.leer().campos.actualizar('horasSiguienteAnio', entrada)
  prueba.leer().campos.actualizar('fechaEntregaComprometidaSiguienteAnio', '')
  prueba.leer().campos.actualizar('fechaRealEntregaSiguienteAnio', '2027-03-01T12:30')
  const lecturasAntes = prueba.llamadas.filter(llamada => llamada.metodo === 'GET').length
  await prueba.leer().guardarHorasSiguienteAnio(eventoFormulario())
  const patch = prueba.llamadas.find(llamada => llamada.metodo === 'PATCH')
  assert.equal(patch.url, '/requerimientos/REQ-PRUEBA/horas-siguiente-anio')
  assert.deepEqual(patch.cuerpo, {
    horas_siguiente_anio: esperado,
    fecha_entrega_comprometida_siguiente_anio: null,
    fecha_real_entrega_siguiente_anio: '2027-03-01T12:30',
  })
  assert.equal(prueba.leer().req.horas_siguiente_anio, esperado)
  assert.equal(prueba.leer().req.nombre, reqInicial.nombre)
  assert.equal(prueba.leer().campos.valores.nombreActa, 'Borrador general sin guardar')
  assert.equal(prueba.leer().campos.valores.seguimiento, 'Borrador Hitss sin guardar')
  assert.equal(prueba.llamadas.filter(llamada => llamada.metodo === 'GET').length, lecturasAntes + 1)
  assert.ok(prueba.leer().okHorasSiguienteAnio)
  assert.equal(prueba.leer().errorHorasSiguienteAnio, '')
}
console.log('OK: PATCH exclusivo del bloque, cero/fracciones/null y conservación de borradores.')

for (const entrada of ['-1', 'NaN', 'Infinity']) {
  const prueba = await montarHook({ puedeVerHorasSiguienteAnio: true, puedeEditarHorasSiguienteAnio: true })
  prueba.leer().campos.actualizar('horasSiguienteAnio', entrada)
  await prueba.leer().guardarHorasSiguienteAnio(eventoFormulario())
  assert.ok(!prueba.llamadas.some(llamada => llamada.metodo === 'PATCH'))
  assert.match(prueba.leer().errorHorasSiguienteAnio, /finito y mayor o igual a cero/)
  assert.equal(prueba.leer().guardandoHorasSiguienteAnio, false)
}

const error = await montarHook({ puedeVerHorasSiguienteAnio: true, puedeEditarHorasSiguienteAnio: true })
error.fallarPatch('No se pudo guardar')
await error.leer().guardarHorasSiguienteAnio(eventoFormulario())
assert.equal(error.leer().errorHorasSiguienteAnio, 'No se pudo guardar')
assert.equal(error.leer().okHorasSiguienteAnio, '')
assert.equal(error.leer().guardandoHorasSiguienteAnio, false)
assert.equal(error.leer().req.horas_siguiente_anio, 12.5)
assert.ok(descendientes(arbolPagina(error.leer(), error.permisos))
  .some(nodo => nodo.props.role === 'alert'))

const bitacora = await montarHook({ puedeVerHorasSiguienteAnio: true, puedeEditarHorasSiguienteAnio: true })
bitacora.fallarBitacora()
await bitacora.leer().guardarHorasSiguienteAnio(eventoFormulario())
assert.ok(bitacora.leer().okHorasSiguienteAnio)
assert.match(bitacora.leer().errorHorasSiguienteAnio, /Los datos se guardaron/)
assert.ok(descendientes(arbolPagina(bitacora.leer(), bitacora.permisos))
  .some(nodo => nodo.props.role === 'status'))

const ocupado = await montarHook({ puedeVerHorasSiguienteAnio: true, puedeEditarHorasSiguienteAnio: true })
ocupado.bloquear()
const pendiente = ocupado.leer().guardarHorasSiguienteAnio(eventoFormulario())
assert.equal(ocupado.leer().guardandoHorasSiguienteAnio, true)
const nodosOcupados = descendientes(arbolPagina(ocupado.leer(), ocupado.permisos))
assert.ok(nodosOcupados.filter(nodo => nodo.type === 'Campo').every(nodo => nodo.props.disabled))
assert.ok(nodosOcupados.some(nodo => nodo.type === 'Boton' && nodo.props.children === 'Guardando…' && nodo.props.disabled))
await ocupado.leer().guardarHorasSiguienteAnio(eventoFormulario())
assert.equal(ocupado.llamadas.filter(llamada => llamada.metodo === 'PATCH').length, 1)
ocupado.liberar()
await pendiente
assert.equal(ocupado.leer().guardandoHorasSiguienteAnio, false)

for (const aplicacion of ['squad-prueba', null]) {
  const prueba = await montarHook({
    modoConsolidado: true, puedeVerHorasSiguienteAnio: true, puedeEditarHorasSiguienteAnio: true,
  }, { aplicacion_id: aplicacion })
  await prueba.leer().guardarHorasSiguienteAnio(eventoFormulario())
  const patches = prueba.llamadas.filter(llamada => llamada.metodo === 'PATCH')
  assert.equal(patches.length, aplicacion ? 1 : 0)
  if (aplicacion) assert.deepEqual(patches[0].config, { headers: { 'X-Aplicacion': aplicacion } })
  else assert.match(prueba.leer().errorHorasSiguienteAnio, /Selecciona un squad concreto/)
}
console.log('OK: validación, error de escritura/bitácora, busy y contexto seguro de aplicación.')

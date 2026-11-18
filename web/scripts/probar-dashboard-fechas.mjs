// Datos sintéticos y reloj inyectado. Sin red, navegador ni dependencias nuevas.
import assert from 'node:assert/strict'
import { cargarTypeScript } from './cargar-typescript.mjs'

const ruta = nombre => new URL(`../src/pages/dashboard-requerimientos/${nombre}.ts`, import.meta.url)
const {
  anosDisponibles, derivarRequerimientos, derivarSoporte, fechaCalendario,
  filtroInicial, hoyColombia, pasaFecha,
} = cargarTypeScript(ruta('filtrosFechas'))
const { filasDetalleReq, filasDetalleEntrega, clasificarAns } = cargarTypeScript(ruta('calculoAns'))
const copia = valor => JSON.parse(JSON.stringify(valor))
const sumar = (filas, campo) => filas.reduce((suma, fila) => suma + fila[campo], 0)
const filtro = (hasta, anos = [], meses = []) => ({ hasta, anos: new Set(anos), meses: new Set(meses) })
let secuencia = 0
const entrega = (cambios = {}) => ({
  numero: 1, fecha_recepcion: '2026-11-18', fecha_comprometida: '2026-10-01',
  ans_entrega: 'NO_CUMPLE', tipificacion: 'EPM', ...cambios,
})
const requerimiento = (cambios = {}) => ({
  id: `req-${++secuencia}`, codigo_req: 'REQ-PRUEBA', estado: 'ACTIVO', nombre: 'Demanda sintética',
  fecha_inicio: '2026-11-18', fecha_solicitud_acta: '2026-11-18',
  ans_acta: 'NO_CUMPLE', tipificacion: 'EPM', total_horas_estimadas: 40,
  solicitud: { lt_hitss_id: 'lt-prueba' }, entregas: [], ...cambios,
})
const soporte = (cambios = {}) => ({
  Work_Order_ID: 'WO-1', lider: 'Líder de prueba', Fecha_Fin_Real: '2026-11-18',
  Estado_ANS_Oportunidad: 'CUMPLE', Estado_ANS_Cumplimiento: 'NO_CUMPLE',
  Estado_ANS_inicio_trabajo: 'CUMPLE', ...cambios,
})
function congelar(valor) {
  if (valor && typeof valor === 'object') {
    Object.freeze(valor)
    Object.values(valor).forEach(congelar)
  }
  return valor
}
let casos = 0
async function probar(nombre, prueba) {
  await prueba()
  casos++
  console.log(`OK: ${nombre}`)
}

await probar('Calendario colombiano: borde UTC, enero y día completo sin desplazar fechas de los datos', () => {
  assert.equal(hoyColombia(new Date('2027-01-01T02:00:00Z')), '2026-12-31')
  assert.equal(hoyColombia(new Date('2027-01-01T05:00:00Z')), '2027-01-01')
  const inicial = filtroInicial('2027-01-01')
  assert.equal(pasaFecha('2027-01-01T23:59:59-05:00', inicial), true)
  assert.equal(pasaFecha('2027-01-02T00:00:00Z', inicial), false)
  assert.equal(pasaFecha('2026-12-31', inicial), false)
  assert.equal(pasaFecha('2028-01-01', inicial), false)
  assert.equal(pasaFecha('2027-01-01', inicial), true)
  assert.equal(fechaCalendario('2026-11-18T23:59:59-08:00'), '2026-11-18')
})

await probar('Sin fecha o fecha inválida se excluye incluso sin filtros; bisiestos reales', () => {
  for (const fecha of [undefined, null, '', 'ayer', '2026-02-29', '2026-04-31', '2026-00-01',
    '2026-13-01', '2026-11-00', '2026-11-18 basura', '2026-11-18T25:00:00', '2026-11-18T10:70:00']) {
    assert.equal(fechaCalendario(fecha), null, String(fecha))
    assert.equal(pasaFecha(fecha, filtro('2026-11-18')), false)
  }
  assert.equal(fechaCalendario('2024-02-29T10:20:30.123Z'), '2024-02-29')
  assert.equal(fechaCalendario('2100-02-29'), null)
  assert.equal(fechaCalendario('2000-02-29'), '2000-02-29')
})

await probar('Año actual sin datos no cae a un año viejo; meses vacíos incluyen enero hasta hoy', () => {
  const inicial = filtroInicial('2026-11-18')
  assert.deepEqual([...inicial.anos], ['2026'])
  assert.equal(inicial.meses.size, 0)
  assert.deepEqual(copia(anosDisponibles(['2025-12-20', '2027-01-01', null], inicial.hasta)), ['2025', '2026'])
  assert.deepEqual(copia(anosDisponibles([], inicial.hasta)), ['2026'])
  assert.equal(derivarRequerimientos([requerimiento({ fecha_inicio: '2025-12-20', fecha_solicitud_acta: '2025-12-20' })], inicial).kpis.total, 0)
  assert.equal(derivarRequerimientos([
    requerimiento({ fecha_inicio: '2026-01-01' }), requerimiento({ fecha_inicio: '2026-11-18T23:59:59' }),
    requerimiento({ fecha_inicio: '2026-11-19' }), requerimiento({ fecha_inicio: '2026-12-01' }),
  ], inicial).kpis.total, 2)
})

await probar('Históricos, varios años y diciembre pasado; mes futuro del año actual devuelve vacío', () => {
  const reqs = ['2024-12-20', '2025-12-20', '2026-12-01', '2026-11-19', '2027-01-01']
    .map(fecha_inicio => requerimiento({ fecha_inicio, fecha_solicitud_acta: fecha_inicio }))
  const varios = derivarRequerimientos(reqs, filtro('2026-11-18', ['2024', '2025', '2026'], ['12']))
  assert.equal(varios.kpis.total, 2)
  assert.deepEqual(copia(varios.porMes.map(p => p.mes)), ['2024-12', '2025-12'])
  assert.equal(derivarRequerimientos(reqs, filtro('2026-11-18', ['2026'], ['12'])).kpis.total, 0)
  assert.equal(derivarRequerimientos(reqs, filtro('2026-11-18')).kpis.total, 2)
})

function verificarParidad(datos, reqs) {
  const pares = [
    [datos.itemsReq, datos.tendenciaReqs, datos.tendenciaReqsEpm, datos.kpis.ansReqTotal, datos.kpis.ansReqCumple, datos.kpis.ansReqEpmCumple, filasDetalleReq(datos.itemsReq, () => 'LT')],
    [datos.itemsEnt, datos.tendencia, datos.tendenciaEpm, datos.kpis.ansEntTotal, datos.kpis.ansEntCumple, datos.kpis.ansEntEpmCumple, filasDetalleEntrega(datos.itemsEnt, reqs, () => 'LT')],
  ]
  for (const [items, real, hitss, total, cumple, cumpleHitss, detalle] of pares) {
    assert.equal(items.length, total)
    assert.equal(detalle.length, total)
    assert.equal(sumar(real, 'total'), total)
    assert.equal(sumar(real, 'cumple'), cumple)
    assert.equal(sumar(hitss, 'cumple'), cumpleHitss)
    const clasificacion = clasificarAns(detalle)
    assert.equal(clasificacion.cumple.length, cumple)
    assert.equal(clasificacion.cumple.length + clasificacion.noCumpleEpm.length, cumpleHitss)
  }
  assert.equal(sumar(datos.porMes, 'cantidad'), datos.kpis.total)
  assert.equal(Object.values(datos.porLt).reduce((a, b) => a + b, 0), datos.kpis.total)
}

await probar('Cinco gráficas, KPI, detalle y equipo: referencias independientes, EPM y cancelados', () => {
  const reqs = congelar([
    requerimiento({ entregas: [entrega(), entrega({ numero: 2, fecha_recepcion: '2026-11-19' })] }),
    // La entrega entra aunque el padre sea de otro año o esté fechado en el futuro.
    requerimiento({ fecha_inicio: '2025-12-01', fecha_solicitud_acta: '2025-12-01', entregas: [entrega()] }),
    requerimiento({ fecha_inicio: '2027-01-01', fecha_solicitud_acta: '2027-01-01', entregas: [entrega({ tipificacion: 'HITSS' })] }),
    requerimiento({ fecha_inicio: null, fecha_solicitud_acta: '2026-01-02', ans_acta: 'CUMPLE' }),
    // Inicio no rescata una solicitud de acta ausente en ANS.
    requerimiento({ fecha_solicitud_acta: null }),
    // Fallback solo nulo, no vacío ni fecha inválida.
    requerimiento({ fecha_inicio: '', fecha_solicitud_acta: null, entregas: [entrega({ fecha_recepcion: '', fecha_comprometida: '2026-11-18' })] }),
    requerimiento({ fecha_inicio: '2026-02-30', fecha_solicitud_acta: null }),
    requerimiento({ fecha_inicio: null, fecha_solicitud_acta: null, entregas: [entrega({ fecha_recepcion: null, fecha_comprometida: '2026-11-18' })] }),
    ...['CANCELADO', 'REEMPLAZADO'].map(estado => requerimiento({ estado, entregas: [entrega()] })),
  ])
  const antes = JSON.stringify(reqs)
  const datos = derivarRequerimientos(reqs, filtroInicial('2026-11-18'))
  assert.equal(datos.kpis.total, 5)
  assert.equal(datos.kpis.totalHoras, 200)
  assert.equal(datos.kpis.totalEntregas, 6)
  assert.equal(datos.kpis.ansReqTotal, 2)
  assert.equal(datos.kpis.ansEntTotal, 4)
  assert.equal(datos.kpis.ansReqCumple, 1)
  assert.equal(datos.kpis.ansReqEpmCumple, 2)
  assert.equal(datos.kpis.ansEntEpmCumple, 3)
  verificarParidad(datos, reqs)
  assert.equal(JSON.stringify(reqs), antes)
})

await probar('WO deduplicadas entre meses y filas; futura o sin fecha no infla ni LT ni ANS', () => {
  const registros = congelar([
    soporte({ Fecha_Fin_Real: '2026-01-10' }), soporte(), soporte(),
    soporte({ Fecha_Fin_Real: '2026-11-19', lider: 'Otro líder' }),
    soporte({ Work_Order_ID: 'WO-FUTURA', Fecha_Fin_Real: '2027-01-01' }),
    soporte({ Work_Order_ID: 'WO-SIN-FECHA', Fecha_Fin_Real: undefined }),
    soporte({ Work_Order_ID: 'WO-INVALIDA', Fecha_Fin_Real: '2026-02-30' }),
    soporte({ Work_Order_ID: 'WO-2', Fecha_Fin_Real: '2025-12-31' }),
  ])
  const datos = derivarSoporte(registros, filtroInicial('2026-11-18'))
  assert.equal(datos.workOrderIDFiltrado, 1)
  assert.equal(datos.woPorLt['lider de prueba'], 1)
  assert.equal(datos.woPorLt['otro lider'], undefined)
  assert.equal(datos.woPorMes.length, 2)
  assert.equal(sumar(datos.woPorMes, 'wo'), 2) // Una WO puede aparecer en dos meses, nunca infla el KPI.
  for (const [kpi, prefijo] of [[datos.ansOportShow, 'oportunidad'], [datos.ansCumplShow, 'cumplimiento'], [datos.ansInicioShow, 'inicio']]) {
    assert.equal(kpi.total, 3)
    assert.equal(sumar(datos.ansTendencia, `${prefijo}Total`), kpi.total)
    assert.equal(sumar(datos.ansTendencia, `${prefijo}Cumple`), kpi.cumple)
  }
  const historico = derivarSoporte(registros, filtro('2026-11-18', ['2025'], ['12']))
  assert.equal(historico.workOrderIDFiltrado, 1)
  assert.equal(historico.woPorLt['lider de prueba'], 1)
  assert.equal(historico.ansOportShow.total, 1)
  assert.equal(derivarSoporte(registros, filtro('2026-11-18', ['2026'], ['12'])).workOrderIDFiltrado, 0)
  assert.equal(derivarSoporte(registros, filtro('2026-11-18')).workOrderIDFiltrado, 2)
})

await probar('Los valores ANS no estándar conservan su tratamiento previo, sin reclasificación de negocio', () => {
  const datos = derivarRequerimientos([requerimiento({
    ans_acta: 'PENDIENTE', entregas: [entrega({ ans_entrega: 'PENDIENTE' })],
  })], filtroInicial('2026-11-18'))
  assert.equal(datos.kpis.ansReqTotal, 1)
  assert.equal(datos.kpis.ansReqCumple, 0)
  assert.equal(datos.tendenciaReqs.length, 0)
  assert.equal(clasificarAns(filasDetalleReq(datos.itemsReq, () => 'LT')).otros, 1)
  assert.equal(sumar(datos.tendencia, 'total'), 1)
  assert.equal(datos.kpis.ansEntTotal, 1)
})

// Runner mínimo de hooks: mantiene estado/memos y ejecuta efectos y cleanup entre renders.
function crearEntorno() {
  let cursor = 0
  const celdas = [], efectos = [], intervalos = new Map(), eventosVentana = new Map(), eventosDocumento = new Map()
  let secuenciaIntervalo = 0
  const iguales = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]))
  const react = {
    useState(inicial) {
      const indice = cursor++
      if (!celdas[indice]) celdas[indice] = { valor: typeof inicial === 'function' ? inicial() : inicial }
      return [celdas[indice].valor, accion => {
        celdas[indice].valor = typeof accion === 'function' ? accion(celdas[indice].valor) : accion
      }]
    },
    useMemo(calcular, dependencias) {
      const indice = cursor++
      if (!celdas[indice] || !iguales(celdas[indice].dependencias, dependencias)) {
        celdas[indice] = { valor: calcular(), dependencias }
      }
      return celdas[indice].valor
    },
    useCallback(funcion, dependencias) { return react.useMemo(() => funcion, dependencias) },
    useRef(inicial) { return react.useMemo(() => ({ current: inicial }), []) },
    useEffect(efecto, dependencias) {
      const indice = cursor++
      if (!celdas[indice] || !iguales(celdas[indice].dependencias, dependencias)) {
        efectos.push(() => {
          celdas[indice]?.limpiar?.()
          celdas[indice] = { dependencias, limpiar: efecto() }
        })
      }
    },
  }
  const documento = {
    visibilityState: 'visible',
    addEventListener: (nombre, funcion) => eventosDocumento.set(nombre, funcion),
    removeEventListener: nombre => eventosDocumento.delete(nombre),
  }
  const ventana = {
    setInterval(funcion, demora) {
      assert.equal(demora, 30_000)
      intervalos.set(++secuenciaIntervalo, funcion)
      return secuenciaIntervalo
    },
    clearInterval: id => intervalos.delete(id),
    addEventListener: (nombre, funcion) => eventosVentana.set(nombre, funcion),
    removeEventListener: nombre => eventosVentana.delete(nombre),
  }
  return {
    react, globales: { window: ventana, document: documento },
    render(componente) {
      cursor = 0
      const resultado = componente()
      while (efectos.length) efectos.shift()()
      return resultado
    },
    tick: () => intervalos.forEach(funcion => funcion()),
    foco: () => eventosVentana.get('focus')?.(),
    visible: () => eventosDocumento.get('visibilitychange')?.(),
    desmontar() {
      celdas.forEach(celda => celda.limpiar?.())
      assert.equal(intervalos.size + eventosVentana.size + eventosDocumento.size, 0)
    },
  }
}

await probar('Reloj 18→19 sin remontar ni red; filtros independientes y manuales sobreviven', () => {
  const entorno = crearEntorno()
  const { useCorteColombia, useFiltroTemporal } = cargarTypeScript(ruta('useRelojDashboard'), entorno.globales, { react: entorno.react })
  let instante = new Date('2026-11-19T04:59:59Z')
  const ahora = () => instante
  const reqs = [requerimiento({ fecha_inicio: '2026-11-19', fecha_solicitud_acta: '2026-11-19' })]
  const registros = [soporte({ Fecha_Fin_Real: '2026-11-19' })]
  const componente = () => {
    const hoy = useCorteColombia(ahora)
    const req = useFiltroTemporal(hoy), sop = useFiltroTemporal(hoy)
    return { hoy, req, sop, datosReq: derivarRequerimientos(reqs, req), datosSop: derivarSoporte(registros, sop) }
  }
  let vista = entorno.render(componente)
  vista.req.setMeses(new Set(['11']))
  vista.sop.setMeses(new Set(['11']))
  vista = entorno.render(componente)
  assert.equal(vista.hoy, '2026-11-18')
  assert.equal(vista.datosReq.kpis.total, 0)
  assert.equal(vista.datosSop.workOrderIDFiltrado, 0)
  instante = new Date('2026-11-19T05:00:00Z')
  entorno.tick()
  vista = entorno.render(componente)
  assert.equal(vista.hoy, '2026-11-19')
  assert.equal(vista.datosReq.kpis.total, 1)
  assert.equal(vista.datosSop.workOrderIDFiltrado, 1)
  assert.deepEqual([...vista.req.meses], ['11'])
  assert.deepEqual([...vista.sop.meses], ['11'])
  vista.req.setAnos(new Set(['2025']))
  vista = entorno.render(componente)
  assert.equal(vista.datosReq.kpis.total, 0)
  assert.equal(vista.datosSop.workOrderIDFiltrado, 1)
  instante = new Date('2027-01-01T05:00:00Z')
  entorno.foco()
  vista = entorno.render(componente)
  assert.deepEqual([...vista.req.anos], ['2025'])
  assert.deepEqual([...vista.sop.anos], ['2026']) // Mes manual: tampoco cambia el año.
  vista.req.restablecer()
  vista.sop.restablecer()
  vista = entorno.render(componente)
  assert.deepEqual([...vista.req.anos], ['2027'])
  assert.equal(vista.req.meses.size, 0)
  instante = new Date('2028-01-01T05:00:00Z')
  entorno.visible()
  vista = entorno.render(componente)
  assert.deepEqual([...vista.req.anos], ['2028'])
  assert.deepEqual([...vista.sop.anos], ['2028'])
  entorno.desmontar()
})

function nodos(arbol) {
  if (Array.isArray(arbol)) return arbol.flatMap(nodos)
  if (!arbol || typeof arbol !== 'object') return []
  return [arbol, ...nodos(arbol.props?.children)]
}

await probar('Selector real reemplaza el año inicial, admite varios años y limpiar no muta el Set previo', () => {
  const entorno = crearEntorno()
  const elemento = (type, props) => ({ type, props })
  const { default: Selector } = cargarTypeScript(
    new URL('../src/components/ui/FiltroDesplegable.tsx', import.meta.url), entorno.globales, {
      react: entorno.react,
      'react/jsx-runtime': { jsx: elemento, jsxs: elemento },
      './primitivos': { cx: (...clases) => clases.filter(Boolean).join(' ') },
    },
  )
  const inicial = new Set(['2026'])
  let seleccion = inicial
  const componente = () => Selector({
    label: 'Año', opciones: ['2025', '2026'], activos: seleccion, valorInicial: '2026',
    setActivos: accion => { seleccion = typeof accion === 'function' ? accion(seleccion) : accion },
  })
  const pulsarAno = indice => nodos(entorno.render(componente)).filter(n => n.type === 'input')[indice].props.onChange()
  pulsarAno(0)
  assert.deepEqual([...seleccion], ['2025'])
  assert.deepEqual([...inicial], ['2026'])
  pulsarAno(1)
  assert.deepEqual([...seleccion], ['2025', '2026'])
  const limpiar = nodos(entorno.render(componente)).find(n => n.props?.['data-analytics-id'] === 'filtro.limpiar')
  limpiar.props.onClick()
  assert.equal(seleccion.size, 0)
  entorno.desmontar()
})

function cargarPaginaPrueba(entorno, FechaSimulada, {
  reqs = [requerimiento({ entregas: [entrega()] })], estadoReq = {},
  get = async () => ({ data: { registros: [soporte()] } }),
} = {}) {
  const elemento = (type, props) => ({ type, props })
  const modulos = {
    react: entorno.react,
    'react/jsx-runtime': { jsx: elemento, jsxs: elemento },
    '../api/hooks': { useLista: ruta => ruta === '/requerimientos'
      ? { datos: reqs, cargando: false, error: '', ...estadoReq }
      : { datos: [{ id: 'lt-prueba', nombre: 'Líder de prueba' }], cargando: false, error: '' } },
    '../api/client': { default: { get } },
    '../components/ui': Object.fromEntries([
      'Aviso', 'BarraFiltros', 'Boton', 'Chip', 'EncabezadoPagina', 'FiltroDesplegable', 'Icono', 'Kpi', 'Tarjeta',
    ].map(nombre => [nombre, nombre])),
    '../components/ui/graficas': {
      COLOR_GRAFICA: {}, ContenedorGrafica: 'ContenedorGrafica', TooltipGrafica: 'TooltipGrafica',
      ejeCategoria: () => ({}), ejeValor: () => ({}), etiquetaBarra: () => ({}), rejilla: () => ({}),
    },
    './dashboard-requerimientos/GraficaTendenciaAns': { GraficaTendenciaAns: 'GraficaTendenciaAns' },
    './dashboard-requerimientos/ModalDetalleAnsHitss': { ModalDetalleAnsHitss: 'ModalDetalleAnsHitss' },
    recharts: Object.fromEntries(['BarChart', 'Bar', 'XAxis', 'YAxis', 'Tooltip', 'CartesianGrid', 'LabelList'].map(nombre => [nombre, nombre])),
  }
  return cargarTypeScript(
    new URL('../src/pages/DashboardRequerimientos.tsx', import.meta.url),
    { ...entorno.globales, Date: FechaSimulada }, modulos,
  ).default
}

await probar('Página real: nueve gráficas, filtros, modal, reset y medianoche sin refetch', async () => {
  const entorno = crearEntorno()
  let instante = new Date('2026-11-19T04:59:59Z')
  class FechaSimulada extends Date {
    constructor(...args) { super(...(args.length ? args : [instante.getTime()])) }
  }
  const reqs = [requerimiento({ entregas: [entrega()] }), requerimiento({
    fecha_inicio: '2026-11-19', fecha_solicitud_acta: '2026-11-19',
    entregas: [entrega({ fecha_recepcion: '2026-11-19' })],
  })]
  let peticiones = 0
  const Pagina = cargarPaginaPrueba(entorno, FechaSimulada, { reqs, get: async () => {
    peticiones++
    return { data: { registros: [soporte(), soporte({ Work_Order_ID: 'WO-2', Fecha_Fin_Real: '2026-11-19' })] } }
  } })
  const cargando = nodos(entorno.render(Pagina))
  assert.ok(cargando.some(n => n.type === 'Aviso' && n.props.children === 'Cargando Soporte y Work Orders…'))
  assert.equal(cargando.find(n => n.type === 'Kpi' && n.props.rotulo === 'Requerimientos').props.valor, 1)
  assert.equal(cargando.filter(n => n.type === 'Kpi' && n.props.rotulo === 'Work Orders').length, 0)
  await new Promise(resolve => setImmediate(resolve))
  const leer = () => nodos(entorno.render(Pagina))
  let vista = leer()
  const kpi = rotulo => vista.find(n => n.type === 'Kpi' && n.props.rotulo === rotulo).props
  assert.equal(vista.filter(n => n.type === 'GraficaTendenciaAns' || n.type === 'ContenedorGrafica').length, 9)
  assert.equal(kpi('Requerimientos').valor, 1)
  assert.equal(kpi('Work Orders').valor, '1')
  const selectores = vista.filter(n => n.type === 'FiltroDesplegable')
  assert.equal(selectores.length, 4)
  assert.equal(selectores[0].props.valorInicial, '2026')
  assert.equal(selectores[2].props.valorInicial, '2026')
  selectores[1].props.setActivos(new Set(['11']))
  vista = leer()
  instante = new Date('2026-11-19T05:00:00Z')
  entorno.tick()
  vista = leer()
  assert.equal(kpi('Requerimientos').valor, 2)
  assert.equal(kpi('Work Orders').valor, '2')
  assert.equal(peticiones, 1)
  assert.deepEqual([...vista.filter(n => n.type === 'FiltroDesplegable')[1].props.activos], ['11'])
  const tendencia = vista.find(n => n.type === 'GraficaTendenciaAns' && n.props.titulo === 'ANS de estimación (Hitss)')
  tendencia.props.acciones.props.onClick()
  vista = leer()
  assert.equal(vista.find(n => n.type === 'ModalDetalleAnsHitss').props.filas.length, 2)
  vista.filter(n => n.type === 'FiltroDesplegable')[0].props.setActivos(new Set(['2025']))
  vista = leer()
  assert.equal(kpi('Requerimientos').valor, 0)
  assert.equal(kpi('Work Orders').valor, '2')
  vista.find(n => n.type === 'Boton' && n.props.children === 'Restablecer').props.onClick()
  vista = leer()
  assert.equal(kpi('Requerimientos').valor, 2)
  assert.equal(peticiones, 1)
  entorno.desmontar()

  // Ni fallo de transporte ni respuesta malformada pueden aparecer como ceros exitosos.
  for (const get of [
    async () => { throw new Error('Fallo sintético') },
    async () => ({ data: {} }),
  ]) {
    const fallido = crearEntorno()
    const PaginaFallida = cargarPaginaPrueba(fallido, FechaSimulada, { reqs, get })
    fallido.render(PaginaFallida)
    await new Promise(resolve => setImmediate(resolve))
    const error = nodos(fallido.render(PaginaFallida))
    assert.ok(error.some(n => n.type === 'Aviso' && n.props.tono === 'error'))
    assert.equal(error.find(n => n.type === 'Kpi' && n.props.rotulo === 'Requerimientos').props.valor, 2)
    assert.equal(error.filter(n => n.type === 'Kpi' && n.props.rotulo === 'Work Orders').length, 0)
    fallido.desmontar()
  }
})

class FechaDisponibilidad extends Date {
  constructor(...args) { super(...(args.length ? args : ['2026-11-18T12:00:00Z'])) }
}

await probar('Soporte cargando y luego 403 no bloquea Requerimientos; WO del equipo es —', async () => {
  const entorno = crearEntorno()
  let rechazarSoporte
  const Pagina = cargarPaginaPrueba(entorno, FechaDisponibilidad, {
    get: () => new Promise((_resolver, rechazar) => { rechazarSoporte = rechazar }),
  })
  const verificarRequerimientos = vista => {
    const [requerimientos, soporte] = vista.filter(n => n.type === 'section').map(nodos)
    assert.equal(requerimientos.find(n => n.type === 'Kpi' && n.props.rotulo === 'Requerimientos').props.valor, 1)
    assert.equal(requerimientos.filter(n => n.type === 'GraficaTendenciaAns' || n.type === 'ContenedorGrafica').length, 5)
    const wo = requerimientos.find(n => n.type === 'Chip' && n.props.tono === 'neutro')
    assert.equal([wo.props.children].flat().join(''), '— WO')
    assert.equal(soporte.filter(n => n.type === 'Kpi' || n.type === 'GraficaTendenciaAns' || n.type === 'ContenedorGrafica').length, 0)
    assert.equal(vista.filter(n => n.type === 'FiltroDesplegable').length, 4)
    assert.ok(vista.some(n => n.type === 'Aviso' && [n.props.children].flat().join('').includes('18/11/2026')))
    return soporte
  }
  const cargando = verificarRequerimientos(nodos(entorno.render(Pagina)))
  assert.ok(cargando.some(n => n.type === 'Aviso' && n.props.tono === 'info'))
  rechazarSoporte({ response: { status: 403 } })
  await new Promise(resolve => setImmediate(resolve))
  const fallido = verificarRequerimientos(nodos(entorno.render(Pagina)))
  assert.ok(fallido.some(n => n.type === 'Aviso' && n.props.tono === 'error'))
  entorno.desmontar()
})

await probar('Requerimientos cargando y luego fallido no bloquea Soporte disponible', async () => {
  const entorno = crearEntorno()
  const estadoReq = { cargando: true, error: '' }
  const Pagina = cargarPaginaPrueba(entorno, FechaDisponibilidad, { estadoReq })
  entorno.render(Pagina)
  await new Promise(resolve => setImmediate(resolve))
  const verificarSoporte = vista => {
    const [requerimientos, soporte] = vista.filter(n => n.type === 'section').map(nodos)
    assert.equal(soporte.find(n => n.type === 'Kpi' && n.props.rotulo === 'Work Orders').props.valor, '1')
    assert.equal(soporte.filter(n => n.type === 'GraficaTendenciaAns' || n.type === 'ContenedorGrafica').length, 4)
    assert.equal(requerimientos.filter(n => n.type === 'Kpi' || n.type === 'GraficaTendenciaAns' || n.type === 'ContenedorGrafica').length, 0)
    assert.equal(vista.filter(n => n.type === 'FiltroDesplegable').length, 4)
    return requerimientos
  }
  const cargando = verificarSoporte(nodos(entorno.render(Pagina)))
  assert.ok(cargando.some(n => n.type === 'Aviso' && n.props.children === 'Cargando Requerimientos y Actas…'))
  estadoReq.cargando = false
  estadoReq.error = 'No fue posible cargar los datos'
  const fallido = verificarSoporte(nodos(entorno.render(Pagina)))
  assert.ok(fallido.some(n => n.type === 'Aviso' && n.props.tono === 'error'))
  entorno.desmontar()
})

await probar('Corte opcional compartido no altera el comportamiento por defecto de otros consumidores', () => {
  class FechaFija extends Date {
    constructor(...args) { super(...(args.length ? args : ['2026-11-18T12:00:00Z'])) }
  }
  const { calcularTendenciaAns } = cargarTypeScript(ruta('calculoAns'), { Date: FechaFija })
  const items = [{ ans: 'CUMPLE', tipificacion: null, fecha: '2026-11-18T23:59:59' },
    { ans: 'NO_CUMPLE', tipificacion: null, fecha: '9999-12-31' }]
  assert.equal(sumar(calcularTendenciaAns(items, i => i.fecha, { atribuirEpm: false }), 'total'), 1)
  assert.equal(sumar(calcularTendenciaAns(items, i => i.fecha, { atribuirEpm: false, hasta: '9999-12-31' }), 'total'), 2)
})

console.log(`${casos} pruebas de fechas del dashboard completadas.`)

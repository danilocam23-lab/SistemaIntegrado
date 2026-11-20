// Ejecutar desde web. Datos sintéticos, SSR y transporte controlado; sin red ni dependencias nuevas.
import assert from 'node:assert/strict'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server.js'
import { cargarTypeScript } from './cargar-typescript.mjs'

const ruta = archivo => new URL(`../src/${archivo}`, import.meta.url)
const copia = valor => JSON.parse(JSON.stringify(valor))
const {
  ENTREGAS_ACTAS_COLUMNAS: columnasEntregas, ENTREGAS_ACTAS_CONFIG_CLAVES: clavesEntregas,
  ENTREGAS_ACTAS_FILTROS: filtrosEntregas,
  REQUERIMIENTOS_COLUMNAS: columnasReq, REQUERIMIENTOS_CONFIG_CLAVES: clavesReq,
  REQUERIMIENTOS_FILTROS: filtrosReq, leerCamposActivos,
} = cargarTypeScript(ruta('constantes.ts'))
const { leerOrdenColumnas, normalizarOrdenColumnas, ordenarColumnasVisibles, moverColumnaVisible } =
  cargarTypeScript(ruta('utils/ordenColumnas.ts'))
const { useCamposRequerimientos } = cargarTypeScript(ruta('pages/requerimientos/useCamposRequerimientos.ts'))
const ui = cargarTypeScript(ruta('components/ui/index.ts'))
const modulosUi = { '../../components/ui': ui }
const { TablaRequerimientos } = cargarTypeScript(ruta('pages/requerimientos/TablaRequerimientos.tsx'), {}, modulosUi)
const { SeccionCamposConfigurables } = cargarTypeScript(ruta('pages/configuracion/SeccionCamposConfigurables.tsx'), {}, modulosUi)
const h = React.createElement
const nada = () => {}
const claves = columnas => Array.from(columnas, columna => columna.key)
const config = (clave, valor) => ({ clave, valor: JSON.stringify(valor) })
const texto = html => html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/<!--.*?-->/g, '')
const celdas = fila => [...fila.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/g)].map(celda => texto(celda[1]))
const primeraFila = (html, seccion) => html.match(new RegExp(`<${seccion}>\\s*<tr\\b[^>]*>([\\s\\S]*?)</tr>`))?.[1] ?? ''
const escritorio = html => html.split('<div class="space-y-3 md:hidden">')[0]
const movil = html => html.slice(html.indexOf('<div class="space-y-3 md:hidden">'))
const piePrincipal = html => html.slice(html.lastIndexOf('<tfoot>'))
const renderizar = elemento => renderToStaticMarkup(h(
  StaticRouter, { basename: '/SistemaIntegrado', location: '/SistemaIntegrado/requerimientos' }, elemento,
))
let casos = 0
async function probar(nombre, prueba) {
  await prueba()
  casos++
  console.log(`OK: ${nombre}`)
}

await probar('Defaults históricos independientes del orden de clics y sin escrituras al leer', () => {
  for (const [catalogo, clavesConfig] of [[columnasReq, clavesReq], [columnasEntregas, clavesEntregas]]) {
    const datos = [config(clavesConfig.columnas, ['horas', 'sc', 'codigoReq'])]
    const original = JSON.stringify(datos)
    assert.deepEqual(copia(leerOrdenColumnas(datos, clavesConfig.ordenColumnas, catalogo)), claves(catalogo))
    assert.deepEqual(claves(ordenarColumnasVisibles(
      catalogo, leerOrdenColumnas(datos, clavesConfig.ordenColumnas, catalogo),
      leerCamposActivos(datos, clavesConfig.columnas, catalogo),
    )), ['codigoReq', 'sc', 'horas'])
    assert.equal(JSON.stringify(datos), original)
    // La semántica histórica de un array de visibilidad vacío se conserva.
    assert.deepEqual([...leerCamposActivos([config(clavesConfig.columnas, [])], clavesConfig.columnas, catalogo)],
      claves(catalogo.filter(columna => columna.porDefecto)))
  }
})

await probar('Normaliza duplicados, desconocidas, tipos, JSON corrupto y columnas nuevas', () => {
  const catalogo = ['a', 'b', 'c', 'nueva'].map(key => ({ key }))
  assert.deepEqual(copia(normalizarOrdenColumnas(['c', 'c', 7, null, 'extra', 'a'], catalogo)), ['c', 'a', 'b', 'nueva'])
  for (const valor of ['{', '{}', 'null', '7', '"c"', '[]']) {
    assert.deepEqual(copia(leerOrdenColumnas([{ clave: 'orden', valor }], 'orden', catalogo)), claves(catalogo))
  }
})

await probar('Clave obsoleta motivoCierre guardada se descarta en silencio sin afectar el resto', () => {
  for (const [catalogo, clavesConfig] of [[columnasReq, clavesReq], [columnasEntregas, clavesEntregas]]) {
    assert.equal(claves(catalogo).includes('motivoCierre'), false)
    const datos = [
      config(clavesConfig.columnas, ['horas', 'motivoCierre', 'sc']),
      config(clavesConfig.exportCampos, ['motivoCierre', 'codigoReq']),
      config(clavesConfig.ordenColumnas, ['sc', 'motivoCierre', 'horas']),
    ]
    assert.deepEqual([...leerCamposActivos(datos, clavesConfig.columnas, catalogo)], ['horas', 'sc'])
    assert.deepEqual([...leerCamposActivos(datos, clavesConfig.exportCampos, catalogo)], ['codigoReq'])
    // Solo claves obsoletas: vuelve a los valores por defecto, nunca a una tabla vacía.
    assert.deepEqual([...leerCamposActivos([config(clavesConfig.columnas, ['motivoCierre'])], clavesConfig.columnas, catalogo)],
      claves(catalogo.filter(columna => columna.porDefecto)))
    const orden = copia(leerOrdenColumnas(datos, clavesConfig.ordenColumnas, catalogo))
    assert.equal(orden.includes('motivoCierre'), false)
    assert.deepEqual(orden.filter(clave => ['sc', 'horas'].includes(clave)), ['sc', 'horas'])
    assert.equal(orden.length, catalogo.length)
  }
})

await probar('Posiciones visibles consecutivas, desplazamiento y ocultas sin alterar el resto', () => {
  const orden = ['a', 'oculta', 'b', 'c']
  const activas = new Set(['a', 'b', 'c'])
  const resultado = moverColumnaVisible(orden, activas, 'c', 1)
  assert.deepEqual(copia(resultado), ['c', 'oculta', 'a', 'b'])
  assert.deepEqual(copia(orden), ['a', 'oculta', 'b', 'c'])
  assert.deepEqual(copia(moverColumnaVisible(resultado, activas, 'c', 3)), orden)
  assert.deepEqual(claves(ordenarColumnasVisibles(orden.map(key => ({ key })), resultado, new Set(['b', 'c']))), ['c', 'b'])
  for (const posicion of [0, -1, 1.5, 4, NaN, Infinity]) {
    assert.throws(() => moverColumnaVisible(orden, activas, 'a', posicion), /posición/)
  }
  assert.throws(() => moverColumnaVisible(orden, activas, 'oculta', 1), /posición/)
})

const req = {
  id: 'req-prueba', codigo_req: 'REQ-731', nombre: 'EPM - Integración de pagos',
  estado: 'ESTIMACION APROBADA POR LT', total_horas_estimadas: 120,
  ans_acta: 'NO_CUMPLE', fecha_solicitud_acta: '2026-11-02',
  fecha_limite: '2026-11-12', fecha_real_entrega_estimacion: '2026-11-13',
  solicitud: { codigo_sc: 'SC-420', squad_id: 'squad', lt_hitss_id: 'lider', scrum_id: 'scrum' },
  entregas: [
    { numero: 1, horas: 24, porcentaje: 20, estado: 'APROBADA', fecha_comprometida: '2026-11-12', fecha_recepcion: '2026-11-13' },
    { numero: 2, horas: 36, porcentaje: 30, estado: 'PENDIENTE', fecha_comprometida: null, fecha_recepcion: null },
  ],
}
const propiedades = {
  datosFiltrados: [req], hayFiltrosActivos: false,
  expandedReqs: new Set(), estimacionIds: new Set(), estimacionesMap: {}, loadingReqEst: new Set(),
  toggleExpandReq: nada, expandedEntregas: new Set(), setExpandedEntregas: nada,
  renderCelda: (_req, campo, valor, tipo, rol) => h('span', { 'data-campo': campo, 'data-tipo': tipo, 'data-rol': rol }, valor),
  squadPorId: new Map([['squad', 'Squad Integraciones']]), nombrePersona: id => id === 'lider' ? 'Líder de prueba' : 'Scrum de prueba',
  CAMPO_ACCESOR_REQ: Object.fromEntries(columnasReq.map(columna => [columna.key, () => `extra:${columna.key}`])),
  uploadingId: null, puedeGestionarEstimaciones: true, handleUploadClick: nada, openEstimationModal: nada,
  puedeEditar: true, puedeEliminar: true, eliminar: nada,
}
function tablaReq(datosConfig, adicionales = {}) {
  function Vista() {
    return h(TablaRequerimientos, { ...propiedades, ...useCamposRequerimientos(datosConfig), ...adicionales })
  }
  return renderizar(h(Vista))
}

await probar('Requerimientos: todas las históricas y extras intercaladas, celdas y totales alineados', () => {
  const orden = ['entregasCount', 'fechaLimite', 'horas', ...claves(columnasReq).reverse()]
  const normalizadas = normalizarOrdenColumnas(orden, columnasReq)
  const datos = [config(clavesReq.columnas, claves(columnasReq)), config(clavesReq.ordenColumnas, orden)]
  const html = escritorio(tablaReq(datos))
  assert.deepEqual(celdas(primeraFila(html, 'thead')), [
    '', ...normalizadas.map(clave => columnasReq.find(columna => columna.key === clave).label), 'Est.', '',
  ])
  const fila = celdas(primeraFila(html, 'tbody'))
  const pie = celdas(primeraFila(piePrincipal(html), 'tfoot'))
  assert.equal(fila.length, normalizadas.length + 3)
  assert.equal(pie.length, fila.length)
  const esperados = {
    codigoReq: 'REQ-731', sc: 'SC-420', squad: 'Squad Integraciones', nombreActa: req.nombre,
    aplicacionEpm: 'EPM', estado: req.estado, ansEstimacion: 'No cumple', ltHitss: 'Líder de prueba',
    scrum: 'Scrum de prueba', horas: '120', fechaSolicitud: '2026-11-02', fechaLimite: '2026-11-12',
    fechaReal: '2026-11-13', diasTranscurridos: '-1', entregasCount: '2',
  }
  normalizadas.forEach((clave, indice) => {
    assert.equal(fila[indice + 1], esperados[clave] ?? `extra:${clave}`, clave)
    if (clave === 'horas') assert.equal(pie[indice + 1], '120')
    if (clave === 'entregasCount') assert.equal(pie[indice + 1], '2')
  })
  assert.match(html, /data-campo="lt_hitss_id" data-tipo="select-persona" data-rol="LT_HITSS"/)
  assert.match(html, /data-campo="scrum_id" data-tipo="select-persona" data-rol="SCRUM"/)
  assert.match(html, /data-campo="total_horas_estimadas" data-tipo="number"/)
  assert.match(html, /href="\/SistemaIntegrado\/requerimientos\/req-prueba"/)
  assert.match(fila.at(-1), /EditarEliminar/)
})

await probar('Requerimientos: móvil idéntico y extras conservan el orden histórico en tarjetas', () => {
  const visibilidad = config(clavesReq.columnas, claves(columnasReq))
  const original = tablaReq([visibilidad])
  const ordenada = tablaReq([visibilidad, config(clavesReq.ordenColumnas, claves(columnasReq).reverse())])
  assert.equal(movil(ordenada), movil(original))
})

await probar('Requerimientos: métricas solas, muchas filas, nombres largos y acciones según permisos', () => {
  for (const orden of [['horas', 'entregasCount'], ['entregasCount', 'horas']]) {
    const html = escritorio(tablaReq([
      config(clavesReq.columnas, orden), config(clavesReq.ordenColumnas, orden),
    ]))
    const totales = celdas(primeraFila(html, 'tfoot'))
    assert.equal(totales.length, 5)
    orden.forEach((clave, indice) => assert.match(totales[indice + 1], clave === 'horas' ? /120$/ : /2$/))
    assert.match(totales[3], /Total \(1 requerimientos\)/)
  }
  const requerimientos = Array.from({ length: 150 }, (_, indice) => ({
    ...req, id: `req-${indice}`, nombre: 'Nombre largo de integración '.repeat(15),
  }))
  const html = escritorio(tablaReq([
    config(clavesReq.columnas, ['horas', 'nombreActa', 'fechaLimite', 'entregasCount']),
    config(clavesReq.ordenColumnas, ['horas', 'fechaLimite', 'nombreActa', 'entregasCount']),
  ], {
    datosFiltrados: requerimientos, puedeEditar: false, puedeEliminar: false, puedeGestionarEstimaciones: false,
  }))
  assert.equal((html.match(/<tbody>[\s\S]*?<\/tbody>/)?.[0].match(/<tr\b/g) ?? []).length, 150)
  assert.doesNotMatch(html, />Editar<|>Eliminar<|Cargar estimación/)
  const totales = celdas(primeraFila(html, 'tfoot'))
  assert.equal(totales[1], (150 * 120).toLocaleString('es-CO'))
  assert.equal(totales[4], '300')
  assert.match(totales[2], /Total \(150 requerimientos\)/)
})

await probar('Reordenar mantiene los handlers de expandir, entregas, carga, estimación y eliminar', async () => {
  const { FilaRequerimiento } = cargarTypeScript(ruta('pages/requerimientos/FilaRequerimiento.tsx'), {}, modulosUi)
  const llamadas = []
  let expandidas = new Set()
  function nodos(elemento) {
    if (!React.isValidElement(elemento)) return []
    return [elemento, ...React.Children.toArray(elemento.props.children).flatMap(nodos)]
  }
  function fila(adicionales) {
    return nodos(FilaRequerimiento({
      ...propiedades, req, columnasActivas: new Set(['horas', 'entregasCount']),
      columnasExtra: [], columnasOrdenadas: [columnasReq.find(columna => columna.key === 'entregasCount'),
        columnasReq.find(columna => columna.key === 'horas')],
      hasEst: true, isExpanded: false, isLoadingEstimacion: false,
      toggleExpandReq: async id => { llamadas.push(`expandir:${id}`) },
      openEstimationModal: async id => { llamadas.push(`estimacion:${id}`) },
      handleUploadClick: id => llamadas.push(`cargar:${id}`),
      eliminar: async valor => { llamadas.push(`eliminar:${valor.id}`) },
      setExpandedEntregas: actualizar => { expandidas = actualizar(expandidas) },
      ...adicionales,
    }))
  }
  const elementos = fila()
  elementos.find(elemento => elemento.type === 'button' && !elemento.props.title
    && elemento.props.className.includes('text-slate-400')).props.onClick()
  elementos.find(elemento => elemento.props.title === 'Ver entregas').props.onClick()
  assert.equal(expandidas.has(req.id), true)
  elementos.find(elemento => elemento.props.title === 'Ver entregas').props.onClick()
  assert.equal(expandidas.size, 0)
  elementos.find(elemento => elemento.props.title === 'Ver estimación').props.onClick()
  elementos.find(elemento => elemento.type === 'button' && elemento.props.children === 'Eliminar').props.onClick()
  fila({ hasEst: false }).find(elemento => elemento.props.title === 'Cargar estimación (Excel)').props.onClick()
  await Promise.resolve()
  assert.deepEqual(llamadas, [
    `expandir:${req.id}`, `estimacion:${req.id}`, `eliminar:${req.id}`, `cargar:${req.id}`,
  ])
})

await probar('Subfilas completas: colSpan real, HU agrupadas, entregas y tablas internas sin reordenar', () => {
  const datos = [config(clavesReq.columnas, ['horas', 'sc', 'entregasCount', 'fechaLimite']),
    config(clavesReq.ordenColumnas, ['entregasCount', 'fechaLimite', 'sc', 'horas'])]
  const estimacion = { filas: [
    { numero: 1, historia_usuario: 'HU Pagos', epica_feature: 'Integraciones', horas_estimadas: 10, horas_totales: 11 },
    { numero: 2, historia_usuario: 'HU Pagos', epica_feature: 'Integraciones', horas_estimadas: 20, horas_totales: 22 },
  ] }
  const html = escritorio(tablaReq(datos, {
    expandedReqs: new Set([req.id]), expandedEntregas: new Set([req.id]),
    estimacionIds: new Set([req.id]), estimacionesMap: { [req.id]: estimacion },
  }))
  assert.equal((html.match(/colspan="7"/gi) ?? []).length, 2)
  assert.match(html, /# Entrega<\/th>[\s\S]*?Horas<\/th>[\s\S]*?Fecha comprometida<\/th>/)
  assert.match(html, /Historia de Usuario<\/th>[\s\S]*?Épica\/Feature<\/th>[\s\S]*?Tareas<\/th>/)
  assert.equal((html.match(/HU Pagos/g) ?? []).length, 1)
  assert.match(html, />30<\/td>/)
  assert.match(html, />33<\/td>/)
  const vacio = escritorio(tablaReq(datos, { datosFiltrados: [] }))
  assert.match(vacio, /colspan="7"[^>]*>Sin requerimientos\./i)
  const sinEstimacion = escritorio(tablaReq(datos, { expandedReqs: new Set([req.id]) }))
  assert.match(sinEstimacion, /colspan="7"[^>]*>Sin datos de estimación/i)
  const cargando = escritorio(tablaReq(datos, {
    expandedReqs: new Set([req.id]), loadingReqEst: new Set([req.id]), estimacionIds: new Set([req.id]),
  }))
  assert.match(cargando, /animate-spin/)
  assert.doesNotMatch(cargando, /Sin datos de estimación/)
})

let exportacion
const xlsx = {
  utils: {
    json_to_sheet: filas => { exportacion = filas; return {} },
    book_new: () => ({}), book_append_sheet: nada,
  },
  writeFile: nada,
}
const analitica = { exportar: (_nombre, accion) => accion() }
function entregas(datosConfig, opciones = {}) {
  let exportar
  const { default: EntregasActas } = cargarTypeScript(ruta('pages/EntregasActas.tsx'), {}, {
    '../api/client': { default: {} },
    '../api/hooks': { useLista: endpoint => ({
      datos: endpoint === '/requerimientos' ? opciones.reqs ?? [req] : endpoint === '/configuracion' ? datosConfig : [],
      cargando: !!opciones.cargando, error: opciones.error ?? '', recargar: nada,
    }) },
    '../context/AuthContext': { useAuth: () => ({ tienePermiso: () => true }) },
    '../context/AplicacionContext': { useAplicacion: () => ({ activa: 'epm-hitss' }) },
    '../analitica': { analitica }, xlsx,
    '../components/ui': { ...ui, Boton: props => {
      if (props.children === 'Exportar a Excel') exportar = props.onClick
      return h(ui.Boton, props)
    } },
  })
  const html = renderizar(h(EntregasActas))
  return { html, exportar: () => exportar() }
}

await probar('Entregas: cabecera/celdas/suma/promedio siguen las claves, no posiciones finales', () => {
  const datos = [
    config(clavesEntregas.columnas, ['horas', 'sc', 'porcentaje', 'codigoReq']),
    config(clavesEntregas.ordenColumnas, ['porcentaje', 'sc', 'horas', 'codigoReq']),
  ]
  const { html } = entregas(datos)
  assert.deepEqual(celdas(primeraFila(html, 'thead')), ['% Avance', 'SC', 'Horas', 'Código REQ'])
  assert.deepEqual(celdas(primeraFila(html, 'tbody')), ['20%', 'SC-420', '24', 'REQ-731'])
  assert.deepEqual(celdas(primeraFila(html, 'tfoot')), ['25%', 'Total (2 entregas)', '60', ''])
  const soloMetricas = entregas([config(clavesEntregas.columnas, ['horas', 'porcentaje']),
    config(clavesEntregas.ordenColumnas, ['porcentaje', 'horas'])]).html
  const pie = celdas(primeraFila(soloMetricas, 'tfoot'))
  assert.equal(pie.length, 2)
  assert.match(pie[0], /25%$/)
  assert.equal(pie[1], '60')
  const ordenCompleto = claves(columnasEntregas).reverse()
  const todas = entregas([
    config(clavesEntregas.columnas, claves(columnasEntregas)),
    config(clavesEntregas.ordenColumnas, ordenCompleto),
  ]).html
  assert.deepEqual(celdas(primeraFila(todas, 'thead')),
    ordenCompleto.map(clave => columnasEntregas.find(columna => columna.key === clave).label))
  const filaCompleta = celdas(primeraFila(todas, 'tbody'))
  const pieCompleto = celdas(primeraFila(todas, 'tfoot'))
  assert.equal(filaCompleta.length, columnasEntregas.length)
  assert.equal(pieCompleto.length, columnasEntregas.length)
  assert.equal(filaCompleta[ordenCompleto.indexOf('reqEstado')], req.estado)
  assert.equal(filaCompleta[ordenCompleto.indexOf('totalHorasEstimadas')], '120')
  assert.equal(pieCompleto[ordenCompleto.indexOf('horas')], '60')
  assert.equal(pieCompleto[ordenCompleto.indexOf('porcentaje')], '25%')
  assert.match(entregas(datos, { cargando: true }).html, /colspan="4"[^>]*>Cargando…/i)
  assert.match(entregas(datos, { reqs: [] }).html, /colspan="4"[^>]*>Sin entregas\./i)
  assert.match(entregas(datos, { error: 'Error de prueba' }).html, /Error de prueba/)
})

await probar('Excel de ambas pantallas mantiene su catálogo aunque cambie el orden de las tablas', () => {
  const activas = new Set(['horas', 'codigoReq', 'sc'])
  const { useExportarExcel } = cargarTypeScript(ruta('pages/requerimientos/useExportarExcel.ts'), {}, {
    xlsx, '../../analitica': { analitica },
  })
  useExportarExcel(true, activas, [req], propiedades.CAMPO_ACCESOR_REQ).exportarExcel()
  assert.deepEqual(Object.keys(exportacion[0]), ['Código REQ', 'SC', 'Horas'])
  const datos = [
    config(clavesEntregas.exportCampos, [...activas]),
    config(clavesEntregas.ordenColumnas, ['horas', 'sc', 'codigoReq']),
  ]
  entregas(datos).exportar()
  assert.deepEqual(Object.keys(exportacion[0]), ['Código REQ', 'SC', 'Horas'])
})

await probar('Administración: selector numérico accesible solo en activas y bloqueo durante guardado', () => {
  for (const [catalogo, filtrosCatalogo] of [[columnasReq, filtrosReq], [columnasEntregas, filtrosEntregas]]) {
    const html = renderizar(h(SeccionCamposConfigurables, {
      descripcion: 'Configuración de prueba', columnasCatalogo: catalogo, filtrosCatalogo,
      columnas: new Set(['sc', 'horas']), filtros: new Set(), exportCampos: new Set(),
      ordenColumnas: ['horas', 'sc', ...claves(catalogo).filter(clave => !['sc', 'horas'].includes(clave))],
      aviso: '', ok: '', guardando: true,
      cambiarPosicion: nada, alternarColumna: nada, alternarFiltro: nada, alternarExport: nada,
    }))
    const selectores = [...html.matchAll(/<select\b[^>]*>[\s\S]*?<\/select>/g)].map(coincidencia => coincidencia[0])
    assert.equal(selectores.length, 2)
    assert.ok(selectores.every(selector => /aria-label="Posición de /.test(selector)))
    assert.match(selectores.find(selector => /Posición de Horas/.test(selector)), /value="1" selected=""/)
    assert.match(selectores.find(selector => /Posición de SC/.test(selector)), /value="2" selected=""/)
    assert.ok(selectores.every(selector => (selector.match(/<option/g) ?? []).length === 2))
    assert.match(html, /<fieldset[^>]*disabled=""/)
    assert.match(html, /no a Excel/)
  }
})

// Motor mínimo de hooks para comprobar transacciones y carreras sin navegador.
function montarCampos(parametros, transporte, bloqueoGuardado = { current: false }) {
  const estados = []
  const referencias = []
  const dependencias = []
  let indiceEstado = 0
  let indiceRef = 0
  let indiceEfecto = 0
  let efectos = []
  const react = {
    useState(inicial) {
      const indice = indiceEstado++
      if (!(indice in estados)) estados[indice] = typeof inicial === 'function' ? inicial() : inicial
      return [estados[indice], valor => {
        estados[indice] = typeof valor === 'function' ? valor(estados[indice]) : valor
      }]
    },
    useRef(inicial) {
      const indice = indiceRef++
      return referencias[indice] ??= { current: inicial }
    },
    useEffect(efecto, nuevas) {
      const indice = indiceEfecto++
      if (!dependencias[indice] || nuevas.some((valor, posicion) => valor !== dependencias[indice][posicion])) {
        dependencias[indice] = nuevas
        efectos.push(efecto)
      }
    },
  }
  const { useCamposConfigurables } = cargarTypeScript(ruta('pages/configuracion/useCamposConfigurables.ts'), {}, {
    react, '../../api/client': { default: { put: transporte } },
    '../../api/hooks': { mensajeError: () => 'Error de guardado de prueba' },
  })
  function invocar() {
    indiceEstado = indiceRef = indiceEfecto = 0
    efectos = []
    return useCamposConfigurables({ ...parametros, bloqueoGuardado })
  }
  return {
    renderizar(cambios = {}) {
      Object.assign(parametros, cambios)
      invocar()
      efectos.forEach(efecto => efecto())
      return invocar()
    },
  }
}
const esperar = () => new Promise(resolve => setImmediate(resolve))

await probar('Persistencia: clave independiente, sin PUT en GET, bloqueo compartido y sin éxito falso', async () => {
  const peticiones = []
  let resolver
  let rechazar
  let recargas = 0
  const bloqueo = { current: false }
  const transporte = (url, cuerpo) => {
    peticiones.push({ url, cuerpo })
    return new Promise((res, rej) => { resolver = res; rechazar = rej })
  }
  const parametros = {
    datos: [config(clavesReq.columnas, ['sc', 'horas', 'codigoReq'])], recargar: () => { recargas++ },
    configClaves: clavesReq, columnasCatalogo: columnasReq, filtrosCatalogo: filtrosReq,
    grupo: 'requerimientos', cargando: false,
  }
  const montaje = montarCampos({ ...parametros }, transporte, bloqueo)
  const otro = montarCampos({
    ...parametros, configClaves: clavesEntregas, columnasCatalogo: columnasEntregas, filtrosCatalogo: filtrosEntregas,
  }, transporte, bloqueo)
  let estado = montaje.renderizar()
  const estadoOtro = otro.renderizar()
  assert.equal(peticiones.length, 0)
  estado.cambiarPosicion('horas', 1)
  estado.cambiarPosicion('sc', 1)
  estadoOtro.cambiarPosicion('horas', 1)
  estado.alternarColumna('squad')
  assert.equal(peticiones.length, 1)
  assert.equal(peticiones[0].url, `/configuracion/${clavesReq.ordenColumnas}`)
  assert.equal(peticiones[0].cuerpo.grupo, 'requerimientos')
  assert.deepEqual(copia(JSON.parse(peticiones[0].cuerpo.valor).filter(clave => estado.columnas.has(clave))),
    ['horas', 'codigoReq', 'sc'])
  assert.equal(montaje.renderizar().guardando, true)
  resolver({})
  await esperar()
  estado = montaje.renderizar({ cargando: true })
  assert.equal(estado.ok, 'Configuración guardada.')
  assert.equal(recargas, 1)
  estado.cambiarPosicion('sc', 1)
  assert.equal(peticiones.length, 1)
  // Una respuesta GET vieja no pisa un orden confirmado por PUT.
  estado = montaje.renderizar({ cargando: false, datos: [...parametros.datos] })
  assert.equal(estado.ordenColumnas[0], 'horas')
  const guardado = [...parametros.datos, { clave: clavesReq.ordenColumnas, valor: peticiones[0].cuerpo.valor }]
  estado = montaje.renderizar({ datos: guardado })
  estado.cambiarPosicion('sc', 1)
  rechazar(new Error('fallo'))
  await esperar()
  estado = montaje.renderizar()
  assert.equal(estado.ok, '')
  assert.equal(estado.aviso, 'Error de guardado de prueba')
  assert.equal(estado.ordenColumnas[0], 'horas')
  assert.equal(estado.guardando, false)
  assert.equal(recargas, 1)
  for (const posicion of [0, -2, 1.5, 4, NaN]) estado.cambiarPosicion('sc', posicion)
  assert.equal(peticiones.length, 2)
  assert.notEqual(montaje.renderizar().aviso, '')
  // Alternar visibilidad guarda solo su clave: jamás persiste orden ni toca Excel/filtros.
  estado.alternarColumna('squad')
  assert.equal(peticiones.at(-1).url, `/configuracion/${clavesReq.columnas}`)
  resolver({})
  await esperar()
  estado = montaje.renderizar()
  assert.equal(estado.columnas.has('squad'), true)
  assert.equal(estado.ordenColumnas[0], 'horas')
})

console.log(`${casos} pruebas de orden de columnas completadas.`)

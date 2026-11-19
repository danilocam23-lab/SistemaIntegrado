// Ejecutar desde web; datos sintéticos, sin navegador, red ni dependencias nuevas.
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server.js'
import { cargarTypeScript } from './cargar-typescript.mjs'

const {
  SIN_ANALISTA, anoInicialAnalistas, anosAnalistas, mesCalendario,
  opcionesAnalistas, prepararRegistrosAnalistas, resumirAnalistas,
} = cargarTypeScript(new URL('../src/pages/dashboard-requerimientos/calculoAnalistas.ts', import.meta.url))

const personas = [
  { id: 'leonor', nombre: 'Leonor de prueba', activo: false, rol_operativo: 'DEV' },
  { id: 'andres', nombre: 'Andrés de prueba', activo: true, rol_operativo: 'AR/QA' },
]
let secuencia = 0
function entrega(cambios = {}) {
  return {
    numero: 1, fecha_recepcion: '2026-10-12', fecha_comprometida: '2026-09-30',
    ans_entrega: 'NO_CUMPLE', tipificacion: null, ...cambios,
  }
}
function requerimiento(cambios = {}) {
  return {
    id: `req-${++secuencia}`, estado: 'EN_EJECUCION',
    solicitud: { analista_requerimientos_id: 'leonor' },
    fecha_solicitud_acta: '2026-10-01', fecha_inicio: '2025-08-01',
    ans_acta: 'NO_CUMPLE', ans_estimacion: 'CUMPLE',
    tipificacion: null, entregas: [], ...cambios,
  }
}
function resumir(reqs, filtro = {}) {
  const resultado = resumirAnalistas(
    prepararRegistrosAnalistas(reqs), opcionesAnalistas(reqs, personas),
    { ano: '2026', mes: '10', analista: '', ...filtro },
  )
  verificarParidadDetalle(resultado)
  return resultado
}
function renderizarDetalle(reqs, permiteVer = true) {
  const contenedor = ({ children }) => createElement('div', null, children)
  const { default: DashboardAnalistas } = cargarTypeScript(
    new URL('../src/pages/DashboardAnalistas.tsx', import.meta.url), {}, {
      '../api/hooks': {
        useLista: ruta => ({
          datos: ruta === '/requerimientos' ? reqs : personas,
          cargando: false, error: null, recargar() {},
        }),
      },
      '../context/AuthContext': {
        useAuth: () => ({ tienePermiso: permiso => permiteVer && permiso === 'requerimientos.ver' }),
      },
      '../components/ui': Object.fromEntries([
        'Aviso', 'BarraFiltros', 'Boton', 'Chip', 'EncabezadoPagina', 'Icono',
        'Selector', 'TablaScroll', 'Tarjeta',
      ].map(nombre => [nombre, contenedor])),
      '../components/ui/graficas': {
        COLOR_GRAFICA: {}, ContenedorGrafica: () => null, TooltipGrafica: () => null,
        ejeCategoria: () => ({}), ejeValor: () => ({}),
        etiquetaBarra: () => ({}), rejilla: () => ({}),
      },
      recharts: Object.fromEntries([
        'Bar', 'BarChart', 'CartesianGrid', 'LabelList', 'Tooltip', 'XAxis', 'YAxis',
      ].map(nombre => [nombre, contenedor])),
    },
  )
  return renderToStaticMarkup(createElement(
    StaticRouter,
    { basename: '/SistemaIntegrado', location: '/SistemaIntegrado/dashboard-analistas' },
    createElement(DashboardAnalistas),
  ))
}
function verificarParidadDetalle(resultado) {
  const analistas = new Set([
    ...resultado.filas.map(fila => fila.id),
    ...resultado.detalles.map(detalle => detalle.analista),
  ])
  for (const analista of analistas) {
    const detalles = resultado.detalles.filter(detalle => detalle.analista === analista)
    assert.deepEqual([
      detalles.filter(detalle => detalle.tipo === 'requerimiento' && detalle.noCumpleReal).length,
      detalles.filter(detalle => detalle.tipo === 'requerimiento' && detalle.noCumpleHitss).length,
      detalles.filter(detalle => detalle.tipo === 'entrega' && detalle.noCumpleReal).length,
      detalles.filter(detalle => detalle.tipo === 'entrega' && detalle.noCumpleHitss).length,
    ], conteos(resultado, analista))
  }
  assert.ok(resultado.detalles.every(detalle => detalle.noCumpleReal))
  assert.equal(new Set(resultado.detalles.map(detalle => detalle.clave)).size, resultado.detalles.length)
}
function observacionesRenderizadas(html) {
  return [...html.matchAll(/<td><div class="[^"]*whitespace-pre-wrap[^"]*">([\s\S]*?)<\/div><\/td>/g)]
    .map(coincidencia => coincidencia[1])
}
function conteos(resumen, id = 'persona:leonor') {
  const fila = resumen.filas.find(fila => fila.id === id)
  return fila ? [fila.requerimientosReal, fila.requerimientosHitss, fila.entregasReal, fila.entregasHitss]
    : [0, 0, 0, 0]
}
function congelar(valor) {
  if (valor && typeof valor === 'object') {
    Object.freeze(valor)
    Object.values(valor).forEach(congelar)
  }
  return valor
}
let casos = 0
function probar(nombre, prueba) {
  prueba()
  casos++
  console.log(`OK: ${nombre}`)
}

probar('Leonor octubre: 10 requerimientos, dos analistas y octubre de años distintos', () => {
  const reqs = [
    ...Array.from({ length: 10 }, () => requerimiento()),
    requerimiento({ fecha_solicitud_acta: '2025-10-01' }),
    requerimiento({ solicitud: { analista_requerimientos_id: 'andres' } }),
  ]
  const resultado = resumir(reqs)
  assert.deepEqual(conteos(resultado), [10, 10, 0, 0])
  assert.deepEqual(conteos(resultado, 'persona:andres'), [1, 1, 0, 0])
  assert.deepEqual(conteos(resumir(reqs, { ano: '2025' })), [1, 1, 0, 0])
  const filtrado = resumir(reqs, { analista: 'persona:leonor' })
  assert.equal(filtrado.filas.length, 1)
  assert.equal(filtrado.registrosPeriodo, 10)
})

probar('Usa ans_acta y no ans_estimacion; normaliza solo los valores ANS admitidos', () => {
  const reqs = [
    requerimiento({ ans_acta: 'CUMPLE', ans_estimacion: 'NO_CUMPLE' }),
    requerimiento({ ans_acta: ' Nó   cúmple ', ans_estimacion: 'CUMPLE' }),
    ...[null, '', 'PENDIENTE', 'incorrecto'].map(ans_acta => requerimiento({ ans_acta })),
  ]
  const resultado = resumir(reqs)
  assert.deepEqual(conteos(resultado), [1, 1, 0, 0])
  assert.equal(resultado.registrosPeriodo, 2)
})

probar('Un requerimiento y varias entregas se cuentan de forma independiente', () => {
  const resultado = resumir([requerimiento({
    entregas: [entrega(), entrega({ numero: 2 }), entrega({ numero: 3, ans_entrega: 'CUMPLE' })],
  })])
  assert.deepEqual(conteos(resultado), [1, 1, 2, 2])
  assert.equal(resultado.registrosPeriodo, 4)
})

probar('Recepción prioritaria y comprometida solo como fallback nulo, sin fallback al padre', () => {
  const reqs = [requerimiento({ entregas: [
    entrega(), // Recepción octubre, compromiso septiembre: entra en octubre.
    entrega({ numero: 2, fecha_recepcion: null, fecha_comprometida: '2026-10-22' }),
    entrega({ numero: 3, fecha_recepcion: '2026-11-01', fecha_comprometida: '2026-10-22' }),
    entrega({ numero: 4, fecha_recepcion: '', fecha_comprometida: '2026-10-22' }),
    entrega({ numero: 5, fecha_recepcion: null, fecha_comprometida: null }),
  ] })]
  assert.deepEqual(conteos(resumir(reqs)), [1, 1, 2, 2])
  assert.deepEqual(conteos(resumir(reqs, { mes: '11' })), [0, 0, 1, 1])
  assert.equal(resumir(reqs).entregasSinFecha, 2)
})

probar('EPM se excluye solo de HITSS y entregas NO heredan tipificación del padre', () => {
  const reqs = [
    requerimiento({ tipificacion: 'EPM', entregas: [entrega(), entrega({ numero: 2, tipificacion: 'HITSS' })] }),
    requerimiento({ tipificacion: 'HITSS', entregas: [entrega({ tipificacion: 'EPM' })] }),
  ]
  const resultado = resumir(reqs)
  assert.deepEqual(conteos(resultado), [2, 1, 3, 2])
  assert.equal(resultado.detalles.length, 5) // No agrega variantes HITSS duplicadas.
  const atribuidosEpm = resultado.detalles.filter(detalle => detalle.tipificacion === 'EPM')
  assert.equal(atribuidosEpm.length, 2)
  assert.ok(atribuidosEpm.every(detalle => detalle.noCumpleReal && !detalle.noCumpleHitss))
  assert.ok(resultado.detalles.filter(detalle => detalle.tipificacion !== 'EPM')
    .every(detalle => detalle.noCumpleHitss))
})

probar('Cancelados y reemplazados excluyen requerimiento y todas sus entregas', () => {
  const reqs = ['CANCELADO', 'REEMPLAZADO', 'cancelado por usuario', 'ACTIVO']
    .map(estado => requerimiento({ estado, entregas: [entrega()] }))
  assert.deepEqual(conteos(resumir(reqs)), [1, 1, 1, 1])
})

probar('Sin analista agrupa null, vacío, omitido o solicitud ausente; entrega hereda analista', () => {
  const reqs = [
    requerimiento({ solicitud: { analista_requerimientos_id: null }, entregas: [entrega()] }),
    requerimiento({ solicitud: { analista_requerimientos_id: '' } }),
    requerimiento({ solicitud: {} }),
    requerimiento({ solicitud: null }),
  ]
  const resultado = resumir(reqs, { analista: SIN_ANALISTA })
  assert.equal(resultado.filas.length, 1)
  assert.equal(resultado.filas[0].nombre, 'Sin analista')
  assert.deepEqual(conteos(resultado, SIN_ANALISTA), [4, 4, 1, 1])
  assert.ok(resultado.detalles.every(detalle => detalle.nombreAnalista === 'Sin analista'))
})

probar('Conserva nombre del inactivo/rol cambiado y separa IDs huérfanos', () => {
  const reqs = [
    requerimiento(),
    requerimiento({ solicitud: { analista_requerimientos_id: 'huerfano-a' } }),
    requerimiento({ solicitud: { analista_requerimientos_id: 'huerfano-b' } }),
  ]
  const opciones = opcionesAnalistas(reqs, personas)
  assert.equal(opciones.find(opcion => opcion.id === 'persona:leonor').nombre, 'Leonor de prueba')
  assert.equal(opciones.length, 3)
  assert.ok(opciones.filter(opcion => opcion.id.includes('huerfano'))
    .every(opcion => opcion.nombre.startsWith('Analista no disponible')))
  assert.equal(new Set(opciones.map(opcion => opcion.nombre)).size, 3)
  const resultado = resumir(reqs)
  assert.equal(resultado.filas.length, 3)
  assert.ok(resultado.detalles.filter(detalle => detalle.analista.includes('huerfano'))
    .every(detalle => /^Analista no disponible \(\d+\)$/.test(detalle.nombreAnalista)))
})

probar('Dos personas con el mismo nombre nunca fusionan sus conteos', () => {
  const reqs = [requerimiento(), requerimiento({ solicitud: { analista_requerimientos_id: 'andres' } })]
  const opciones = opcionesAnalistas(reqs, personas.map(p => ({ ...p, nombre: 'Mismo nombre' })))
  const resultado = resumirAnalistas(prepararRegistrosAnalistas(reqs), opciones, { ano: '2026', mes: '10', analista: '' })
  assert.equal(resultado.filas.length, 2)
  assert.deepEqual(conteos(resultado), [1, 1, 0, 0])
})

probar('Sin fecha no inventa mes ni usa fecha_inicio; aviso no se atribuye al año filtrado', () => {
  const reqs = [
    requerimiento({ fecha_solicitud_acta: null, fecha_inicio: '2026-10-01' }),
    requerimiento({ fecha_solicitud_acta: '2026-13-01' }),
    requerimiento({ fecha_solicitud_acta: '2026-02-30' }),
    requerimiento({ fecha_solicitud_acta: null, solicitud: { analista_requerimientos_id: 'andres' } }),
  ]
  const resultado = resumir(reqs, { analista: 'persona:leonor', ano: '2025' })
  assert.equal(resultado.registrosPeriodo, 0)
  assert.equal(resultado.filas.length, 0)
  assert.equal(resultado.detalles.length, 0)
  assert.equal(resultado.requerimientosSinFecha, 3)
})

probar('Calendario no cambia con zona horaria, valida bisiestos y no excluye fechas futuras', () => {
  assert.equal(mesCalendario('2026-10-01T00:01:00+14:00'), '2026-10')
  assert.equal(mesCalendario('2026-10-31T23:59:00-05:00'), '2026-10')
  assert.equal(mesCalendario('2024-02-29'), '2024-02')
  for (const fecha of ['2025-02-29', '2026-00-01', '2026-10', 'octubre', '', null]) {
    assert.equal(mesCalendario(fecha), null)
  }
  assert.deepEqual(conteos(resumir([requerimiento({ fecha_solicitud_acta: '2099-10-01' })], { ano: '2099' })), [1, 1, 0, 0])
})

probar('Todos los meses suma solo el año elegido; filtros aplican por separado a entregas', () => {
  const reqs = [
    requerimiento({ entregas: [entrega({ fecha_recepcion: '2025-10-01' })] }),
    requerimiento({ fecha_solicitud_acta: '2026-11-01', entregas: [entrega()] }),
    requerimiento({ fecha_solicitud_acta: '2025-10-01' }),
  ]
  assert.deepEqual(conteos(resumir(reqs)), [1, 1, 1, 1])
  assert.deepEqual(conteos(resumir(reqs, { mes: '' })), [2, 2, 1, 1])
  assert.deepEqual(conteos(resumir(reqs, { ano: '2025' })), [1, 1, 1, 1])
})

probar('Año inicial actual si hay datos; si no, último disponible, sin mutar años', () => {
  const anos = congelar(['2024', '2025'])
  assert.equal(anoInicialAnalistas(anos, '2026'), '2025')
  assert.equal(anoInicialAnalistas(['2024', '2026', '2027'], '2026'), '2026')
  assert.equal(anoInicialAnalistas([], '2026'), '2026')
  const registros = prepararRegistrosAnalistas([
    requerimiento({ fecha_solicitud_acta: '2024-10-01', entregas: [entrega()] }),
  ])
  assert.equal(JSON.stringify(anosAnalistas(registros)), '["2026","2024"]')
})

probar('Vacío, solo cumple e inválidos no generan falsos incumplimientos', () => {
  assert.equal(resumir([]).registrosPeriodo, 0)
  const resultado = resumir([requerimiento({ ans_acta: 'CUMPLE', entregas: [entrega({ ans_entrega: 'no aplica' })] })])
  assert.equal(resultado.registrosPeriodo, 1)
  assert.equal(resultado.filas.length, 0)
  assert.equal(resultado.detalles.length, 0)
})

probar('Detalle identifica requerimiento, acta de trabajo y cada entrega; conserva fecha de calendario', () => {
  const req = requerimiento({
    codigo_req: 'REQ-0142', acta_trabajo: 'AT-2026-087', nombre: 'Ajuste de facturación',
    fecha_solicitud_acta: '2026-10-01T00:01:00+14:00',
    entregas: [
      entrega({ numero: 3, fecha_recepcion: '2026-10-31T23:59:00-05:00' }),
      entrega({ numero: 4, fecha_recepcion: null, fecha_comprometida: '2026-10-22' }),
      entrega({ numero: 5, ans_entrega: 'CUMPLE' }),
    ],
  })
  const resultado = resumir([req])
  assert.deepEqual(Array.from(resultado.detalles, detalle => [
    detalle.requerimientoId, detalle.codigoReq, detalle.acta, detalle.nombreAnalista,
    detalle.tipo, detalle.numeroEntrega, detalle.fechaReferencia,
  ]), [
    [req.id, 'REQ-0142', 'AT-2026-087', 'Leonor de prueba', 'requerimiento', null, '2026-10-01'],
    [req.id, 'REQ-0142', 'AT-2026-087', 'Leonor de prueba', 'entrega', 3, '2026-10-31'],
    [req.id, 'REQ-0142', 'AT-2026-087', 'Leonor de prueba', 'entrega', 4, '2026-10-22'],
  ])
  assert.equal(resultado.detalles.length, 3)
})

probar('Acta usa nombre solo si no hay identificador, y nunca sustituye etiquetas por IDs', () => {
  const resultado = resumir([
    requerimiento({ acta_trabajo: ' ', nombre: 'Migración de reportes' }),
    requerimiento({ acta_trabajo: null, nombre: null, codigo_req: '' }),
  ])
  assert.deepEqual(Array.from(resultado.detalles, detalle => detalle.acta), ['Migración de reportes', 'Sin acta'])
  assert.equal(resultado.detalles[1].codigoReq, '—')
})

probar('Observaciones usa seguimiento del requerimiento y el texto de cada entrega sin cruzarlos ni mutar', () => {
  const reqs = congelar([requerimiento({
    seguimiento: 'Pendiente validación del acta',
    entregas: [
      entrega({ observaciones_hitss: 'Primera entrega: ajustar evidencias' }),
      entrega({ numero: 2, observaciones_hitss: 'Segunda entrega: pendiente aprobación' }),
    ],
  })])
  const original = JSON.stringify(reqs)
  const resultado = resumir(reqs)
  const textos = [
    'Pendiente validación del acta',
    'Primera entrega: ajustar evidencias',
    'Segunda entrega: pendiente aprobación',
  ]
  assert.deepEqual(Array.from(resultado.detalles, detalle => [
    detalle.tipo, detalle.numeroEntrega, detalle.observacionesHitss,
  ]), [
    ['requerimiento', null, textos[0]],
    ['entrega', 1, textos[1]],
    ['entrega', 2, textos[2]],
  ])
  assert.deepEqual(observacionesRenderizadas(renderizarDetalle(reqs)), textos)
  assert.deepEqual(conteos(resultado), [1, 1, 2, 2])
  assert.equal(JSON.stringify(reqs), original)
})

probar('Observaciones nulas, omitidas, vacías o con espacios muestran —; entregas nunca heredan seguimiento', () => {
  const vacios = [null, undefined, '', ' \n\t ']
  const reqs = [requerimiento({
    seguimiento: 'Seguimiento exclusivo del padre',
    entregas: vacios.map((observaciones_hitss, indice) =>
      entrega({ numero: indice + 1, observaciones_hitss })),
  })]
  const resultado = resumir(reqs)
  assert.deepEqual(Array.from(resultado.detalles.filter(detalle => detalle.tipo === 'entrega'),
    detalle => detalle.observacionesHitss), vacios)
  assert.deepEqual(observacionesRenderizadas(renderizarDetalle(reqs)),
    ['Seguimiento exclusivo del padre', ...vacios.map(() => '—')])
  assert.deepEqual(observacionesRenderizadas(renderizarDetalle(
    vacios.map(seguimiento => requerimiento({ seguimiento })),
  )), vacios.map(() => '—'))
  const registros = prepararRegistrosAnalistas(reqs).map(registro => {
    const identificacion = { ...registro.identificacion }
    delete identificacion.observacionesHitss
    return { ...registro, identificacion }
  })
  const anterior = resumirAnalistas(registros, [], { ano: '2026', mes: '10', analista: '' })
  assert.ok(anterior.detalles.every(detalle => detalle.observacionesHitss === undefined))
})

probar('Observaciones multilínea conservan espacios y HTML literal escapado, con ayuda accesible y sin analítica', () => {
  const reqs = [requerimiento({
    seguimiento: '  Línea uno\nLínea dos <script>alert("prueba")</script>  ',
    entregas: [entrega({ observaciones_hitss: 'Revisión\n<b>Texto & evidencia</b>' })],
  })]
  const html = renderizarDetalle(reqs)
  assert.deepEqual(observacionesRenderizadas(html), [
    '  Línea uno\nLínea dos &lt;script&gt;alert(&quot;prueba&quot;)&lt;/script&gt;  ',
    'Revisión\n&lt;b&gt;Texto &amp; evidencia&lt;/b&gt;',
  ])
  assert.doesNotMatch(html, /<script>|<b>Texto/)
  assert.match(html, /<th scope="col" aria-describedby="ayuda-observaciones-hitss">Observaciones Hitss<\/th>/)
  assert.match(html, /id="ayuda-observaciones-hitss"[^>]*>[\s\S]*?Seguimiento Hitss/)
  for (const atributo of html.matchAll(/data-analytics[^=]*="([^"]*)"/g)) {
    assert.doesNotMatch(atributo[1], /Línea|script|evidencia|Revisión/)
  }
})

probar('Códigos iguales entre squads no fusionan filas; números de entrega repetidos tienen claves únicas', () => {
  const reqs = [
    requerimiento({
      codigo_req: 'REQ-001', acta_trabajo: 'AT-1',
      solicitud: { analista_requerimientos_id: 'leonor', squad_id: 'squad-1', codigo_sc: 'SC-101' },
      entregas: [entrega({ numero: 2 }), entrega({ numero: 2 })],
    }),
    requerimiento({
      codigo_req: 'REQ-001', acta_trabajo: 'AT-2',
      solicitud: { analista_requerimientos_id: 'leonor', squad_id: 'squad-2', codigo_sc: 'SC-202' },
      entregas: [entrega({ numero: 2 })],
    }),
  ]
  const resultado = resumir(reqs)
  assert.deepEqual(conteos(resultado), [2, 2, 3, 3])
  assert.equal(resultado.detalles.length, 5)
  assert.equal(resultado.detalles.filter(detalle => detalle.requerimientoId === reqs[0].id).length, 3)
  assert.equal(resultado.detalles.filter(detalle => detalle.requerimientoId === reqs[1].id).length, 2)
  for (const [indice, codigoSc] of ['SC-101', 'SC-202'].entries()) {
    assert.ok(resultado.detalles.filter(detalle => detalle.requerimientoId === reqs[indice].id)
      .every(detalle => detalle.codigoSc === codigoSc))
  }
  assert.equal(new Set(resultado.detalles.map(detalle => detalle.clave)).size, 5)
})

probar('SC ausente, nula o vacía usa — también en entregas; metadata anterior sigue admitida', () => {
  const reqs = [
    requerimiento({ entregas: [entrega()] }),
    requerimiento({ solicitud: null, entregas: [entrega()] }),
    ...[null, '', ' '].map(codigo_sc => requerimiento({
      solicitud: { codigo_sc }, entregas: [entrega()],
    })),
  ]
  assert.ok(resumir(reqs).detalles.every(detalle => detalle.codigoSc === '—'))
  const registros = prepararRegistrosAnalistas([reqs[0]])
    .map(registro => {
      const identificacion = { ...registro.identificacion }
      delete identificacion.codigoSc
      return { ...registro, identificacion }
    })
  const resultado = resumirAnalistas(registros, [], { ano: '2026', mes: '10', analista: '' })
  assert.ok(resultado.detalles.every(detalle => detalle.codigoSc === '—'))
})

probar('Enlaces usan ID documental codificado y basename, no el código repetido; entregas enlazan al padre', () => {
  const reqs = ['SC-101', 'SC-202'].map((codigo_sc, indice) => requerimiento({
    id: `documento/${indice + 1}?x=#`,
    codigo_req: 'REQ-REPETIDO',
    solicitud: { analista_requerimientos_id: 'leonor', codigo_sc },
    entregas: [entrega()],
  }))
  const html = renderizarDetalle(reqs)
  const enlaces = [...html.matchAll(/href="([^"]+)"/g)].map(coincidencia => coincidencia[1])
  assert.deepEqual(enlaces.sort(), reqs.flatMap(req => [
    `/SistemaIntegrado/requerimientos/${encodeURIComponent(req.id)}`,
    `/SistemaIntegrado/requerimientos/${encodeURIComponent(req.id)}`,
  ]).sort())
  assert.equal((html.match(/>REQ-REPETIDO<\/a>/g) ?? []).length, 4)
  assert.match(html, /<th scope="col">SC<\/th>/)
  for (const codigoSc of ['SC-101', 'SC-202']) {
    assert.equal((html.match(new RegExp(`>${codigoSc}</td>`, 'g')) ?? []).length, 2)
  }
})

probar('Sin permiso o sin ID muestra el código como texto; SC ausente muestra —', () => {
  const req = requerimiento({ codigo_req: 'REQ-SIN-ENLACE', entregas: [entrega()] })
  for (const [reqs, permiso] of [[[req], false], [[{ ...req, id: '' }], true]]) {
    const html = renderizarDetalle(reqs, permiso)
    assert.doesNotMatch(html, /href=/)
    assert.equal((html.match(/>REQ-SIN-ENLACE<\/th>/g) ?? []).length, 2)
    assert.equal((html.match(/<td class="whitespace-normal break-words">—<\/td>/g) ?? []).length, 2)
  }
})

probar('Detalle y cuatro conteos comparten filtros de año, mes y analista sin incluir cancelados ni sin fecha', () => {
  const reqs = [
    requerimiento({ codigo_req: 'OCT-2026', entregas: [entrega()] }),
    requerimiento({ codigo_req: 'OCT-2025', fecha_solicitud_acta: '2025-10-02',
      entregas: [entrega({ fecha_recepcion: '2025-10-03' })] }),
    requerimiento({ codigo_req: 'NOV-2026', fecha_solicitud_acta: '2026-11-02',
      entregas: [entrega({ fecha_recepcion: '2026-11-03' })] }),
    requerimiento({ codigo_req: 'OTRO-ANALISTA', solicitud: { analista_requerimientos_id: 'andres' } }),
    requerimiento({ codigo_req: 'SIN-FECHA', fecha_solicitud_acta: '2026-02-30',
      entregas: [entrega({ fecha_recepcion: '', fecha_comprometida: '2026-10-20' })] }),
    requerimiento({ codigo_req: 'CANCELADO', estado: 'CANCELADO', entregas: [entrega()] }),
    requerimiento({ codigo_req: 'REEMPLAZADO', estado: 'REEMPLAZADO', entregas: [entrega()] }),
  ]
  for (const [filtro, codigos] of [
    [{ analista: 'persona:leonor' }, ['OCT-2026', 'OCT-2026']],
    [{ analista: 'persona:leonor', ano: '2025' }, ['OCT-2025', 'OCT-2025']],
    [{ analista: 'persona:leonor', mes: '11' }, ['NOV-2026', 'NOV-2026']],
    [{ analista: 'persona:andres' }, ['OTRO-ANALISTA']],
    [{ analista: 'persona:leonor', mes: '' }, ['NOV-2026', 'NOV-2026', 'OCT-2026', 'OCT-2026']],
  ]) {
    const resultado = resumir(reqs, filtro)
    assert.deepEqual(Array.from(resultado.detalles, detalle => detalle.codigoReq).sort(), codigos)
  }
})

probar('Registros sintéticos previos sin metadata siguen admitidos y no se mutan', () => {
  const registros = congelar([
    { analista: SIN_ANALISTA, tipo: 'requerimiento', mes: '2026-10', ans: 'NO_CUMPLE', tipificacion: 'EPM' },
    { analista: SIN_ANALISTA, tipo: 'entrega', mes: '2026-10', ans: 'NO_CUMPLE', tipificacion: null },
  ])
  const original = JSON.stringify(registros)
  const resultado = resumirAnalistas(registros, [], { ano: '2026', mes: '10', analista: '' })
  verificarParidadDetalle(resultado)
  assert.deepEqual(conteos(resultado, SIN_ANALISTA), [1, 0, 1, 1])
  assert.equal(resultado.detalles.length, 2)
  assert.ok(resultado.detalles.every(detalle =>
    detalle.codigoReq === '—' && detalle.codigoSc === '—' && detalle.acta === 'Sin acta'))
  assert.equal(JSON.stringify(registros), original)
})

probar('No muta requerimientos, entregas, personas ni registros originales', () => {
  const reqs = congelar([requerimiento({ tipificacion: 'EPM', entregas: [entrega({ tipificacion: 'EPM' })] })])
  const originales = JSON.stringify(reqs)
  const registros = congelar(prepararRegistrosAnalistas(reqs))
  const opciones = congelar(opcionesAnalistas(reqs, congelar(personas)))
  const registrosOriginales = JSON.stringify(registros)
  const opcionesOriginales = JSON.stringify(opciones)
  const resultado = resumirAnalistas(registros, opciones, { ano: '2026', mes: '10', analista: '' })
  verificarParidadDetalle(resultado)
  assert.equal(JSON.stringify(reqs), originales)
  assert.equal(JSON.stringify(registros), registrosOriginales)
  assert.equal(JSON.stringify(opciones), opcionesOriginales)
  assert.equal(reqs[0].ans_acta, 'NO_CUMPLE')
  assert.equal(reqs[0].entregas[0].ans_entrega, 'NO_CUMPLE')
})

probar('Ruta y controles de analítica nuevos son funcionales estáticos, sin valores de filtros', () => {
  const { buscarPantalla, buscarControl } = cargarTypeScript(new URL('../src/analitica/catalogo.ts', import.meta.url))
  assert.equal(buscarPantalla('/dashboard-analistas')[1], 'dashboard_analistas')
  for (const control of ['ano', 'mes', 'analista', 'recargar']) {
    assert.ok(buscarControl(`dashboard_analistas.${control}`))
  }
  assert.equal(buscarControl('dashboard_analistas.persona:leonor'), undefined)
})

console.log(`${casos} casos del dashboard de analistas completados.`)

// Ejecutar desde web; datos sintéticos, sin navegador, red ni dependencias nuevas.
import assert from 'node:assert/strict'
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
  return resumirAnalistas(
    prepararRegistrosAnalistas(reqs), opcionesAnalistas(reqs, personas),
    { ano: '2026', mes: '10', analista: '', ...filtro },
  )
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
  assert.deepEqual(conteos(resumir(reqs)), [2, 1, 3, 2])
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
  assert.equal(resumir(reqs).filas.length, 3)
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
})

probar('No muta requerimientos, entregas, personas ni registros originales', () => {
  const reqs = congelar([requerimiento({ tipificacion: 'EPM', entregas: [entrega({ tipificacion: 'EPM' })] })])
  const originales = JSON.stringify(reqs)
  const registros = congelar(prepararRegistrosAnalistas(reqs))
  const opciones = congelar(opcionesAnalistas(reqs, congelar(personas)))
  resumirAnalistas(registros, opciones, { ano: '2026', mes: '10', analista: '' })
  assert.equal(JSON.stringify(reqs), originales)
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

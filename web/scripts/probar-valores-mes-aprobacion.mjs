// Ejecutar desde web; datos sintéticos, sin navegador ni red.
import assert from 'node:assert/strict'
import { cargarTypeScript } from './cargar-typescript.mjs'

const { agruparPorMesAprobacion, ordenarEntregasDetalle, mapaTarifasPorRamificacion } = cargarTypeScript(
  new URL('../src/pages/facturacion-valores/agruparPorMesAprobacion.ts', import.meta.url),
)

const e = (numero, estado, mes, horas, fa, fc) => ({
  numero, estado, mes_aprobacion: mes, horas, fecha_aprobacion: fa, fecha_comprometida: fc,
})
const reqs = [
  { id: 'a', codigo_req: 'REQ-2', nombre: 'Dos', entregas: [
    e(1, 'APROBADA', 'Octubre', 10, '2026-10-05', '2025-09-01'),
    e(2, 'APROBADA', ' enero ', 5, '2026-01-10', null),
    e(3, 'APROBADA', null, 7, null, '2026-03-01'),
    e(4, 'EN CURSO', null, 99, null, '2026-03-01'),
  ] },
  { id: 'b', codigo_req: 'REQ-1', nombre: null, entregas: [
    e(1, 'APROBADA', 'Octubre', 2.5, null, '2026-02-01'),
    e(2, 'APROBADA', 'Diciembre', 4, '2025-12-01', null),
    e(3, 'APROBADA', 'Marzo', 3, null, null),
    e(4, 'APROBADA', 'Xyz', 1, '2026-05-01', null),
  ] },
]
const tarifas = [
  { anio: 2026, valor_hora: 100, ramificacion: 'Fábrica' },
  { anio: 2025, valor_hora: 80, ramificacion: 'FABRICA' },
  { anio: 2026, valor_hora: 5, ramificacion: 'Soporte' },
]
assert.equal(mapaTarifasPorRamificacion(tarifas, 'fábrica').get('2025'), 80)

const filas = agruparPorMesAprobacion(reqs, tarifas, '2026')
assert.deepEqual([...filas.map((f) => f.clave)], [
  '2026|Enero', '2026|Octubre', '2026|Xyz', '2026|Sin mes', '2025|Diciembre', 'Sin fecha|Marzo',
], 'Año desc, calendario, no reconocido y Sin mes al final del año, Sin fecha al final')
const oct = filas.find((f) => f.clave === '2026|Octubre')
assert.equal(oct.entregas.length, 2, 'Año por fecha_aprobacion (aunque comprometida sea 2025) y fallback a comprometida')
assert.equal(oct.horas, 12.5)
assert.equal(oct.valorHora, 100)
assert.equal(filas.find((f) => f.clave === '2025|Diciembre').valorHora, 80)
assert.equal(filas.find((f) => f.clave === 'Sin fecha|Marzo').valorHora, 100, 'Sin año usa la tarifa del año actual')
const sinMes = filas.find((f) => f.mes === 'Sin mes')
assert.equal(sinMes.entregas.length, 1, "'Sin mes' solo APROBADA sin mes")
assert.equal(sinMes.entregas[0].numero, 3)
assert.equal(filas.reduce((t, f) => t + f.entregas.length, 0), 7, 'La entrega EN CURSO sin mes no cuenta')
assert.equal(filas.reduce((t, f) => t + f.horas, 0), 10 + 5 + 7 + 2.5 + 4 + 3 + 1)
assert.equal(
  filas.reduce((t, f) => t + f.horas * (f.valorHora ?? 0), 0),
  100 * (10 + 5 + 7 + 2.5 + 3 + 1) + 80 * 4,
)
assert.ok(agruparPorMesAprobacion(reqs, [], '2026').every((f) => f.valorHora === null), 'Sin tarifa -> null')

const detalle = ordenarEntregasDetalle(oct.entregas)
assert.deepEqual([...detalle.map((d) => `${d.codigoReq}#${d.numero}`)], ['REQ-1#1', 'REQ-2#1'])
assert.equal(detalle.reduce((t, d) => t + d.horas, 0), oct.horas, 'El detalle trae exactamente las entregas contadas')
// Tarifas: insensibles a tildes y mayúsculas; duplicados deterministas (gana la última)
const { horasSeguras, tarifasDuplicadasConflicto } = cargarTypeScript(
  new URL('../src/pages/facturacion-valores/agruparPorMesAprobacion.ts', import.meta.url),
)
const variantes = [
  { anio: 2024, valor_hora: 70, ramificacion: 'Fabrica' },
  { anio: 2023, valor_hora: 60, ramificacion: ' FÁBRICA ' },
  { anio: 2024, valor_hora: 5, ramificacion: 'SOPORTE' },
]
assert.equal(mapaTarifasPorRamificacion(variantes, 'fábrica').get('2024'), 70, "'Fabrica' se encuentra")
assert.equal(mapaTarifasPorRamificacion(variantes, 'fábrica').get('2023'), 60, "' FÁBRICA ' se encuentra")
assert.equal(mapaTarifasPorRamificacion(variantes, 'soporte').get('2024'), 5)
const duplicadas = [
  { anio: 2026, valor_hora: 100, ramificacion: 'Fábrica' },
  { anio: 2026, valor_hora: 120, ramificacion: 'fabrica' },
  { anio: 2025, valor_hora: 80, ramificacion: 'Soporte' },
  { anio: 2025, valor_hora: 80, ramificacion: 'soporte' },
  { anio: 2024, valor_hora: 1, ramificacion: 'Otra' },
  { anio: 2024, valor_hora: 2, ramificacion: 'Otra' },
]
assert.equal(mapaTarifasPorRamificacion(duplicadas, 'fábrica').get('2026'), 120, 'Gana la última')
const conflictos = tarifasDuplicadasConflicto(duplicadas, ['soporte', 'fábrica'])
assert.equal(conflictos.length, 1, 'Solo conflictos con valores distintos y ramificación usada')
assert.deepEqual([conflictos[0].ramificacion, conflictos[0].anio, [...conflictos[0].valores]], ['fábrica', '2026', [100, 120]])
assert.equal(tarifasDuplicadasConflicto(tarifas, ['soporte', 'fábrica']).length, 0, 'Sin duplicados no hay aviso')

// Horas no numéricas nunca producen NaN
assert.equal(horasSeguras('abc'), 0)
assert.equal(horasSeguras(undefined), 0)
assert.equal(horasSeguras(null), 0)
assert.equal(horasSeguras(NaN), 0)
assert.equal(horasSeguras(Infinity), 0)
assert.equal(horasSeguras('2.5'), 2.5)
const sucias = [{ id: 'z', codigo_req: 'REQ-9', nombre: 'Z', entregas: [
  e(1, 'APROBADA', 'Enero', 'abc', '2026-01-01', null),
  e(2, 'APROBADA', 'Enero', 4, '2026-01-02', null),
  e(3, 'APROBADA', 'Enero', undefined, '2026-01-03', null),
] }]
const sucia = agruparPorMesAprobacion(sucias, tarifas, '2026')[0]
assert.equal(sucia.horas, 4, 'Horas no numéricas cuentan 0 en la tabla por mes')
assert.ok(sucia.entregas.every((x) => Number.isFinite(x.horas)))
console.log('OK: agrupación año+mes, fallback de año, orden, Sin mes, tarifas, sumas y detalle.')

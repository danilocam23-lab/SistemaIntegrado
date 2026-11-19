// Ejecutar desde web. Lógica pura de paginación; sin red ni dependencias nuevas.
import assert from 'node:assert/strict'
import { cargarTypeScript } from './cargar-typescript.mjs'

const {
  normalizarRegistrosPorPagina, leerRegistrosPorPagina, elegirRegistroPorPagina, calcularRangoPagina,
  REGISTROS_POR_PAGINA_DEFECTO, REGISTROS_POR_PAGINA_MAXIMO,
} = cargarTypeScript(new URL('../src/utils/paginacion.ts', import.meta.url))

// Valor por defecto
assert.equal(REGISTROS_POR_PAGINA_DEFECTO, 50)
for (const invalido of [undefined, null, '', '  ', 'abc', '0', '-5', 0, -1, NaN, true, {}]) {
  assert.equal(normalizarRegistrosPorPagina(invalido), 50, `defecto para ${String(invalido)}`)
}
// Valores válidos y acotado
assert.equal(normalizarRegistrosPorPagina('25'), 25)
assert.equal(normalizarRegistrosPorPagina(' 100 '), 100)
assert.equal(normalizarRegistrosPorPagina('12.9'), 12)
assert.equal(normalizarRegistrosPorPagina('1'), 1)
assert.equal(normalizarRegistrosPorPagina('99999'), REGISTROS_POR_PAGINA_MAXIMO)
assert.equal(REGISTROS_POR_PAGINA_MAXIMO, 500)

// Lectura desde /configuracion
assert.equal(leerRegistrosPorPagina([]), 50)
assert.equal(leerRegistrosPorPagina([{ clave: 'otra', valor: '10' }]), 50)
assert.equal(leerRegistrosPorPagina([{ clave: 'otra', valor: '10' }, { clave: 'registros_por_pagina', valor: '20' }]), 20)
assert.equal(leerRegistrosPorPagina([{ clave: 'registros_por_pagina', valor: '20' }, { clave: 'registros_por_pagina', valor: '30' }]), 20)
assert.equal(leerRegistrosPorPagina([{ clave: 'registros_por_pagina', valor: 'x' }]), 50)

// Selección entre registros por aplicación: global > activa > primero
const reg = (aplicacion_id, valor, clave = 'registros_por_pagina') => ({ clave, aplicacion_id, valor })
const varios = [reg('epm-hitss', '20'), reg('10', '30'), reg('global', '40'), reg('x', '5', 'otra')]
assert.equal(elegirRegistroPorPagina(varios, 'epm-hitss').aplicacion_id, 'global')
assert.equal(leerRegistrosPorPagina(varios, '10'), 40)
assert.equal(leerRegistrosPorPagina(varios, '__todas__'), 40)
const sinGlobal = [reg('epm-hitss', '20'), reg('10', '30')]
assert.equal(leerRegistrosPorPagina(sinGlobal, '10'), 30)
assert.equal(leerRegistrosPorPagina(sinGlobal, 'epm-hitss'), 20)
assert.equal(leerRegistrosPorPagina(sinGlobal, '__todas__'), 20)
assert.equal(leerRegistrosPorPagina(sinGlobal, 'otra-app'), 20)
assert.equal(leerRegistrosPorPagina(sinGlobal, ''), 20)
assert.equal(leerRegistrosPorPagina(sinGlobal), 20)
assert.equal(elegirRegistroPorPagina([reg('g', '1', 'otra')], 'g'), undefined)
// Determinista: el orden de entrada no cambia la elección global/activa
assert.equal(leerRegistrosPorPagina([...varios].reverse(), '10'), 40)
assert.equal(leerRegistrosPorPagina([reg('global', 'abc'), reg('10', '30')], '10'), 50)

// Rangos X–Y
let r = calcularRangoPagina(120, 1, 50)
assert.deepEqual([r.pagina, r.totalPaginas, r.inicio, r.fin, r.desde, r.hasta, r.total], [1, 3, 0, 50, 1, 50, 120])
r = calcularRangoPagina(120, 2, 50)
assert.deepEqual([r.desde, r.hasta], [51, 100])
r = calcularRangoPagina(120, 3, 50)
assert.deepEqual([r.desde, r.hasta, r.inicio, r.fin], [101, 120, 100, 120])
r = calcularRangoPagina(100, 2, 50)
assert.deepEqual([r.desde, r.hasta, r.totalPaginas], [51, 100, 2])

// Página fuera de rango se corrige
assert.equal(calcularRangoPagina(120, 9, 50).pagina, 3)
assert.equal(calcularRangoPagina(120, 0, 50).pagina, 1)
assert.equal(calcularRangoPagina(120, -3, 50).pagina, 1)
assert.equal(calcularRangoPagina(120, NaN, 50).pagina, 1)
assert.equal(calcularRangoPagina(10, 4, 50).pagina, 1)

// Sin filas
r = calcularRangoPagina(0, 5, 50)
assert.deepEqual([r.pagina, r.totalPaginas, r.desde, r.hasta, r.inicio, r.fin], [1, 1, 0, 0, 0, 0])

// Tamaño inválido usa el defecto; slice coincide con el rango
assert.equal(calcularRangoPagina(120, 1, 0).totalPaginas, 3)
const filas = Array.from({ length: 7 }, (_, i) => i)
r = calcularRangoPagina(filas.length, 3, 3)
assert.deepEqual(filas.slice(r.inicio, r.fin), [6])

console.log('probar-paginacion: OK')

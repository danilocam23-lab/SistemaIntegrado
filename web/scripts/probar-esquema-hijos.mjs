// Ejecutar desde web. Lógica pura de fusión de hijos del esquema Azure; sin red.
import assert from 'node:assert/strict'
import { cargarTypeScript } from './cargar-typescript.mjs'

const { fusionarHijos, hijosCargados, textoAvisoTruncado } = cargarTypeScript(
  new URL('../src/pages/esquema-azure/utilidades.ts', import.meta.url),
)

const nodo = (azdo_id, hijos = [], extra = {}) => ({ azdo_id, tipo: 'Task', titulo: `T${azdo_id}`, hijos, ...extra })
const ids = (n) => n.hijos.map((h) => h.azdo_id).join(',')

const arbol = [nodo(1, [nodo(2, [], { hijos_pendientes: 1200 })])]
const copia = JSON.stringify(arbol)
assert.equal(hijosCargados(arbol, 2), 0)
assert.equal(hijosCargados(arbol, 1), 1)

// Paginación en 3 páginas (total 1200, 500 por página), sin mutar el original
const pagina = (desde, n) => Array.from({ length: n }, (_, i) => nodo(1000 + desde + i))
let r = fusionarHijos(arbol, 2, pagina(0, 500), 1200)
assert.equal(JSON.stringify(arbol), copia, 'no muta el original')
assert.equal(r[0].hijos[0].hijos.length, 500)
assert.equal(r[0].hijos[0].hijos_pendientes, 700)
assert.equal(hijosCargados(r, 2), 500)
r = fusionarHijos(r, 2, pagina(500, 500), 1200)
assert.equal(r[0].hijos[0].hijos_pendientes, 200)
r = fusionarHijos(r, 2, pagina(1000, 200), 1200)
assert.equal(r[0].hijos[0].hijos.length, 1200)
assert.equal(r[0].hijos[0].hijos_pendientes, 0)

// Sin duplicados: repetir una página no cambia nada ni los pendientes
const repetido = fusionarHijos(r, 2, pagina(0, 500), 1200)
assert.equal(repetido[0].hijos[0].hijos.length, 1200)
assert.equal(repetido[0].hijos[0].hijos_pendientes, 0)
const dup = fusionarHijos(arbol, 2, [nodo(5), nodo(5), nodo(6)], 3)
assert.equal(ids(dup[0].hijos[0]), '5,6')
assert.equal(dup[0].hijos[0].hijos_pendientes, 1)

// Pendientes nunca negativos
assert.equal(fusionarHijos(arbol, 2, [nodo(5), nodo(6)], 1)[0].hijos[0].hijos_pendientes, 0)

// Padre inexistente: mismas referencias
assert.equal(fusionarHijos(arbol, 99, [nodo(7)], 1)[0], arbol[0])

// Reinicio al cambiar filtros: el árbol nuevo del backend manda, sin hijos fusionados
const nuevo = [nodo(1, [nodo(2, [], { hijos_pendientes: 3 })])]
assert.equal(hijosCargados(nuevo, 2), 0)
assert.equal(nuevo[0].hijos[0].hijos_pendientes, 3)

// Aviso
assert.equal(textoAvisoTruncado(2000, 75000, false), '')
assert.match(textoAvisoTruncado(2000, 75000, true), /Mostrando 2\.000 de 75\.000 work items sincronizados/)
assert.match(textoAvisoTruncado(2000, undefined, true), /^Mostrando 2\.000 work items/)

console.log('OK probar-esquema-hijos')

// Ejecutar desde web; datos sintéticos, sin navegador ni red.
import assert from 'node:assert/strict'
import { cargarTypeScript } from './cargar-typescript.mjs'

const { calcularEstadosOfrecidos: calcular } = cargarTypeScript(
  new URL('../src/pages/requerimiento-detalle/estadosOfrecidos.ts', import.meta.url),
)

// El módulo corre en otro contexto vm: se normaliza a arreglos locales para deepEqual.
const calcularEstadosOfrecidos = (...args) => [...calcular(...args)]

const todos = ['Nuevo', 'En análisis', 'En desarrollo', 'Cerrado', 'En pausa']
const mapa = { Nuevo: ['En análisis'], 'En análisis': ['En desarrollo', 'Cerrado'], 'En desarrollo': ['Cerrado'] }

// Mapa cargado: actual + siguientes + personalizado (En pausa no está en el mapa).
assert.deepEqual(calcularEstadosOfrecidos('Nuevo', todos, mapa), ['Nuevo', 'En análisis', 'En pausa'])
assert.deepEqual(
  calcularEstadosOfrecidos('En análisis', todos, mapa),
  ['En análisis', 'En desarrollo', 'Cerrado', 'En pausa'],
)
// Sin duplicados si el estado actual es personalizado y no está en el mapa: se ofrecen todos.
assert.deepEqual(calcularEstadosOfrecidos('En pausa', todos, mapa), todos)
// Falla la carga del mapa: todos, como antes.
assert.deepEqual(calcularEstadosOfrecidos('Nuevo', todos, null), todos)
// Sin requerimiento todavía.
assert.deepEqual(calcularEstadosOfrecidos(undefined, todos, mapa), todos)
// Siguiente repetido o igual al actual no duplica.
assert.deepEqual(
  calcularEstadosOfrecidos('Nuevo', todos, { Nuevo: ['Nuevo', 'En análisis', 'En análisis'] }),
  ['Nuevo', 'En análisis', 'En desarrollo', 'Cerrado', 'En pausa'],
)
console.log('OK: estados ofrecidos (siguientes, personalizados, sin mapa).')

// Ejecutar desde web. Tema estacional: lógica pura y estado inicial sin lectura; sin red.
import assert from 'node:assert/strict'
import { cargarTypeScript } from './cargar-typescript.mjs'

const ruta = new URL('../src/hooks/useTemaEstacional.ts', import.meta.url)
const react = { useEffect: () => {}, useSyncExternalStore: (_s, obtener) => obtener() }
const cliente = { default: { get: () => new Promise(() => {}) } }
const cargar = (globales = {}) => cargarTypeScript(ruta, globales, { react, '../api/client': cliente })

const m = cargar({ localStorage: undefined })
const d = (y, mes, dia) => new Date(y, mes - 1, dia)
assert.equal(m.temaPorFecha(d(2026, 9, 5)), 'amor_amistad')
assert.equal(m.temaPorFecha(d(2026, 10, 31)), 'halloween')
assert.equal(m.temaPorFecha(d(2026, 11, 14)), 'ninguno')
assert.equal(m.temaPorFecha(d(2026, 11, 15)), 'navidad')
assert.equal(m.temaPorFecha(d(2027, 1, 6)), 'navidad')
assert.equal(m.temaPorFecha(d(2027, 1, 7)), 'ninguno')
assert.equal(m.resolverTema('ninguno', d(2026, 11, 20)), 'ninguno')
assert.equal(m.resolverTema('halloween', d(2026, 11, 20)), 'halloween')
assert.equal(m.resolverTema('auto', d(2026, 11, 20)), 'navidad')
assert.equal(m.resolverTema('raro', d(2026, 11, 20)), 'navidad')
assert.equal(m.resolverTema(null, d(2026, 11, 20)), 'navidad')

// Sin lectura ni caché: no decora aunque la fecha sea de Navidad.
assert.equal(m.temaVigente(null, d(2026, 11, 20)), 'ninguno')
assert.equal(m.temaVigente('auto', d(2026, 11, 20)), 'navidad')
assert.equal(m.useTemaEstacional(), 'ninguno')

// localStorage que lanza: la página funciona igual.
const roto = cargar({ localStorage: { getItem() { throw new Error('x') }, setItem() { throw new Error('x') } } })
assert.equal(roto.useTemaEstacional(), 'ninguno')
roto.publicarTemaEstacional('navidad')

// Caché previa: se usa como valor inicial; publicar la actualiza.
const almacen = new Map([['tema_estacional_cache', 'halloween']])
const ls = { getItem: (k) => almacen.get(k) ?? null, setItem: (k, v) => almacen.set(k, v) }
const conCache = cargar({ localStorage: ls })
assert.equal(conCache.useTemaEstacional(), 'halloween')
conCache.publicarTemaEstacional('ninguno')
assert.equal(almacen.get('tema_estacional_cache'), 'ninguno')
assert.equal(conCache.useTemaEstacional(), 'ninguno')

console.log('probar-tema-estacional: OK')

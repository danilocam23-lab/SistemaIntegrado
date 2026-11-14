import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const requerir = createRequire(import.meta.url)

// Ejecuta módulos TS puros, sin bundle, navegador, paquetes nuevos ni red.
export function cargarTypeScript(rutaInicial, globales = {}) {
  const cache = new Map()
  function cargar(ruta) {
    const absoluta = ruta instanceof URL ? fileURLToPath(ruta) : resolve(ruta)
    if (cache.has(absoluta)) return cache.get(absoluta).exports
    const modulo = { exports: {} }
    cache.set(absoluta, modulo)
    const compilado = ts.transpileModule(readFileSync(absoluta, 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
      fileName: absoluta,
    }).outputText
    runInNewContext(compilado, {
      module: modulo, exports: modulo.exports, URL, Map, Set, WeakMap, Date, console, process,
      ...globales,
      require(nombre) {
        if (!nombre.startsWith('.')) return requerir(nombre)
        const destino = resolve(dirname(absoluta), nombre)
        const archivo = [destino, `${destino}.ts`, `${destino}.tsx`, `${destino}/index.ts`].find(existsSync)
        if (!archivo) throw new Error(`Módulo de prueba no encontrado: ${nombre}`)
        return cargar(archivo)
      },
    }, { filename: absoluta })
    return modulo.exports
  }
  return cargar(rutaInicial)
}

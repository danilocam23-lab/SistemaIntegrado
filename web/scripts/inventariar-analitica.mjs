// Inventario real del código fuente: node scripts/inventariar-analitica.mjs [--guardar]
import { fileURLToPath } from 'node:url'
import { writeFileSync } from 'node:fs'
import { cargarTypeScript } from './cargar-typescript.mjs'

const { inventariarProyecto } = cargarTypeScript(new URL('./instrumentacion-analitica.ts', import.meta.url))
const { inventario } = inventariarProyecto(fileURLToPath(new URL('../', import.meta.url)))
const json = JSON.stringify(inventario, null, 2)
if (process.argv.includes('--guardar')) {
  const destino = new URL('../inventario-analitica.json', import.meta.url)
  writeFileSync(destino, `${json}\n`, 'utf8')
  console.log(`Inventario guardado en ${fileURLToPath(destino)}`)
  console.log(JSON.stringify(inventario.totales))
} else {
  console.log(json)
}

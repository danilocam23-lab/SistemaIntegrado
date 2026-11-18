// Ejecutar desde web; datos sintéticos, sin navegador, red ni dependencias nuevas.
import assert from 'node:assert/strict'
import { cargarTypeScript } from './cargar-typescript.mjs'

const { convertirHorasSiguienteAnio } = cargarTypeScript(
  new URL('../src/pages/requerimiento-detalle/horasSiguienteAnio.ts', import.meta.url),
)

for (const vacio of ['', '   ']) {
  assert.equal(convertirHorasSiguienteAnio(vacio), null, 'Vaciar permite limpiar con null')
}
for (const [entrada, esperado] of [['0', 0], ['0.25', 0.25], ['120.75', 120.75], [' 8.5 ', 8.5]]) {
  assert.equal(convertirHorasSiguienteAnio(entrada), esperado, 'Conserva cero y fracciones')
}
for (const invalido of ['-1', '-0.25', 'NaN', 'Infinity', '-Infinity', '1e309', 'texto']) {
  assert.throws(
    () => convertirHorasSiguienteAnio(invalido),
    /debe ser finito y mayor o igual a cero/,
    'Rechaza negativos y no finitos antes del PUT',
  )
}
assert.equal(JSON.stringify({ horas_siguiente_anio: convertirHorasSiguienteAnio('') }), '{"horas_siguiente_anio":null}')
assert.equal(JSON.stringify({ horas_siguiente_anio: convertirHorasSiguienteAnio('0') }), '{"horas_siguiente_anio":0}')
console.log('OK: limpieza, cero, fracciones, negativos, no finitos y serialización de horas.')

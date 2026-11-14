import * as ts from 'typescript'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import type { Plugin } from 'vite'
import { buscarOperacion, CONTROLES, PANTALLAS, FORMULARIOS, EXPORTACIONES } from '../src/analitica/catalogo'

type Tipo = 'boton' | 'enlace' | 'tab' | 'filtro' | 'busqueda' | 'modal' | 'paginacion'
interface ControlInventariado {
  archivo: string
  linea: number
  componente: string
  handler: string
  id: string | null
  accion: string
  tipo: Tipo
  cobertura: 'explicito' | 'automatico' | 'compartido' | 'excluido_seguridad' | 'sin_handler' | 'requiere_adaptador' | 'id_no_registrado'
}

const PRIMITIVOS = new Set(['Boton', 'Interruptor', 'Campo', 'Selector', 'AreaTexto'])
const ENLACES = new Set(['Link', 'NavLink', 'a'])
const CAMPOS = new Set(['Campo', 'Selector', 'AreaTexto', 'input', 'select', 'textarea'])
const COMPARTIDOS = new Set(['Modal', 'FiltroDesplegable'])
const NATIVOS = new Set(['button', 'input', 'select', 'textarea', 'summary'])
const simplificar = (valor: string) => valor.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase()

// Todo se decide a partir del código fuente durante el build; no hay inferencia DOM.
export function analizarControles(fuente: string, archivo: string) {
  const arbol = ts.createSourceFile(archivo, fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const controles: ControlInventariado[] = []
  const inserciones: Array<{ posicion: number; atributo: string }> = []
  const catalogo: Record<string, readonly [string, Tipo]> = {}
  const esPrimitivoInterno = archivo.endsWith('components/ui/primitivos.tsx')

  function atributo(nodo: ts.JsxOpeningElement | ts.JsxSelfClosingElement, nombre: string) {
    return nodo.attributes.properties.find((prop): prop is ts.JsxAttribute =>
      ts.isJsxAttribute(prop) && prop.name.getText(arbol) === nombre)
  }
  function literal(prop: ts.JsxAttribute | undefined): string | undefined {
    if (!prop?.initializer) return undefined
    if (ts.isStringLiteral(prop.initializer)) return prop.initializer.text
    if (ts.isJsxExpression(prop.initializer) && prop.initializer.expression &&
      ts.isStringLiteral(prop.initializer.expression)) return prop.initializer.expression.text
    return undefined
  }
  function privado(nodo: ts.Node): boolean {
    let actual: ts.Node | undefined = nodo
    while (actual) {
      const apertura = ts.isJsxElement(actual) ? actual.openingElement :
        ts.isJsxOpeningElement(actual) || ts.isJsxSelfClosingElement(actual) ? actual : null
      if (apertura && atributo(apertura, 'data-analytics-private')) return true
      actual = actual.parent
    }
    return false
  }
  function nombreHandler(prop: ts.JsxAttribute | undefined): string {
    const inicializador = prop?.initializer
    if (!inicializador || !ts.isJsxExpression(inicializador) || !inicializador.expression) return ''
    const expresion = inicializador.expression
    if (ts.isIdentifier(expresion)) return expresion.text
    if (ts.isPropertyAccessExpression(expresion)) return expresion.name.text
    let encontrado = ''
    function visitar(nodo: ts.Node) {
      if (!encontrado && ts.isCallExpression(nodo)) {
        if (ts.isIdentifier(nodo.expression)) encontrado = nodo.expression.text
        else if (ts.isPropertyAccessExpression(nodo.expression) &&
          !['stopPropagation', 'preventDefault'].includes(nodo.expression.name.text)) encontrado = nodo.expression.name.text
      }
      if (!encontrado) ts.forEachChild(nodo, visitar)
    }
    visitar(expresion)
    return encontrado
  }
  function visitar(nodo: ts.Node) {
    if (ts.isJsxOpeningElement(nodo) || ts.isJsxSelfClosingElement(nodo)) {
      const etiqueta = nodo.tagName.getText(arbol)
      const click = atributo(nodo, 'onClick')
      const cambio = atributo(nodo, 'onChange')
      const teclas = atributo(nodo, 'onKeyDown')
      const explicito = atributo(nodo, 'data-analytics-id')
      if (PRIMITIVOS.has(etiqueta) || ENLACES.has(etiqueta) || COMPARTIDOS.has(etiqueta) ||
        NATIVOS.has(etiqueta) || click || cambio || teclas || explicito) {
        const handler = nombreHandler(click ?? cambio ?? teclas)
        const botonEntrada = etiqueta === 'input' && ['button', 'submit', 'reset'].includes(literal(atributo(nodo, 'type')) ?? '')
        const valor = atributo(nodo, 'value')?.initializer
        const enlaceEstado = valor && ts.isJsxExpression(valor) ? valor.expression : undefined
        // Solo nombres de bindings del código; nunca se evalúa ni serializa el valor.
        const busquedaEstatica = /busqu|buscar|search|filtroTexto/i.test(handler) ||
          literal(atributo(nodo, 'type')) === 'search' ||
          (!!enlaceEstado && ts.isIdentifier(enlaceEstado) && /busqu|filtroTexto/i.test(enlaceEstado.text)) ||
          (!!enlaceEstado && ts.isPropertyAccessExpression(enlaceEstado) && ts.isIdentifier(enlaceEstado.expression) &&
            /filtros/i.test(enlaceEstado.expression.text) && /^(texto|busqueda|q)$/i.test(enlaceEstado.name.text))
        const tipo: Tipo = botonEntrada ? 'boton' : ENLACES.has(etiqueta) ? 'enlace' : literal(atributo(nodo, 'role')) === 'tab' ? 'tab' :
          CAMPOS.has(etiqueta) ? (busquedaEstatica ? 'busqueda' : 'filtro') :
          /pagina|paginar|siguiente|anterior/i.test(handler) ? 'paginacion' :
          /modal|onCerrar|onClose/i.test(handler) ? 'modal' :
          /^set(Tab|Pestana)|cambiarPestana/i.test(handler) ? 'tab' : 'boton'
        const accion = handler ? `accion_${simplificar(handler).slice(0, 55)}` :
          tipo === 'enlace' ? 'navegar' : etiqueta === 'summary' ? 'alternar' : 'activar'
        const secreto = privado(nodo) || (CAMPOS.has(etiqueta) && (
          ['password', 'hidden'].includes(literal(atributo(nodo, 'type')) ?? '') ||
          (!!atributo(nodo, 'type') && literal(atributo(nodo, 'type')) === undefined) ||
          /password|contrasena|secreto|token|credencial/i.test(handler)
        ))
        const internoCompartido = esPrimitivoInterno || COMPARTIDOS.has(etiqueta)
        const soloPropagacion = !handler && !!click && /\b(stopPropagation|preventDefault)\b/.test(click.getText(arbol))
        const requiereAdaptador = /^[A-Z]/.test(etiqueta) && !PRIMITIVOS.has(etiqueta) && !ENLACES.has(etiqueta)
        const idExplicito = literal(explicito)
        const idRegistrado = idExplicito && Object.prototype.hasOwnProperty.call(CONTROLES, idExplicito)
        const cobertura = secreto ? 'excluido_seguridad' : explicito ? (idRegistrado ? 'explicito' : 'id_no_registrado') :
          internoCompartido ? 'compartido' : requiereAdaptador ? 'requiere_adaptador' : soloPropagacion ? 'sin_handler' : (!click && !cambio && !ENLACES.has(etiqueta) && etiqueta !== 'summary' &&
            literal(atributo(nodo, 'type')) !== 'submit' && etiqueta !== 'Boton' && etiqueta !== 'button') ? 'sin_handler' : 'automatico'
        // El hash depende del código del handler, nunca del orden de filas/índices.
        const firma = `${archivo}|${etiqueta}|${(click ?? cambio ?? teclas)?.getText(arbol) ?? accion}`
        const hash = createHash('sha256').update(firma).digest('hex').slice(0, 12)
        const id = cobertura === 'explicito' ? literal(explicito) ?? null :
          cobertura === 'automatico' ? `control.${simplificar(archivo.replace(/^src\//, '').replace(/\.tsx$/, '')).slice(-42)}.${simplificar(handler || etiqueta).slice(0, 20)}.${hash}` : null
        controles.push({
          archivo, linea: arbol.getLineAndCharacterOfPosition(nodo.getStart(arbol)).line + 1,
          componente: etiqueta, handler, id, accion, tipo, cobertura,
        })
        if (cobertura === 'automatico' && id) {
          catalogo[id] = [accion, tipo]
          const posicion = nodo.end - (ts.isJsxSelfClosingElement(nodo) ? 2 : 1)
          inserciones.push({ posicion, atributo: ` data-analytics-id="${id}"` })
        }
      }
    }
    ts.forEachChild(nodo, visitar)
  }
  visitar(arbol)
  let codigo = fuente
  for (const insercion of inserciones.sort((a, b) => b.posicion - a.posicion)) {
    codigo = codigo.slice(0, insercion.posicion) + insercion.atributo + codigo.slice(insercion.posicion)
  }
  return { codigo, controles, catalogo }
}

export function inventariarProyecto(raiz: string) {
  const fuentes = new Map<string, string>()
  function recorrer(directorio: string) {
    const entradas = readdirSync(directorio, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
    for (const entrada of entradas) {
      const ruta = join(directorio, entrada.name)
      if (entrada.isDirectory()) recorrer(ruta)
      else if (/\.(tsx?|jsx?)$/.test(entrada.name) && !entrada.name.endsWith('.d.ts')) {
        fuentes.set(relative(raiz, ruta).replace(/\\/g, '/'), readFileSync(ruta, 'utf8'))
      }
    }
  }
  recorrer(join(raiz, 'src'))
  const alcanzables = new Set<string>()
  function seguir(archivo: string) {
    if (alcanzables.has(archivo)) return
    const fuente = fuentes.get(archivo)
    if (fuente === undefined) return
    alcanzables.add(archivo)
    const arbol = ts.createSourceFile(archivo, fuente, ts.ScriptTarget.Latest, true)
    for (const nodo of arbol.statements) {
      const modulo = ts.isImportDeclaration(nodo) || ts.isExportDeclaration(nodo) ? nodo.moduleSpecifier : undefined
      if (!modulo || !ts.isStringLiteral(modulo) || !modulo.text.startsWith('.')) continue
      const destino = relative(raiz, resolve(raiz, dirname(archivo), modulo.text)).replace(/\\/g, '/')
      for (const candidato of [destino, `${destino}.tsx`, `${destino}.ts`, `${destino}/index.tsx`, `${destino}/index.ts`]) {
        if (fuentes.has(candidato)) { seguir(candidato); break }
      }
    }
  }
  seguir('src/main.tsx')
  const controles: Array<ControlInventariado & { alcanzable_desde_main: boolean }> = []
  const formularios: Array<{ archivo: string; linea: number; handler: string; id: string | null; confirmacion_integrada: boolean }> = []
  const peticiones: Array<{ archivo: string; linea: number; metodo: string; plantilla: string | null; instrumentada: boolean | null }> = []
  const exportaciones: Array<{ archivo: string; linea: number; mecanismo: string }> = []
  const catalogo: Record<string, readonly [string, Tipo]> = {}
  function extraerArray(nombre: string): string[] {
    const arbol = ts.createSourceFile('servicio.ts', fuentes.get('src/analitica/servicio.ts') ?? '', ts.ScriptTarget.Latest, true)
    for (const sentencia of arbol.statements) {
      if (!ts.isVariableStatement(sentencia)) continue
      for (const declaracion of sentencia.declarationList.declarations) {
        if (!ts.isIdentifier(declaracion.name) || declaracion.name.text !== nombre) continue
        const expresion = declaracion.initializer
        const array = expresion && ts.isAsExpression(expresion) ? expresion.expression : expresion
        if (array && ts.isArrayLiteralExpression(array)) return array.elements.filter(ts.isStringLiteral).map(elemento => elemento.text)
      }
    }
    return []
  }
  for (const [archivo, fuente] of fuentes) {
    if (archivo.endsWith('.tsx')) {
      const analisis = analizarControles(fuente, archivo)
      controles.push(...analisis.controles.map(control => ({ ...control, alcanzable_desde_main: alcanzables.has(archivo) })))
      if (alcanzables.has(archivo)) Object.assign(catalogo, analisis.catalogo)
    }
    const arbol = ts.createSourceFile(archivo, fuente, ts.ScriptTarget.Latest, true,
      archivo.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
    const linea = (nodo: ts.Node) => arbol.getLineAndCharacterOfPosition(nodo.getStart(arbol)).line + 1
    function visitar(nodo: ts.Node) {
      if ((ts.isJsxOpeningElement(nodo) || ts.isJsxSelfClosingElement(nodo)) && nodo.tagName.getText(arbol) === 'form') {
        const props = nodo.attributes.properties.filter(ts.isJsxAttribute)
        const atributoId = props.find(prop => prop.name.getText(arbol) === 'data-analytics-form')
        const id = atributoId?.initializer && ts.isStringLiteral(atributoId.initializer) ? atributoId.initializer.text : null
        const submit = props.find(prop => prop.name.getText(arbol) === 'onSubmit')
        const handler = submit?.initializer && ts.isJsxExpression(submit.initializer) && submit.initializer.expression &&
          ts.isIdentifier(submit.initializer.expression) ? submit.initializer.expression.text : 'handler_compuesto'
        formularios.push({ archivo, linea: linea(nodo), handler, id, confirmacion_integrada: FORMULARIOS.some(formulario => formulario === id) })
      }
      if (ts.isCallExpression(nodo) && ts.isPropertyAccessExpression(nodo.expression)) {
        const llamada = nodo.expression
        const metodo = llamada.name.text
        if (ts.isIdentifier(llamada.expression) && llamada.expression.text === 'client' && ['get', 'post', 'put', 'patch', 'delete', 'request'].includes(metodo)) {
          const argumento = nodo.arguments[0]
          const ruta = argumento && (ts.isStringLiteral(argumento) || ts.isNoSubstitutionTemplateLiteral(argumento)) ? argumento.text :
            argumento && ts.isTemplateExpression(argumento) ? argumento.head.text + argumento.templateSpans.map(span => `:param${span.literal.text}`).join('') : null
          const plantilla = ruta?.split(/[?#]/, 1)[0] ?? null
          peticiones.push({ archivo, linea: linea(nodo), metodo: metodo.toUpperCase(), plantilla,
            instrumentada: plantilla !== null && buscarOperacion(metodo, plantilla) !== undefined ? true :
              plantilla === null || plantilla.includes(':param') ? null : false })
        }
        if (metodo === 'writeFile' || metodo === 'createObjectURL') {
          exportaciones.push({ archivo, linea: linea(nodo), mecanismo: metodo === 'writeFile' ? 'xlsx_local' : 'blob_descarga' })
        }
      }
      ts.forEachChild(nodo, visitar)
    }
    visitar(arbol)
  }
  return {
    catalogo,
    inventario: {
      version: 1,
      metodo: 'AST TypeScript: callsites estáticos, sin inferencia DOM. Alcanzabilidad de imports relativos estáticos desde main; no garantiza acceso por permisos.',
      totales: {
        controles: controles.length,
        explicitos: controles.filter(control => control.cobertura === 'explicito').length,
        automaticos: controles.filter(control => control.cobertura === 'automatico').length,
        compartidos: controles.filter(control => control.cobertura === 'compartido').length,
        excluidos_seguridad: controles.filter(control => control.cobertura === 'excluido_seguridad').length,
        sin_handler: controles.filter(control => control.cobertura === 'sin_handler').length,
        requiere_adaptador: controles.filter(control => control.cobertura === 'requiere_adaptador').length,
        id_no_registrado: controles.filter(control => control.cobertura === 'id_no_registrado').length,
        instrumentados_alcanzables: controles.filter(control => control.alcanzable_desde_main &&
          (control.cobertura === 'automatico' || control.cobertura === 'explicito')).length,
        formularios: formularios.length,
        formularios_confirmados: formularios.filter(formulario => formulario.confirmacion_integrada).length,
        peticiones: peticiones.length,
        peticiones_catalogadas: peticiones.filter(peticion => peticion.instrumentada === true).length,
        peticiones_por_verificar: peticiones.filter(peticion => peticion.instrumentada === null).length,
      },
      controles,
      formularios,
      peticiones,
      leyenda_peticiones: 'instrumentada: true=coincidencia estática; false=plantilla fija sin regla (incluye GET ignorados); null=expresión dinámica por verificar.',
      exportaciones,
      rutas: PANTALLAS.map(([plantilla, pantalla, modulo]) => ({ plantilla, pantalla, modulo })),
      catalogo_controles: { ...CONTROLES, ...catalogo },
      formularios_confirmados: FORMULARIOS,
      exportaciones_confirmadas: EXPORTACIONES,
      eventos: extraerArray('EVENTOS'),
      campos_exactos_dataLayer: extraerArray('CAMPOS'),
      limites: [
        'Actas.tsx CRUD no tiene ruta activa; no existe workflow de aprobación de actas.',
        'Formulario: solo los seis IDs explícitos tienen asociación de confirmación HTTP; no se infiere éxito desde onSubmit.',
        'Solo cuatro exportaciones XLSX locales tienen app_export; un clic descargar no acredita descarga al disco.',
        'No se registran lecturas GET generales ni polling.',
        'El inventario cuenta callsites, no instancias por fila ni uso observado.',
      ],
    },
  }
}

export function crearInstrumentacionAnalitica(): Plugin {
  let raiz = ''
  let inventario: ReturnType<typeof inventariarProyecto> | null = null
  return {
    name: 'hitss-analitica-estatica',
    enforce: 'pre',
    config(configuracion) {
      raiz = resolve(configuracion.root ?? process.cwd())
      inventario = inventariarProyecto(raiz)
      return { define: { __CONTROLES_ANALITICA__: JSON.stringify(inventario.catalogo) } }
    },
    transform(codigo, id) {
      const archivo = id.split('?', 1)[0]
      if (!archivo.endsWith('.tsx')) return null
      const relativo = relative(raiz, archivo).replace(/\\/g, '/')
      if (!relativo.startsWith('src/')) return null
      return { code: analizarControles(codigo, relativo).codigo, map: null }
    },
    generateBundle() {
      if (inventario) this.emitFile({
        type: 'asset', fileName: 'inventario-analitica.json',
        source: JSON.stringify(inventario.inventario, null, 2),
      })
    },
  }
}

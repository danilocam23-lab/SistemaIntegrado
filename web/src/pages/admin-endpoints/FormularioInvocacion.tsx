import { AreaTexto, Aviso, Campo, Selector } from '../../components/ui'
import { opcionesEnum, tipoDeCampo } from './invocacion'
import type { EstadoProbadorEndpoint } from './useProbadorEndpoint'
import type { EndpointCatalogo, ParametroEndpoint } from '../../types'

interface Props {
  endpoint: EndpointCatalogo
  estado: EstadoProbadorEndpoint
}

function CampoParametro({
  parametro,
  valor,
  onChange,
}: {
  parametro: ParametroEndpoint
  valor: string
  onChange: (valor: string) => void
}) {
  const tipo = tipoDeCampo(parametro)
  const etiqueta = `${parametro.name}${parametro.required ? ' *' : ''}`

  if (tipo === 'enum') {
    return (
      <Selector etiqueta={etiqueta} value={valor} onChange={(e) => onChange(e.target.value)} className="min-w-48">
        <option value="">— Sin definir —</option>
        {opcionesEnum(parametro).map((op) => (
          <option key={op} value={op}>
            {op}
          </option>
        ))}
      </Selector>
    )
  }
  if (tipo === 'boolean') {
    return (
      <Selector etiqueta={etiqueta} value={valor} onChange={(e) => onChange(e.target.value)} className="min-w-32">
        <option value="">— Sin definir —</option>
        <option value="true">true</option>
        <option value="false">false</option>
      </Selector>
    )
  }
  return (
    <Campo
      etiqueta={etiqueta}
      ayuda={parametro.description}
      type={tipo === 'numero' ? 'number' : 'text'}
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      required={parametro.required}
      className="min-w-48"
    />
  )
}

/** Formulario generado desde el esquema OpenAPI del endpoint (F4.6, ADR-0008). */
export function FormularioInvocacion({ endpoint, estado }: Props) {
  const {
    nombresPath,
    parametrosQuery,
    parametrosHeader,
    multipart,
    requiereCuerpo,
    valoresPath,
    actualizarPath,
    valoresQuery,
    actualizarQuery,
    valoresHeader,
    actualizarHeader,
    cuerpoTexto,
    setCuerpoTexto,
    errorCuerpo,
  } = estado

  return (
    <div className="space-y-4">
      {nombresPath.length > 0 && (
        <div>
          <p className="etiqueta-sup mb-2">Parámetros de ruta</p>
          <div className="flex flex-wrap gap-3">
            {nombresPath.map((nombre) => (
              <Campo
                key={nombre}
                etiqueta={`${nombre} *`}
                value={valoresPath[nombre] ?? ''}
                onChange={(e) => actualizarPath(nombre, e.target.value)}
                required
                className="min-w-48"
              />
            ))}
          </div>
        </div>
      )}

      {parametrosQuery.length > 0 && (
        <div>
          <p className="etiqueta-sup mb-2">Parámetros de consulta</p>
          <div className="flex flex-wrap gap-3">
            {parametrosQuery.map((parametro) => (
              <CampoParametro
                key={parametro.name}
                parametro={parametro}
                valor={valoresQuery[parametro.name] ?? ''}
                onChange={(v) => actualizarQuery(parametro.name, v)}
              />
            ))}
          </div>
        </div>
      )}

      {parametrosHeader.length > 0 && (
        <div>
          <p className="etiqueta-sup mb-2">Cabeceras</p>
          <div className="flex flex-wrap gap-3">
            {parametrosHeader.map((parametro) => (
              <CampoParametro
                key={parametro.name}
                parametro={parametro}
                valor={valoresHeader[parametro.name] ?? ''}
                onChange={(v) => actualizarHeader(parametro.name, v)}
              />
            ))}
          </div>
        </div>
      )}

      {multipart && (
        <Aviso tono="info">
          Este endpoint espera un archivo (<code>multipart/form-data</code>). El probador no soporta adjuntar
          archivos todavía; pruébalo desde <code>/docs</code>.
        </Aviso>
      )}

      {!multipart && requiereCuerpo && (
        <div>
          <p className="etiqueta-sup mb-2">Cuerpo (JSON)</p>
          <AreaTexto
            value={cuerpoTexto}
            onChange={(e) => setCuerpoTexto(e.target.value)}
            rows={8}
            className="font-mono text-xs"
            spellCheck={false}
          />
          {errorCuerpo && <Aviso tono="error" className="mt-2">{errorCuerpo}</Aviso>}
        </div>
      )}

      {endpoint.requiere_aplicacion && (
        <p className="text-xs text-slate-500">
          Esta operación exige <code>X-Aplicacion</code>: usa la aplicación activa en el selector de la barra
          superior (o <code>__todas__</code> en modo consolidado, solo lectura salvo excepción explícita).
        </p>
      )}
    </div>
  )
}

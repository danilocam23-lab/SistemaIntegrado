import { useState } from 'react'
import { ENTREGAS_ACTAS_CONFIG_CLAVES, ENTREGAS_ACTAS_COLUMNAS, ENTREGAS_ACTAS_FILTROS, REQUERIMIENTOS_CONFIG_CLAVES, REQUERIMIENTOS_COLUMNAS, REQUERIMIENTOS_FILTROS } from '../constantes'
import { SeccionCargaExcel } from './configuracion/SeccionCargaExcel'
import { SeccionCamposConfigurables } from './configuracion/SeccionCamposConfigurables'
import { SeccionCategorias } from './configuracion/SeccionCategorias'
import { SeccionEstados } from './configuracion/SeccionEstados'
import { SeccionFestivos } from './configuracion/SeccionFestivos'
import { SeccionListaChips } from './configuracion/SeccionListaChips'
import { SeccionParametros } from './configuracion/SeccionParametros'
import { SeccionTarifas } from './configuracion/SeccionTarifas'
import { PESTANAS } from './configuracion/tipos'
import type { Tab } from './configuracion/tipos'
import { useCargaExcel } from './configuracion/useCargaExcel'
import { useCamposConfigurables } from './configuracion/useCamposConfigurables'
import { useCategorias } from './configuracion/useCategorias'
import { useDatosConfiguracion } from './configuracion/useDatosConfiguracion'
import { useEstadosConfigurables } from './configuracion/useEstadosConfigurables'
import { useFestivos } from './configuracion/useFestivos'
import { useListaEncolada } from './configuracion/useListaEncolada'
import { useParametros } from './configuracion/useParametros'
import { useTarifas } from './configuracion/useTarifas'

export default function Configuracion() {
  const [tab, setTab] = useState<Tab>('tarifas')

  const { datos, error, recargar } = useDatosConfiguracion()
  // INVARIANTE 4: aviso/ok compartidos viven en el shell y se inyectan a Roles, Tipos, Festivos y Parametros.
  const [aviso, setAviso] = useState('')
  const [ok, setOk] = useState('')

  // INVARIANTE 1: todos los hooks de seccion se invocan sin condicion; solo el JSX depende de tab.
  const tarifasState = useTarifas()
  const categoriasState = useCategorias()
  const rolesState = useListaEncolada({
    endpoint: '/personas/roles',
    clave: 'roles_persona',
    grupo: 'personas',
    mensajeOk: 'Roles guardados.',
    recargar,
    setAviso,
    setOk,
  })
  const tiposContratacionState = useListaEncolada({
    endpoint: '/personas/tipos-contratacion',
    clave: 'tipos_contratacion',
    grupo: 'personas',
    mensajeOk: 'Tipos de contratación guardados.',
    recargar,
    setAviso,
    setOk,
  })
  const festivosState = useFestivos({ setAviso, setOk })
  const parametrosState = useParametros({ recargar, setAviso, setOk })
  const estadosState = useEstadosConfigurables({ datos, recargar })
  const entregasActasState = useCamposConfigurables({
    datos,
    recargar,
    configClaves: ENTREGAS_ACTAS_CONFIG_CLAVES,
    columnasCatalogo: ENTREGAS_ACTAS_COLUMNAS,
    filtrosCatalogo: ENTREGAS_ACTAS_FILTROS,
    grupo: 'entregas_actas',
  })
  const requerimientosState = useCamposConfigurables({
    datos,
    recargar,
    configClaves: REQUERIMIENTOS_CONFIG_CLAVES,
    columnasCatalogo: REQUERIMIENTOS_COLUMNAS,
    filtrosCatalogo: REQUERIMIENTOS_FILTROS,
    grupo: 'requerimientos',
  })
  const cargaExcelState = useCargaExcel({ datos, recargar })

  return (
    <div>
      <h1 className="titulo-pagina mb-4">Configuración</h1>

      {/* ═══ Tabs ═══ */}
      <div className="pestanas mb-6">
        {PESTANAS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`pestana ${tab === id ? 'pestana-activa' : ''}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ═══ TAB: Tarifas ═══ */}
      {tab === 'tarifas' && <SeccionTarifas {...tarifasState} />}

      {/* ═══ TAB: Categorías ═══ */}
      {tab === 'categorias' && <SeccionCategorias {...categoriasState} />}

      {/* ═══ TAB: Roles ═══ */}
      {tab === 'roles' && (
        <SeccionListaChips
          {...rolesState}
          titulo="Roles de personas"
          placeholder="Nuevo rol (ej: QA)"
          textoVacio="Sin roles configurados"
          ok={ok}
        />
      )}

      {/* ═══ TAB: Tipo de contratación ═══ */}
      {tab === 'tipos_contratacion' && (
        <SeccionListaChips
          {...tiposContratacionState}
          titulo="Tipos de contratación"
          placeholder="Nuevo tipo (ej: TERMINO FIJO)"
          textoVacio="Sin tipos de contratación configurados"
          ok={ok}
        />
      )}

      {/* ═══ TAB: Festivos ═══ */}
      {tab === 'festivos' && <SeccionFestivos {...festivosState} aviso={aviso} error={error} />}

      {/* ═══ TAB: Parámetros ═══ */}
      {tab === 'parametros' && (
        <SeccionParametros
          {...parametrosState}
          datos={datos}
          aviso={aviso}
          ok={ok}
          error={error}
        />
      )}

      {/* ═══ TAB: Estados ═══ */}
      {tab === 'estados' && <SeccionEstados {...estadosState} />}


      {/* ═══ TAB: Entregas de Actas ═══ */}
      {tab === 'entregas_actas' && (
        <SeccionCamposConfigurables
          {...entregasActasState}
          descripcion={(
            <p className="text-sm text-slate-500">
              Activa o desactiva, sin necesidad de desarrollo, las columnas visibles en la tabla, los
              filtros de búsqueda disponibles y los campos incluidos al exportar a Excel en la vista
              "Entregas de Actas".
            </p>
          )}
          columnasCatalogo={ENTREGAS_ACTAS_COLUMNAS}
          filtrosCatalogo={ENTREGAS_ACTAS_FILTROS}
        />
      )}


      {/* ═══ TAB: Requerimientos ═══ */}
      {tab === 'requerimientos' && (
        <SeccionCamposConfigurables
          {...requerimientosState}
          descripcion={(
            <p className="text-sm text-slate-500">
              Activa o desactiva, sin necesidad de desarrollo, las columnas visibles en la tabla principal,
              los filtros de búsqueda disponibles y los campos incluidos al exportar a Excel en la vista
              "Requerimientos". Las columnas de acciones (expandir, estimación, editar/eliminar) no son
              configurables porque son funcionales.
            </p>
          )}
          columnasCatalogo={REQUERIMIENTOS_COLUMNAS}
          filtrosCatalogo={REQUERIMIENTOS_FILTROS}
        />
      )}


      {/* ═══ TAB: Carga de Excel ═══ */}
      {tab === 'carga_excel' && <SeccionCargaExcel {...cargaExcelState} />}

    </div>
  )
}

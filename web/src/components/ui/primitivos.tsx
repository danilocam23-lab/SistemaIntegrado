import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'

/* ═══════════════════════════════════════════════════════════════
   PRIMITIVOS DEL SISTEMA DE DISEÑO
   Todos los botones, campos y filtros de la aplicación deben salir
   de aquí para garantizar un diseño idéntico en todas las páginas.
   Las clases (.btn, .campo, .tarjeta…) están en src/index.css
   ═══════════════════════════════════════════════════════════════ */

export function cx(...partes: Array<string | false | null | undefined>) {
  return partes.filter(Boolean).join(' ')
}

/* ── Botón ─────────────────────────────────────────────────────── */

export type VarianteBoton =
  | 'primario'
  | 'secundario'
  | 'suave'
  | 'fantasma'
  | 'peligro'
  | 'peligro-suave'
  | 'exito'

export type TamanoBoton = 'sm' | 'md' | 'lg'

const VARIANTES: Record<VarianteBoton, string> = {
  primario: 'btn-primario',
  secundario: 'btn-secundario',
  suave: 'btn-suave',
  fantasma: 'btn-fantasma',
  peligro: 'btn-peligro',
  'peligro-suave': 'btn-peligro-suave',
  exito: 'btn-exito',
}

const TAMANOS: Record<TamanoBoton, string> = {
  sm: 'btn-sm',
  md: '',
  lg: 'btn-lg',
}

interface PropsBoton extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBoton
  tamano?: TamanoBoton
  bloque?: boolean
  icono?: ReactNode
}

export function Boton({
  variante = 'secundario',
  tamano = 'md',
  bloque = false,
  icono,
  className,
  children,
  type = 'button',
  ...resto
}: PropsBoton) {
  return (
    <button
      type={type}
      className={cx('btn', VARIANTES[variante], TAMANOS[tamano], bloque && 'btn-bloque', className)}
      {...resto}
    >
      {icono}
      {children}
    </button>
  )
}

/* ── Campos de formulario ──────────────────────────────────────── */

interface PropsCampo extends InputHTMLAttributes<HTMLInputElement> {
  etiqueta?: string
  ayuda?: string
  compacto?: boolean
}

export function Campo({ etiqueta, ayuda, compacto, className, ...resto }: PropsCampo) {
  const input = (
    <input className={cx('campo', compacto && 'campo-sm', className)} {...resto} />
  )
  if (!etiqueta && !ayuda) return input
  return (
    <label className="grupo-filtro">
      {etiqueta && <span className="etiqueta">{etiqueta}</span>}
      {input}
      {ayuda && <span className="ayuda">{ayuda}</span>}
    </label>
  )
}

interface PropsSelector extends SelectHTMLAttributes<HTMLSelectElement> {
  etiqueta?: string
  compacto?: boolean
}

export function Selector({ etiqueta, compacto, className, children, ...resto }: PropsSelector) {
  const select = (
    <select className={cx('campo pr-8', compacto && 'campo-sm', className)} {...resto}>
      {children}
    </select>
  )
  if (!etiqueta) return select
  return (
    <label className="grupo-filtro">
      <span className="etiqueta">{etiqueta}</span>
      {select}
    </label>
  )
}

interface PropsArea extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  etiqueta?: string
}

export function AreaTexto({ etiqueta, className, ...resto }: PropsArea) {
  const area = <textarea className={cx('campo', className)} {...resto} />
  if (!etiqueta) return area
  return (
    <label className="grupo-filtro">
      <span className="etiqueta">{etiqueta}</span>
      {area}
    </label>
  )
}

/* ── Superficies ───────────────────────────────────────────────── */

export function Tarjeta({
  children,
  className,
  padding = true,
}: {
  children: ReactNode
  className?: string
  padding?: boolean
}) {
  return <div className={cx('tarjeta', padding && 'tarjeta-pad', className)}>{children}</div>
}

export function EncabezadoPagina({
  titulo,
  descripcion,
  acciones,
  icono,
}: {
  titulo: string
  descripcion?: ReactNode
  acciones?: ReactNode
  icono?: ReactNode
}) {
  return (
    <header className="encabezado-pagina">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          {icono && (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-marca-50 text-lg text-marca-700">
              {icono}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="titulo-pagina truncate">{titulo}</h1>
            {descripcion && <p className="subtitulo-pagina">{descripcion}</p>}
          </div>
        </div>
        {acciones && <div className="flex flex-wrap items-center gap-2">{acciones}</div>}
      </div>
    </header>
  )
}

export function BarraFiltros({
  children,
  titulo,
  className,
}: {
  children: ReactNode
  titulo?: string
  className?: string
}) {
  return (
    <div className={cx('barra-filtros', className)}>
      {titulo && (
        <span className="w-full text-2xs font-bold uppercase tracking-wider text-slate-500">
          {titulo}
        </span>
      )}
      {children}
    </div>
  )
}

const TONOS_CHIP = {
  neutro: 'chip-neutro',
  marca: 'chip-marca',
  exito: 'chip-exito',
  alerta: 'chip-alerta',
  error: 'chip-error',
} as const

export function Chip({
  children,
  tono = 'neutro',
  className,
}: {
  children: ReactNode
  tono?: keyof typeof TONOS_CHIP
  className?: string
}) {
  return <span className={cx('chip', TONOS_CHIP[tono], className)}>{children}</span>
}

export function Kpi({
  rotulo,
  valor,
  nota,
  acento,
  className,
}: {
  rotulo: string
  valor: ReactNode
  nota?: ReactNode
  acento?: string
  className?: string
}) {
  return (
    <div className={cx('kpi relative overflow-hidden', className)}>
      {acento && (
        <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: acento }} />
      )}
      <div className={cx(acento && 'pl-2')}>
        <p className="kpi-rotulo">{rotulo}</p>
        <p className="kpi-valor">{valor}</p>
        {nota && <p className="kpi-nota">{nota}</p>}
      </div>
    </div>
  )
}

export function TablaScroll({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('tabla-scroll', className)}>{children}</div>
}

const TONOS_AVISO = {
  info: 'aviso-info',
  alerta: 'aviso-alerta',
  error: 'aviso-error',
  exito: 'aviso-exito',
} as const

export function Aviso({
  tono = 'info',
  children,
  className,
}: {
  tono?: keyof typeof TONOS_AVISO
  children: ReactNode
  className?: string
}) {
  return <div className={cx('aviso', TONOS_AVISO[tono], className)}>{children}</div>
}

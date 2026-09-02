/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // Clases del sistema de diseño: siempre presentes aunque se compongan
  // dinámicamente (por ejemplo `aviso-${tono}`).
  safelist: [
    'btn', 'btn-primario', 'btn-secundario', 'btn-suave', 'btn-fantasma',
    'btn-peligro', 'btn-peligro-suave', 'btn-exito', 'btn-sm', 'btn-lg',
    'btn-icono', 'btn-bloque', 'btn-alerta',
    'enlace-accion', 'enlace-accion-peligro', 'enlace-accion-alerta', 'enlace-accion-sutil',
    'pestanas', 'pestana', 'pestana-activa',
    'campo', 'campo-sm', 'etiqueta', 'etiqueta-sup', 'ayuda',
    'tarjeta', 'tarjeta-pad', 'tarjeta-encabezado', 'tarjeta-titulo',
    'pagina', 'encabezado-pagina', 'titulo-pagina', 'subtitulo-pagina', 'titulo-seccion',
    'barra-filtros', 'grupo-filtro', 'filtro-desplegable', 'filtro-desplegable-activo',
    'panel-desplegable', 'opcion-filtro', 'opcion-filtro-on', 'opcion-filtro-off',
    'enlace-mini', 'contador-filtro',
    'chip', 'chip-neutro', 'chip-marca', 'chip-exito', 'chip-alerta', 'chip-error',
    'kpi', 'kpi-rotulo', 'kpi-valor', 'kpi-nota',
    'tabla', 'tabla-scroll',
    'aviso', 'aviso-info', 'aviso-alerta', 'aviso-error', 'aviso-exito',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter',
          'Segoe UI',
          'system-ui',
          '-apple-system',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        mono: ['JetBrains Mono', 'Consolas', 'Menlo', 'monospace'],
      },
      colors: {
        // Azul corporativo HITSS
        marca: {
          50: '#eef5fc',
          100: '#d6e6f7',
          200: '#aecdef',
          300: '#7fb0e4',
          400: '#4d8ed3',
          500: '#2c72bd',
          DEFAULT: '#1e5fa8',
          600: '#1e5fa8',
          700: '#184c88',
          800: '#123a68',
          osc: '#0f3a6b',
          900: '#0f3a6b',
        },
      },
      fontSize: {
        // Escala tipografica del sistema (tamano / interlineado)
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],      // 11px
        xs: ['0.75rem', { lineHeight: '1.125rem' }],       // 12px
        sm: ['0.8125rem', { lineHeight: '1.25rem' }],      // 13px
        base: ['0.875rem', { lineHeight: '1.375rem' }],    // 14px
        lg: ['1rem', { lineHeight: '1.5rem' }],            // 16px
        xl: ['1.125rem', { lineHeight: '1.625rem' }],      // 18px
        '2xl': ['1.375rem', { lineHeight: '1.875rem' }],   // 22px
        '3xl': ['1.75rem', { lineHeight: '2.125rem' }],    // 28px
        '4xl': ['2.125rem', { lineHeight: '2.5rem' }],     // 34px
      },
      borderRadius: {
        // Radios unificados: controles = lg, tarjetas = xl
        lg: '0.5rem',
        xl: '0.75rem',
        '2xl': '0.75rem',
        '3xl': '1rem',
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgb(15 23 42 / 0.05)',
        DEFAULT: '0 1px 3px 0 rgb(15 23 42 / 0.08), 0 1px 2px -1px rgb(15 23 42 / 0.06)',
        md: '0 4px 12px -2px rgb(15 23 42 / 0.08), 0 2px 6px -2px rgb(15 23 42 / 0.05)',
        lg: '0 10px 24px -6px rgb(15 23 42 / 0.10), 0 4px 10px -4px rgb(15 23 42 / 0.06)',
        panel: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 8px 24px -12px rgb(15 23 42 / 0.16)',
      },
      screens: {
        xs: '480px',
        '3xl': '1800px',
      },
    },
  },
  plugins: [],
}

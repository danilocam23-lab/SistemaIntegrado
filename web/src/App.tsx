import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { AplicacionProvider } from './context/AplicacionContext'
import ProtectedRoute from './components/ProtectedRoute'
import RoleRoute from './components/RoleRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import DashboardRequerimientos from './pages/DashboardRequerimientos'
import AdminAplicaciones from './pages/AdminAplicaciones'
import Usuarios from './pages/Usuarios'
import Requerimientos from './pages/Requerimientos'
import RequerimientoDetalle from './pages/RequerimientoDetalle'
import RequerimientoNuevo from './pages/RequerimientoNuevo'
import Personas from './pages/Personas'
import Asignaciones from './pages/Asignaciones'
import Capacidades from './pages/Capacidades'
import ControlHorasFacturable from './pages/ControlHorasFacturable'
import Roadmap from './pages/Roadmap'
import Estimaciones from './pages/Estimaciones'
import AzureDevOps from './pages/AzureDevOps'
import Configuracion from './pages/Configuracion'
import EntregasActas from './pages/EntregasActas'
import RequerimientosDetalleANS from './pages/RequerimientosDetalleANS'
import DashboardEstados from './pages/DashboardEstados'
import DashboardSquad from './pages/DashboardSquad'
import AdminEndpoints from './pages/AdminEndpoints'
import Importacion from './pages/Importacion'
import FacturacionGeneral from './pages/FacturacionGeneral'
import FacturacionValoresProyecto from './pages/FacturacionValoresProyecto'
import SoporteSolicitudesFabrica from './pages/SoporteSolicitudesFabrica'
import SoporteDetalleANS from './pages/SoporteDetalleANS'
import SoporteGarantiasWO from './pages/SoporteGarantiasWO'

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AuthProvider>
        <AplicacionProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<RoleRoute permiso="dashboard.ver"><DashboardRequerimientos /></RoleRoute>} />
              <Route path="dashboard-estados" element={<RoleRoute permiso="dashboard.estados.ver"><DashboardEstados /></RoleRoute>} />
              <Route path="dashboard-backlog" element={<RoleRoute permiso="dashboard.squad.ver"><DashboardSquad /></RoleRoute>} />
              <Route path="dashboard-squad" element={<Navigate to="/dashboard-backlog" replace />} />
              <Route path="requerimientos" element={<RoleRoute permiso="requerimientos.ver"><Requerimientos /></RoleRoute>} />
              <Route path="requerimientos/detalle-ans" element={<RoleRoute permiso="requerimientos.ver"><RequerimientosDetalleANS /></RoleRoute>} />
              <Route path="requerimientos/nuevo" element={<RoleRoute permiso="requerimientos.crear"><RequerimientoNuevo /></RoleRoute>} />
              <Route path="requerimientos/:reqId" element={<RoleRoute permiso="requerimientos.ver"><RequerimientoDetalle /></RoleRoute>} />
              <Route path="entregas-actas" element={<RoleRoute permiso="entregas_actas.ver"><EntregasActas /></RoleRoute>} />
              <Route path="tarifas" element={<Navigate to="/configuracion" replace />} />
              <Route path="personas" element={<Personas />} />
              <Route path="categorias" element={<Navigate to="/configuracion" replace />} />
              <Route path="asignaciones" element={<Asignaciones />} />
              <Route path="capacidades" element={<Capacidades />} />
              <Route path="control-horas-facturable" element={<RoleRoute permiso="control_horas_facturable.ver"><ControlHorasFacturable /></RoleRoute>} />
              <Route path="roadmap" element={<Roadmap />} />
              <Route path="estimaciones" element={<RoleRoute permiso="estimaciones.ver"><Estimaciones /></RoleRoute>} />
              <Route path="azure-devops" element={<RoleRoute permiso="azure_devops.ver"><AzureDevOps /></RoleRoute>} />
              <Route path="configuracion" element={<RoleRoute permiso="admin.configuracion.ver"><Configuracion /></RoleRoute>} />
              <Route
                path="admin/aplicaciones"
                element={<RoleRoute permiso="aplicaciones.ver"><AdminAplicaciones /></RoleRoute>}
              />
              <Route path="admin/usuarios" element={<RoleRoute permiso="admin.usuarios.ver"><Usuarios /></RoleRoute>} />
              <Route
                path="admin/endpoints"
                element={<RoleRoute permiso="admin.endpoints.ver"><AdminEndpoints /></RoleRoute>}
              />
              <Route
                path="admin/importacion"
                element={<RoleRoute permiso="admin.importacion.ver"><Importacion /></RoleRoute>}
              />
              <Route path="facturacion/general" element={<RoleRoute permiso="facturacion.ver"><FacturacionGeneral /></RoleRoute>} />
              <Route path="facturacion/valores-proyecto" element={<RoleRoute permiso="facturacion.ver"><FacturacionValoresProyecto /></RoleRoute>} />
              <Route path="soporte/solicitudes-fabrica" element={<RoleRoute permiso="soporte.solicitudes_fabrica.ver"><SoporteSolicitudesFabrica /></RoleRoute>} />
              <Route path="soporte/detalle-ans" element={<RoleRoute permiso="soporte.solicitudes_fabrica.ver"><SoporteDetalleANS /></RoleRoute>} />
              <Route path="soporte/garantias-wo" element={<RoleRoute permiso="soporte.solicitudes_fabrica.ver"><SoporteGarantiasWO /></RoleRoute>} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AplicacionProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

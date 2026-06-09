# Requerimientos Técnicos Simplificados de Nueva Versión

## Para qué sirve este documento

Este documento baja la idea funcional a reglas técnicas simples. No busca detallar código, pero sí dejar claro qué hay que construir para que la nueva versión salga con el menor riesgo posible.

La meta es que el sistema pase de una sola aplicación con una sola base a una plataforma multi-aplicación, usando `MongoDB`, autenticación y control de permisos.

---

## Qué cambia en la nueva versión

Hoy el sistema funciona como una sola aplicación. La nueva versión debe permitir que el mismo producto soporte varias aplicaciones, por ejemplo:

- `CRM`
- `BI`
- `Soporte`
- `Mesa de Ayuda`

Todas usarán la misma plataforma y el mismo código base, pero cada una tendrá sus propios datos.

Técnicamente esto significa:

- una sola aplicación web
- un solo backend
- una sola base MongoDB
- separación lógica por `applicationId`

---

## Regla principal del diseño

Cada dato del sistema debe pertenecer a una aplicación.

Eso se resuelve agregando `applicationId` a todo lo que sea operativo.

Ejemplo simple:

```json
{
  "name": "Juan Perez",
  "applicationId": "crm"
}
```

Si una consulta no filtra por `applicationId`, existe riesgo de mezclar información de distintas aplicaciones. Esa es una de las reglas más importantes de toda la nueva versión.

---

## Qué debe permitir el sistema

## 1. Soportar múltiples aplicaciones

El sistema debe permitir registrar y operar varias aplicaciones dentro de la misma plataforma.

Cada aplicación debe tener:

- nombre
- código
- estado
- configuración base
- usuarios asignados
- datos propios

Cada aplicación debe estar aislada del resto.

---

## 2. Crear aplicaciones nuevas desde administración

Las aplicaciones no deben quedar quemadas en el código.

Deben poder crearse desde un módulo de administración por usuarios autorizados.

Al crear una aplicación nueva:

- se registra la aplicación
- se crea su configuración base
- se crean sus catálogos base
- queda disponible para asignar usuarios
- no se copian datos operativos previos

---

## 3. Plantilla base para nuevas aplicaciones

Cuando se cree una nueva aplicación, el sistema debe generar una estructura inicial mínima.

### Sí se debe crear automáticamente

- categorías base
- estados base
- configuraciones generales base
- parámetros funcionales mínimos
- estructura de permisos

### No se debe copiar

- desarrolladores
- proyectos
- asignaciones
- roadmap
- sprints
- historial de auditoría
- datos de Azure DevOps
- horas o capacidades cargadas
- work items
- información importada

Esto equivale a decir: se clona la estructura, no la data del negocio.

---

## 4. Módulo de administración

Debe existir un módulo de administración para manejar aplicaciones y acceso.

### Debe permitir como mínimo

- listar aplicaciones
- crear aplicación
- editar nombre, código y descripción
- activar o desactivar aplicación
- asignar usuarios a una aplicación
- consultar creador y fecha de creación

### Sería útil agregar

- ver si una aplicación tiene datos
- ver cantidad de usuarios por aplicación
- reinicializar catálogos base
- filtrar por estado

---

## 5. Autenticación

La nueva versión debe tener inicio de sesión.

### Requerimientos mínimos

- login con usuario y contraseña
- sesión persistente
- obtención del usuario autenticado
- cierre de sesión

### Solución técnica sugerida

- `JWT` para sesión
- `bcrypt` para contraseñas

---

## 6. Autorización

No todos los usuarios deben poder hacer lo mismo.

### Roles sugeridos

#### `superadmin`

Puede:

- crear aplicaciones
- editar cualquier aplicación
- activar o desactivar aplicaciones
- asignar usuarios
- ver todas las aplicaciones

#### `admin_app`

Puede:

- administrar solo aplicaciones asignadas
- modificar configuración interna de su aplicación

#### `editor`

Puede:

- trabajar la información de su aplicación
- no puede crear aplicaciones

#### `viewer`

Puede:

- consultar información
- no puede modificar
- no puede crear aplicaciones

### Permisos sugeridos

- `canCreateApplications`
- `canManageAllApplications`
- `canManageAssignedApplications`
- `canAccessAdminModule`

---

## 7. Modelo mínimo de datos

## Colección `applications`

Debe guardar al menos:

- `id`
- `code`
- `name`
- `description`
- `isActive`
- `createdBy`
- `createdAt`
- `updatedAt`

## Colección `users`

Debe guardar al menos:

- `id`
- `name`
- `email`
- `passwordHash`
- `role`
- `isActive`
- `applicationIds`
- `canCreateApplications`

## Colecciones operativas

Deben quedar asociadas a una aplicación:

- `developers`
- `categories`
- `workloadAssignments`
- `workloadProjects`
- `sprints`
- `auditLogs`
- `settings`
- `projectStatuses`
- `monthlyCapacity`
- `projectCatalog`
- `azdoMappings`
- `azdoWorkItems`
- `azdoSyncLog`

---

## 8. Migración a MongoDB

La migración debe mover la información actual a la nueva estructura en MongoDB.

### Regla de negocio y técnica

Debe migrarse la información vigente al momento del corte final. La aplicación origen puede seguir cambiando mientras se desarrolla la nueva versión, por lo tanto no se debe usar una copia vieja como base definitiva.

### Qué implica eso

- pueden hacerse migraciones de prueba
- debe existir una migración final de corte
- la migración final debe tomar el estado más reciente de la aplicación origen
- deben conservarse altas, bajas y cambios hechos antes del paso a producción

### Resultado esperado

La información actual debe migrarse como una aplicación inicial, por ejemplo:

- `CRM`

Las aplicaciones nuevas creadas después deben nacer sin datos operativos.

---

## 9. Cambios requeridos en frontend

El frontend debe agregar como mínimo:

- pantalla de login
- selector de aplicación
- pantalla de administración de aplicaciones
- pantalla de creación y edición de aplicaciones
- asignación de usuarios por aplicación

### Reglas de funcionamiento

- el usuario solo debe ver aplicaciones autorizadas
- el cambio de aplicación debe actualizar el contexto completo
- si la aplicación está vacía, debe mostrarse estado inicial limpio

---

## 10. Cambios requeridos en backend

El backend debe agregar:

- autenticación
- autorización
- CRUD de aplicaciones
- middleware de sesión
- middleware de permisos
- middleware de resolución de `applicationId`
- filtros obligatorios por aplicación

### Endpoints base sugeridos

```http
POST   /api/auth/login
GET    /api/auth/me

GET    /api/applications
POST   /api/applications
PUT    /api/applications/:id
PATCH  /api/applications/:id/status

GET    /api/applications/:id/users
POST   /api/applications/:id/users
DELETE /api/applications/:id/users/:userId
```

---

## 11. Riesgos que deben controlarse

- mezclar datos entre aplicaciones por falta de filtro
- crear aplicaciones sin configuración base suficiente
- perder cambios recientes si la migración final usa una copia vieja
- permitir que usuarios sin permisos creen o administren aplicaciones
- dejar módulos viejos consultando sin `applicationId`

---

## 12. Criterios de aceptación

1. Solo usuarios autorizados pueden crear aplicaciones.
2. Una aplicación nueva se crea desde administración.
3. La aplicación creada aparece en el selector.
4. La aplicación nueva tiene estructura base.
5. La aplicación nueva no tiene datos operativos anteriores.
6. Los datos no se mezclan entre aplicaciones.
7. La información actual se conserva al migrar.
8. Se puede activar o desactivar una aplicación.
9. Los permisos por rol funcionan correctamente.

---

## 13. Orden recomendado de implementación

1. definir `applications`
2. definir `users`, roles y permisos
3. migrar a `MongoDB`
4. incorporar `applicationId` en toda la data operativa
5. implementar autenticación
6. implementar autorización
7. construir módulo de administración
8. crear plantilla base de nuevas aplicaciones
9. agregar selector de aplicación en frontend
10. probar aislamiento, seguridad y migración final

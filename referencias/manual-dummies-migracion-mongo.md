# Manual Técnico Dummies: Migración a MongoDB

## Para qué sirve este manual

Este manual explica la migración en lenguaje simple, pero pensando en ejecución técnica. La idea es que cualquiera del equipo entienda qué hay que mover, qué no hay que tocar y qué controles mínimos deben existir para evitar problemas.

No es un documento de código. Es una guía práctica para preparar, ejecutar y validar la migración.

---

## Qué se quiere lograr

Pasar la base actual a `MongoDB` sin perder información y dejando listo el sistema para trabajar con varias aplicaciones.

El objetivo técnico final es este:

- conservar la data actual
- guardar esa data como una aplicación inicial, por ejemplo `CRM`
- permitir crear otras aplicaciones como `BI` o `Soporte`
- evitar que se mezclen datos entre aplicaciones

---

## Idea técnica principal

La solución nueva no debe crear un sistema distinto para cada aplicación. Debe existir una sola plataforma y una sola base Mongo, separando la información con un campo llamado `applicationId`.

Ejemplo:

```json
{
  "name": "Juan Perez",
  "applicationId": "crm"
}
```

Eso permite reutilizar el mismo backend y el mismo frontend sin duplicar desarrollo.

---

## Qué es lo que sí se migra

Debe migrarse todo lo que exista y esté vigente en la aplicación origen al momento de ejecutar el corte final.

Esto es importante porque la aplicación actual sigue evolucionando. Si se toma una copia vieja, la nueva versión nacería desactualizada.

La migración final debe tomar el estado real más reciente disponible.

### Se debe migrar

- desarrolladores
- categorías
- asignaciones
- proyectos
- sprints
- auditoría
- capacidades mensuales
- configuraciones
- catálogo de proyectos
- integración Azure DevOps

### Regla práctica

Si durante el proyecto se siguen creando, editando o eliminando datos, esos cambios deben quedar incluidos en la migración final.

Por eso lo correcto es hacer:

- una o varias migraciones de prueba
- una migración final de corte con la data más reciente

---

## Qué no se debe copiar a nuevas aplicaciones

Cuando se cree una nueva aplicación después de la migración, por ejemplo `BI` o `Soporte`, no debe heredar la información operativa de `CRM`.

### No se copian

- desarrolladores existentes
- proyectos existentes
- sprints existentes
- historial de auditoría
- horas previas
- work items previos
- datos importados

La idea es simple: una nueva aplicación nace limpia.

---

## Qué sí debe traer una aplicación nueva

Una aplicación nueva no puede quedar totalmente vacía de estructura. Debe poder usarse apenas se cree.

### Debe traer

- configuración base
- categorías base
- estados base
- parámetros base
- permisos y estructura mínima de operación

En resumen:

- se clona la estructura
- no se clona la data del negocio

---

## Qué cambios técnicos hay que hacer

## 1. Crear el concepto de aplicación

Hay que crear una colección `applications`.

Cada aplicación debe tener al menos:

- `id`
- `code`
- `name`
- `description`
- `isActive`
- `createdBy`
- `createdAt`
- `updatedAt`

Ejemplos de registros:

- `CRM`
- `BI`
- `Soporte`

---

## 2. Hacer que toda la data pertenezca a una aplicación

Toda la información operativa debe guardar `applicationId`.

Esto aplica a colecciones como:

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

Si una consulta o inserción no maneja bien `applicationId`, ese punto queda como riesgo crítico.

---

## 3. Crear la estructura en MongoDB

Antes de migrar la información hay que tener lista la estructura destino.

Colecciones mínimas esperadas:

- `applications`
- `users`
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

También deben definirse índices donde tenga sentido, especialmente por:

- `applicationId`
- `developerId`
- `projectId`
- `month`
- `email`

---

## 4. Construir script de migración

Se necesita un proceso controlado para pasar la información de la base actual a MongoDB.

Ese script debe hacer al menos esto:

1. leer la base actual
2. transformar la información al nuevo modelo
3. insertar la data en MongoDB
4. marcar toda la data actual con `applicationId = crm`
5. validar errores y registrar resultados

Idealmente el script debe poder correrse más de una vez en ambiente de prueba.

---

## 5. Validar la migración

No basta con que el script termine. Hay que comprobar que el resultado sea correcto.

### Validaciones mínimas

- que los conteos coincidan entre origen y destino
- que las relaciones sigan funcionando
- que el frontend siga mostrando la información esperada
- que los filtros por aplicación funcionen
- que la aplicación `CRM` conserve su información

### Validaciones clave

- un dato de `CRM` no debe aparecer en otra aplicación
- una aplicación nueva debe aparecer sin datos operativos
- los módulos críticos deben seguir respondiendo

---

## Flujo sugerido de trabajo

## Fase 1. Preparación

- revisar tablas y relaciones actuales
- mapear tablas a colecciones Mongo
- definir modelo de `applications`
- definir modelo de `users`
- decidir qué catálogos base se clonan

## Fase 2. Construcción base

- crear conexión Mongo
- crear repositorios o modelos
- adaptar backend para usar Mongo
- agregar `applicationId` a la lógica operativa

## Fase 3. Migraciones de prueba

- crear aplicación `CRM`
- migrar una copia de prueba
- revisar conteos
- revisar pantallas principales
- corregir diferencias

## Fase 4. Alta de nuevas aplicaciones

- crear plantilla base
- probar creación de `BI`
- probar creación de `Soporte`
- validar que nacen vacías

## Fase 5. Corte final

- respaldar base actual
- detener cambios si aplica la estrategia definida
- ejecutar migración final con la data vigente
- validar funcionamiento

---

## Riesgos más importantes

### Riesgo 1. Mezcla de datos entre aplicaciones

Pasa cuando alguna consulta no filtra por `applicationId`.

### Riesgo 2. Migración desactualizada

Pasa cuando la migración final usa una copia vieja y no incluye los últimos cambios.

### Riesgo 3. Migración incompleta

Pasa cuando una tabla o módulo no se migra y la nueva versión queda con huecos.

### Riesgo 4. Relaciones rotas

Pasa cuando ids y referencias no se reconstruyen correctamente.

### Riesgo 5. Aplicaciones nuevas mal inicializadas

Pasa cuando una nueva aplicación se crea sin configuración o catálogos mínimos.

---

## Qué condiciones deben cumplirse para decir que salió bien

1. La información actual aparece completa en `CRM`.
2. Los módulos principales siguen funcionando.
3. La creación de nuevas aplicaciones funciona.
4. Las nuevas aplicaciones nacen sin datos operativos.
5. No se mezclan datos entre aplicaciones.
6. Los usuarios autorizados pueden administrar aplicaciones.

---

## Resultado esperado

Después de la migración debe existir al menos este escenario:

- `CRM` con toda la información histórica actual
- posibilidad de crear `BI`, `Soporte` u otras desde administración
- nuevas aplicaciones creadas con estructura base, pero sin datos de negocio

---

## Recomendación técnica final

La migración a MongoDB debe hacerse ya con el diseño multi-aplicación incorporado. Si se migra primero sin `applicationId` y después se adapta a multi-aplicación, el trabajo se duplica y aumenta mucho el riesgo.

La forma más segura es hacer una sola transición bien diseñada:

- con `MongoDB`
- con `applicationId`
- con autenticación
- con permisos
- con módulo de administración

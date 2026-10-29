# SDD simple sobre software existente

Línea base vigente: 59acca46ad7a0c43d5ac00bc5c548b6acc227109, inspeccionada el 2026-10-28. Primera captura histórica: bf57ebc. Alcance: backend. [Índice](../README.md) · [Constitución](../constitution.md) · [Plan](plan.md) · [Tareas](tasks.md) · [Cobertura](coverage.md).

## Regla práctica

Primero describir lo que existe; después especificar únicamente el cambio solicitado. No rehacer el proyecto para adoptar SDD. No preguntar por reglas que puedan extraerse de código, contratos y tests. Separar comportamiento actual de intención futura y de defectos detectados.

Usar la implementación conectada a la aplicación para describir comportamiento; contrastarla con OpenAPI y los tests. Una discrepancia se registra con sus fuentes y nunca se resuelve inventando una regla. Si falta evidencia, escribir [NO VERIFICADO] o [NO DOCUMENTADO EN LA IMPLEMENTACIÓN]. Esa marca no autoriza implementar una decisión nueva. Si una futura implementación depende de una decisión real de negocio ausente, dejarla pendiente y completar las tareas independientes.

## Ciclo mínimo

| Paso | Entrada | Salida verificable |
| --- | --- | --- |
| 1. Inventariar | Código integrado, contratos y pruebas | Capacidades, exclusiones y SHA de referencia |
| 2. Especificar | Comportamiento observado | Spec con QUÉ/POR QUÉ y RF en español |
| 3. Revisar | Spec y constitución | Solo ambigüedades, contradicciones, límites y conflictos |
| 4. Planificar | Spec revisada y código real | CÓMO, módulos, datos, contrato y tests por RF |
| 5. Dividir | Plan | Tareas de 20–30 minutos, dependencias y Hecho cuando |
| 6. Ejecutar si se pide | Una tarea autorizada | Cambio acotado, pruebas pertinentes y detención |
| 7. Auditar | RF y pruebas ejecutadas | Cobertura, fallos, pendientes y veredicto explícito |

SDD-01 documentó los pasos 1–5 y su cierre quedó histórico. SDD-02 actualiza lo observado y guarda los pendientes dentro de cada carpeta de spec mediante spec.md, plan.md y tasks.md, sin implementar. No ejecuta el paso 6 ni acredita el cumplimiento funcional del paso 7. El plan compartido describe la implementación actual; el plan 008 es una propuesta explícita. Ninguno ordena reimplementar capacidades existentes ni ejecutar tareas sin autorización.

## Plantilla de spec

Contexto y objetivo → usuarios → historias de usuario → RF numerados con aceptación EARS → requisitos no funcionales → casos límite → fuera de alcance → criterios de finalización → dudas y evidencia.

EARS: «CUANDO ocurre X, el sistema DEBE Y»; «SI ocurre un error X, el sistema DEBE Y»; «MIENTRAS se cumple X, el sistema DEBE Y». Mantener lenguaje observable y verificable. No incluir stack, módulos ni rutas en los RF; colocar referencias de archivos únicamente en Evidencia. Identificar requisitos globalmente como 004/RF-2 para no confundir RF locales.

## Prompts reutilizables

**Inventario y constitución.** «Lee la constitución y revisa la implementación integrada de esta capacidad. Describe qué existe y qué no, con SHA y evidencias. No escribas código ni preguntes reglas que ya estén implementadas. No cambies la constitución para justificar una discrepancia».

**Spec retrospectiva.** «Redacta o actualiza la spec con la estructura acordada. Extrae reglas y errores del código, contratos y tests. Escribe QUÉ/POR QUÉ, RF EARS en español y casos límite. Separa evidencia de texto funcional. Marca lo no verificable; no inventes comportamiento ni hagas una ronda de preguntas».

**Revisión.** «Revisa la spec contra constitución, implementación y contratos. Lista numerada de ambigüedades, contradicciones, casos límite omitidos y conflictos. Solo detecta, sin proponer soluciones ni editar código».

**Plan.** «A partir de la spec y del estado real, documenta módulos, modelo de datos, algoritmos en pseudocódigo, contrato HTTP y errores, decisiones técnicas y estrategia de tests. Vincula cada parte a sus RF. Distingue razones observables de supuestas decisiones históricas».

**Tareas.** «Divide únicamente el cambio solicitado en tareas de 20–30 minutos, ordenadas por dependencia, con RF y una línea Hecho cuando verificable. Usa checkboxes y no marques nada por anticipado. No generes trabajo para volver a construir capacidades existentes».

**Una tarea.** «Implementa SOLO Tn si esa implementación está expresamente autorizada, siguiendo spec, plan y constitución. Para cambios de comportamiento escribe primero un test pertinente que falle, luego el código. Ejecuta las comprobaciones necesarias, registra su resultado real, marca Tn solo si satisface Hecho cuando y detente. No inicies la siguiente tarea».

**Auditoría.** «Recorre todos los RF. Para cada uno indica test concreto, comando, resultado y alcance parcial o ausente. Comprueba finalización y da un veredicto. Un test identificado o un resultado antiguo no equivalen a ejecución actual».

## Discrepancias documentales observadas

| Fuente histórica | Diferencia comprobada en esta línea base |
| --- | --- |
| README del repositorio niega registro público | AuthController expone registro público y la suite HTTP lo ejercita; ver 001 |
| architecture.md e integration.md describen BE-05 sin CRUD de presupuestos | BudgetsController y la prueba budget management ya incluyen CRUD; ver 005 |
| integration.md deja CRUD y paginación de listas como futuros | TransactionsController/Service ya exponen operaciones y paginación; ver 003 |
| architecture.md menciona notifications como dominio | No se identifica módulo/controlador de notificaciones implementado; se planifica en 008, todavía sin código |

La API de metas y la omisión de meses preapertura en reportes, integradas después de la primera captura, están incorporadas en 006/007 y en la matriz. Se conservan los documentos históricos fuera de esta actualización para preservar su evidencia, no como inventario vigente. Para contratos vigentes consultar las specs, OpenAPI y la fuente de la línea base; no interpretar estas diferencias como solicitudes de cambio funcional.

## Actualización posterior

Mantener IDs y añadir RF nuevos cuando cambie el comportamiento. Actualizar juntos spec, plan afectado, tarea y matriz; registrar SHA/fecha de la nueva auditoría. Un cambio de otra capa se entrega como contrato pendiente para su propia sesión. Planificar o revisar no autoriza commit, push, merge ni despliegue.

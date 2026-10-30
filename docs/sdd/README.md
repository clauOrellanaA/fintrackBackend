# SDD simple sobre software existente

Código validado: 4bea0d915c4197346cdba7b040016b23edb00752, 2026-10-30. Base de feature 34d6b32; primera captura histórica bf57ebc. Alcance: backend. [Índice](../README.md) · [Constitución](../constitution.md) · [Plan](plan.md) · [Tareas](tasks.md) · [Cobertura](coverage.md).

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

SDD-01 documentó los pasos 1–5 y SDD-02 planificó pendientes sin implementarlos; ambos se conservan como historia. La autorización posterior del usuario inició BE-SPECS: implementación de 008, correcciones de 003 y cobertura/ejecución de los ocho specs. [La entrega](../be-specs-delivery.md) y [la matriz](coverage.md) registran 82 aprobadas y el alcance de auditoría. Los documentos no autorizan nuevas tareas por sí solos.

## Plantilla de spec

Contexto y objetivo → historias de usuario identificadas, con rol, objetivo y beneficio → issues propuestas vinculadas → RF numerados con aceptación EARS → requisitos no funcionales → casos límite → fuera de alcance → criterios de finalización → dudas y evidencia.

EARS: «CUANDO ocurre X, el sistema DEBE Y»; «SI ocurre un error X, el sistema DEBE Y»; «MIENTRAS se cumple X, el sistema DEBE Y». Mantener lenguaje observable y verificable. No incluir stack, módulos ni rutas en los RF; colocar referencias de archivos únicamente en Evidencia. Identificar requisitos globalmente como 004/RF-2 para no confundir RF locales.

### Historias e issues propuestas

Identificar cada historia localmente como `HU-004-01` y redactarla como «Como [rol], quiero [objetivo], para [beneficio]». Sus criterios de aceptación referencian los RF existentes de forma cualificada, por ejemplo `004/RF-2`; el texto normativo permanece en los RF.

Documentar cada propuesta de issue con un ID local como `ISSUE-004-01`, título, historia relacionada y RF de aceptación. Mantener la relación **issue propuesta → historia de usuario → RF → matriz de cobertura** y conservar los identificadores al actualizar la documentación.

Las propuestas de esta entrega son seguimiento retrospectivo de comportamiento implementado. Su estado documental se distingue del estado funcional y de la evidencia histórica BE-SPECS. La publicación en GitHub se registra únicamente cuando exista una issue real: mientras sean propuestas, conservarlas identificadas como tales, sin números ni enlaces ficticios ni nuevas tareas de reimplementación.

## Prompts reutilizables

**Inventario y constitución.** «Lee la constitución y revisa la implementación integrada de esta capacidad. Describe qué existe y qué no, con SHA y evidencias. No escribas código ni preguntes reglas que ya estén implementadas. No cambies la constitución para justificar una discrepancia».

**Spec retrospectiva.** «Redacta o actualiza la spec con la estructura acordada. Extrae reglas y errores del código, contratos y tests. Escribe QUÉ/POR QUÉ, RF EARS en español y casos límite. Separa evidencia de texto funcional. Marca lo no verificable; no inventes comportamiento ni hagas una ronda de preguntas».

**Revisión.** «Revisa la spec contra constitución, implementación y contratos. Lista numerada de ambigüedades, contradicciones, casos límite omitidos y conflictos. Solo detecta, sin proponer soluciones ni editar código».

**Plan.** «A partir de la spec y del estado real, documenta módulos, modelo de datos, algoritmos en pseudocódigo, contrato HTTP y errores, decisiones técnicas y estrategia de tests. Vincula cada parte a sus RF. Distingue razones observables de supuestas decisiones históricas».

**Tareas.** «Divide únicamente el cambio solicitado en tareas de 20–30 minutos, ordenadas por dependencia, con RF y una línea Hecho cuando verificable. Usa checkboxes y no marques nada por anticipado. No generes trabajo para volver a construir capacidades existentes».

**Una tarea.** «Implementa SOLO Tn si esa implementación está expresamente autorizada, siguiendo spec, plan y constitución. Para cambios de comportamiento escribe primero un test pertinente que falle, luego el código. Ejecuta las comprobaciones necesarias, registra su resultado real, marca Tn solo si satisface Hecho cuando y detente. No inicies la siguiente tarea».

**Auditoría.** «Recorre todos los RF. Para cada uno indica test concreto, comando, resultado y alcance parcial o ausente. Comprueba finalización y da un veredicto. Un test identificado o un resultado antiguo no equivalen a ejecución actual».

## Conciliación documental actual

README, arquitectura e integración reflejan registro público, CRUD de presupuestos/metas, historial paginado, reportes y avisos. BE-01–BE-08 siguen como evidencias históricas, no como inventario vigente. BE-SPECS cerró las brechas de validación de metas y reportes y añadió 008; consultar código, OpenAPI y resultados del SHA registrado.

## Actualización posterior

Mantener IDs y añadir RF nuevos cuando cambie el comportamiento. Actualizar juntos spec, plan afectado, tarea y matriz; registrar SHA/fecha de la nueva auditoría. Un cambio de otra capa se entrega como contrato pendiente para su propia sesión. Planificar o revisar no autoriza commit, push, merge ni despliegue.

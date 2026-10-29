# 008 — Avisos dentro de la aplicación

## Contexto y objetivo

**PLANIFICADO; NO IMPLEMENTADO.** Convertir los estados financieros disponibles en avisos consultables por su titular, para reconocer presupuestos próximos al límite o excedidos y situaciones de sus metas. Base: 59acca46ad7a0c43d5ac00bc5c548b6acc227109. Se conserva la estructura SDD existente.

## Usuarios e historias

Titular autenticado: quiero consultar los avisos de mis presupuestos y metas y saber cuántos hay, sin mezclar datos de otras personas ni recibir cifras inventadas.

## Requisitos funcionales y aceptación EARS

- **RF-1 — Consulta privada y periodo.** CUANDO el titular consulta avisos para un mes válido entre 1900-01 y 9998-12, el sistema DEBE mostrar solo avisos de sus presupuestos de ese mes y sus metas al instante actual; SI omite el mes, DEBE usar el mes local actual America/La_Paz. SI la sesión es inválida, DEBE denegar antes de validar parámetros; SI el mes es inválido, duplicado o hay parámetros extra, DEBE rechazarlo.
- **RF-2 — Presupuestos.** CUANDO el consumo exacto de un presupuesto está entre 80 % y 100 % inclusive, el sistema DEBE mostrar advertencia; CUANDO supera 100 %, DEBE mostrar exceso; SI está por debajo de 80 %, no DEBE mostrar aviso. DEBE usar el estado calculado antes del redondeo y conservar el consumo bruto del mes, incluidos movimientos vigentes futuros del mes.
- **RF-3 — Metas.** CUANDO una meta visible está completada, el sistema DEBE mostrar un aviso de cumplimiento; CUANDO está incompleta y vencida, DEBE mostrar uno de vencimiento; SI está activa, archivada o creada después del instante de consulta, no DEBE mostrar aviso. La meta completada DEBE conservar prioridad sobre vencida.
- **RF-4 — Contenido, identidad y total.** CUANDO se devuelve un aviso, el sistema DEBE identificar su tipo y recurso propio y presentar un mensaje en español con los datos exactos del indicador; DEBE devolver como máximo uno por tipo y recurso, en orden estable, y un total igual al número de elementos. Ese total no DEBE presentarse como cantidad de no leídos.
- **RF-5 — Coherencia y errores.** CUANDO se genera la lista, el sistema DEBE usar un único instante y una misma versión consistente de los datos; SI falla una fuente, DEBE fallar la consulta completa sin lista parcial ni total cero ficticio. SI ambas fuentes se consultan exitosamente y no hay condiciones notificables, DEBE devolver lista vacía y total cero.
- **RF-6 — Condiciones actuales.** CUANDO el titular vuelve a consultar, el sistema DEBE representar las condiciones actuales, sin guardar cambios por la consulta ni convertirlas en historial de eventos. Leer significa consultar el contenido; no DEBE implicar marcarlo como leído ni garantizar entrega en tiempo real.

## Requisitos no funcionales

Sesiones y propiedad existentes; respuestas privadas sin caché; importes y porcentajes exactos en BOB, zona del producto y mensajes españoles. La consulta no modifica movimientos, presupuestos, metas ni reservas. No incorpora otro stack.

## Casos límite

80 % exacto; 79.999 % mostrado como 80.00 sin aviso; 100 % exacto en advertencia; 100.001 % mostrado como 100.00 en exceso; mes sin presupuestos; meta completada con fecha pasada; objetivo hoy; archivo; retiro que cambia estado; consultas repetidas; fuente fallida; actualización concurrente.

## Fuera de alcance

Leído/no leído, historial, persistir avisos, recordatorios de proximidad, correo/SMS/push, entrega automática, tareas programadas y garantías en tiempo real. La presentación visual se entrega a la sesión de la interfaz mediante contrato.

## Criterios de finalización

RF-1 a RF-6 implementados y trazados a pruebas ejecutadas: mapeo de estados, límites exactos, HTTP/contrato, aislamiento, consultas sin escrituras, coherencia y fallos globales. La presentación y el consumo de este contrato corresponden a la sesión de la interfaz.

## Propuestas y evidencia

**PROPUESTA de alcance MVP:** avisos de condiciones actuales al consultar; presupuestos del mes seleccionado; metas completed/overdue al instante actual. Los estados y umbrales provienen del código, pero esta política de avisos no está implementada ni acredita una aprobación histórica. No se inventan cruces de umbral, rearme, antigüedad, repetición de eventos o recordatorios.

Fuentes: [estados de presupuestos](../../../src/modules/budgets/budgets.service.ts), [estados y visibilidad de metas](../../../src/modules/savings-goals/savings-goals.service.ts), [plan propuesto](plan.md), [tareas](tasks.md), [cobertura](../../sdd/coverage.md).

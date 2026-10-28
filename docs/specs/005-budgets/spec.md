# 005 — Presupuestos mensuales

## Contexto y objetivo

Permitir al titular fijar límites por categoría y mes y conocer su consumo real para identificar cercanía o superación del límite.

## Usuarios e historias

Titular autenticado: quiero crear, consultar, ajustar y eliminar mis presupuestos; quiero distinguir consumo normal, advertencia y exceso sin alterar los movimientos.

## Requisitos funcionales y aceptación EARS

- **RF-1 — Crear y listar.** CUANDO el titular crea un presupuesto para una categoría propia existente, un mes válido entre 1900-01 y 9998-12 y un límite positivo de hasta 999999999999.99 con dos decimales, el sistema DEBE persistirlo en BOB. CUANDO lista un mes, DEBE devolver solo sus presupuestos con consumo calculado, ordenados por categoría e identificador ascendentes; SI omite el mes, DEBE usar el mes local actual.
- **RF-2 — Validar identidad y unicidad.** SI la categoría es ajena/inexistente, el sistema DEBE responder no encontrado; SI ya hay presupuesto del mismo titular, categoría y mes, DEBE responder conflicto; SI campos, mes o límite son inválidos o hay campos extra, DEBE rechazar la solicitud.
- **RF-3 — Actualizar y eliminar.** CUANDO el titular actualiza un presupuesto propio, el sistema DEBE aceptar únicamente el nuevo límite válido y conservar categoría y mes; CUANDO lo elimina, DEBE quitar el presupuesto sin modificar movimientos ni categoría y responder sin contenido. SI es ajeno o inexistente, DEBE responder no encontrado.
- **RF-4 — Consumo.** CUANDO se consulta un presupuesto, el sistema DEBE usar gastos brutos vigentes de su categoría y mes, incluidos futuros del mes y excluidos anulados, sin descontar devoluciones ni arrastrar otros meses. DEBE devolver restante igual a límite menos consumo, admitiendo negativos, y progreso HALF_UP de dos decimales sin tope 100.
- **RF-5 — Estados y vacíos.** CUANDO el consumo exacto es inferior al 80 %, el sistema DEBE indicar normal; CUANDO es desde el 80 % hasta el 100 % inclusive, DEBE indicar advertencia; CUANDO supera el 100 %, DEBE indicar excedido, siempre antes de redondear el progreso. SI el mes no tiene presupuestos, DEBE devolver lista vacía; SI existe uno sin gastos, DEBE mostrar consumo/progreso cero y estado normal.

## Requisitos no funcionales

Aislamiento por sesión, persistencia exacta y lectura coherente con los gastos. Las respuestas privadas no se almacenan en caché; los errores no se convierten en cumplimiento ficticio.

## Casos límite

79.999 % mostrado como 80.00 con estado normal; 100 % exacto en advertencia; 100.001 % mostrado como 100.00 con estado excedido; límite nulo/cero; categoría de otro titular; duplicado mensual; presupuesto sin gastos; eliminar dos veces devuelve no encontrado la segunda vez.

## Fuera de alcance

Cambiar categoría/mes de un presupuesto existente, arrastre de saldos entre meses, avisos enviados y presupuestos multimoneda.

## Criterios de finalización

RF-1 a RF-5 trazados y pruebas HTTP, unicidad, bordes 80/100, consistencia y aislamiento ejecutadas satisfactoriamente.

## Dudas y evidencia

No deducir envío de notificaciones a partir del estado de advertencia. El CRUD sí está integrado aunque documentos BE-05 históricos lo excluyan.

Fuentes: [controlador](../../../src/modules/budgets/budgets.controller.ts), [servicio](../../../src/modules/budgets/budgets.service.ts), [contrato](../../openapi/budgets.v1.json) y [cobertura](../../sdd/coverage.md).

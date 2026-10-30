# 004 — Dashboard financiero

## Contexto y objetivo

Ofrecer al titular una vista coherente de su saldo disponible, actividad mensual, distribución de gastos, presupuestos y metas para interpretar sus finanzas sin mezclar propietarios ni cortes temporales.

## Usuarios e historias

Titular autenticado: quiero elegir un mes y consultar indicadores coherentes, distinguiendo actividad de ese mes de saldo y ahorros acumulados.

## Requisitos funcionales y aceptación EARS

- **RF-1 — Periodo.** CUANDO se solicita un mes válido entre 1900-01 y 9998-12, el sistema DEBE usar sus límites en America/La_Paz, inicio inclusivo y fin exclusivo; SI se omite, DEBE elegir el mes local actual. SI se envían parámetros adicionales, duplicados o un mes inválido, DEBE rechazar el periodo.
- **RF-2 — Saldo.** CUANDO el titular consulta el dashboard, el sistema DEBE calcular saldo inicial más ingresos vigentes menos gastos vigentes desde la apertura hasta el instante de consulta inclusivo y restar una sola vez las reservas de ahorro efectivas. DEBE conservar saldos negativos e incluir meses anteriores, independientemente del mes seleccionado.
- **RF-3 — Resumen mensual.** CUANDO se consulta un mes, el sistema DEBE totalizar ingresos y gastos vigentes propios en BOB dentro de ese mes, por separado, incluyendo movimientos futuros del mes y devoluciones como ingresos brutos. SI no existen movimientos, DEBE devolver 0.00 en ambos totales tras una consulta exitosa.
- **RF-4 — Distribución.** CUANDO existen gastos del mes, el sistema DEBE agruparlos por categoría propia, usar Sin categoria cuando falta, ordenar importe descendente e identificador ascendente con categoría ausente última en empate, y calcular porcentajes independientes con redondeo HALF_UP a dos decimales. SI no hay gastos, DEBE devolver lista vacía; no DEBE ajustar porcentajes para forzar suma 100.
- **RF-5 — Respuesta coherente.** CUANDO la consulta finaliza correctamente, el sistema DEBE devolver las cinco secciones disponibles con un único instante de referencia y una misma versión consistente de los datos. SI falla cualquiera de ellas, DEBE fallar la consulta completa sin indicadores parciales ni ceros/listas inventados; SI un importe excede el rango, DEBE indicar fuera de rango y no truncarlo.
- **RF-6 — Presupuestos y metas.** CUANDO se consulta el dashboard, el sistema DEBE incluir el consumo de presupuestos del mes según la spec 005 y las metas visibles al instante de consulta según la spec 006, siempre del mismo titular.

## Requisitos no funcionales

Sesión válida, aislamiento por titular, BOB, importes/porcentajes de dos decimales y precisión exacta. Las respuestas son privadas sin caché. No se promete un tiempo de respuesta nuevo.

## Casos límite

Mes vacío, año bisiesto, cambios históricos de zona horaria, movimiento exactamente en inicio/fin mensual, movimiento posterior al instante actual dentro del mes, categoría ausente, tres porcentajes de 33.33, saldo negativo, apertura futura inválida, overflow y escritura concurrente.

## Fuera de alcance

Representación gráfica, notificaciones, comparación con meses anteriores, modificación de finanzas y resultados parciales por sección.

## Criterios de finalización

RF-1 a RF-6 trazados y pruebas de periodos, cifras, aislamiento, consistencia concurrente y contrato completo ejecutadas sin fallos. Las pruebas de 005 y 006 son parte de la comprobación de RF-6.

## Dudas y evidencia

Sin decisiones nuevas para describir este comportamiento. Las mediciones históricas de volumen no certifican rendimiento actual.

Fuentes: [composición](../../../src/modules/dashboard/dashboard.service.ts), [periodos](../../../src/modules/dashboard/period.ts), [saldo](../../../src/modules/transactions/balance.service.ts), [resumen](../../../src/modules/transactions/monthly-summary.service.ts), [distribución](../../../src/modules/transactions/expense-distribution.service.ts), [OpenAPI](../../openapi/dashboard.v1.json), [005](../005-budgets/spec.md), [006](../006-savings/spec.md) y [cobertura](../../sdd/coverage.md).

## Validación BE-SPECS

Validación local independiente BE-SPECS, 2026-10-30: código/tests/OpenAPI 4bea0d915c4197346cdba7b040016b23edb00752; 82 pruebas aprobadas, 0 fallidas, 0 omitidas. Lint, tipos y build aprobados. [Entrega](../../be-specs-delivery.md) · [Matriz de 46 RF](../../sdd/coverage.md). No se acredita CI remota, merge ni despliegue.

Los resultados acreditan los escenarios trazados, sin prometer cobertura exhaustiva de todas las combinaciones ni garantías adicionales fuera de los RF.

# 007 — Reportes financieros

## Contexto y objetivo

Permitir al titular analizar un intervalo de días con ingresos, gastos, distribución y evolución de saldo sin mezclar actividad del periodo con saldo histórico acumulado.

## Usuarios e historias

Titular autenticado: quiero consultar un intervalo y conocer su resultado y mis saldos por mes, incluyendo meses sin actividad posteriores a su apertura.

## Requisitos funcionales y aceptación EARS

- **RF-1 — Intervalo.** CUANDO el titular envía inicio y fin válidos entre los años 1900 y 9998, con fin no anterior a inicio y hasta 24 meses calendario abarcados contando ambos extremos, el sistema DEBE incluir ambos días en America/La_Paz. SI falta una fecha, se repite un parámetro, hay campos desconocidos o el intervalo es inválido, DEBE rechazarlo.
- **RF-2 — Comparación.** CUANDO se consulta el intervalo, el sistema DEBE totalizar ingresos y gastos brutos vigentes propios en BOB y calcular neto igual a ingresos menos gastos; DEBE contar devoluciones como ingresos y excluir anulados. SI no hay actividad, DEBE mostrar 0.00 en esos totales.
- **RF-3 — Distribución.** CUANDO existen gastos del intervalo, el sistema DEBE agruparlos por categoría con las reglas de ausencia, orden, precisión y redondeo de 004/RF-4, aplicadas al intervalo solicitado; SI no hay gastos, DEBE devolver lista vacía.
- **RF-4 — Evolución.** CUANDO el intervalo abarca uno o más meses, el sistema DEBE devolver un saldo acumulado por cada mes abarcado en orden ascendente cuyo fin sea posterior a la apertura, incluidos meses sin actividad; DEBE omitir los meses cuyo fin sea anterior o igual a la apertura, sin fabricar saldos previos a la cuenta. El corte de cada saldo DEBE ser el menor entre inicio del mes siguiente e instante actual, conservando la inclusión del corte del cálculo de saldo; no DEBE proyectar saldos futuros ni limitar cada saldo a los días de actividad del intervalo.
- **RF-5 — Privacidad y coherencia.** CUANDO se genera el reporte, el sistema DEBE identificar al titular por sesión, usar un único instante de referencia y una versión consistente de los datos para comparación, distribución y evolución; SI la sesión es inválida, DEBE rechazar antes de validar el intervalo. SI falla un cálculo, DEBE fallar el reporte sin datos parciales.

## Requisitos no funcionales

Respuestas privadas sin caché, importes y porcentajes exactos de dos decimales, BOB y aislamiento por titular. Sin promesas nuevas de rendimiento.

## Casos límite

Inicio y fin el mismo día; rango de 24 meses frente a 25 meses calendario aunque dure menos de dos años exactos; día inexistente; límites locales del día; mes sin movimientos; rango futuro; saldo histórico con movimientos previos al inicio; instante de corte incluido en el saldo; cuenta recién creada con rango anterior a su apertura y rango que la cruza.

## Fuera de alcance

Exportación PDF/CSV, comparación automática con otro intervalo, filtros por categoría y proyección de movimientos futuros.

## Criterios de finalización

RF-1 a RF-5 trazados; tests de periodo, cifras, distribución, evolución, autenticación y aislamiento ejecutados satisfactoriamente. La consistencia transaccional debe distinguirse de cobertura concurrente específica.

## Dudas y evidencia

Código validado: 4bea0d915c4197346cdba7b040016b23edb00752, 2026-10-30. La omisión preapertura y el corte mensual inclusivo tienen regresión dedicada; se conserva la implementación existente.

La suite ejecutó una escritura concurrente real entre fuentes y fallos globales de resumen, distribución y saldo, además de periodo, cifras, aislamiento y futuro.

Fuentes: [controlador](../../../src/modules/reports/reports.controller.ts), [periodo](../../../src/modules/reports/report-period.ts), [servicio](../../../src/modules/reports/reports.service.ts), [contrato](../../openapi/reports.v1.json), [004](../004-dashboard/spec.md) y [cobertura](../../sdd/coverage.md).

[Plan](plan.md) · [Tareas y resultados](tasks.md).

## Validación BE-SPECS

Validación local independiente BE-SPECS, 2026-10-30: código/tests/OpenAPI 4bea0d915c4197346cdba7b040016b23edb00752; 82 pruebas aprobadas, 0 fallidas, 0 omitidas. Lint, tipos y build aprobados. [Entrega](../../be-specs-delivery.md) · [Matriz de 46 RF](../../sdd/coverage.md). No se acredita CI remota, merge ni despliegue.

Los resultados acreditan los escenarios trazados, sin prometer cobertura exhaustiva de todas las combinaciones ni garantías adicionales fuera de los RF.

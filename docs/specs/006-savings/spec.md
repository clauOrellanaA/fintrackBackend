# 006 — Metas y reservas de ahorro internas

## Contexto y objetivo

Mostrar en el dashboard el progreso de metas persistidas y descontar del saldo disponible fondos reservados. Esta capacidad se consulta mediante el dashboard autenticado, protegido por la sesión del titular; no dispone de operaciones públicas propias para gestionar metas o aportes.

## Usuarios e historias

Titular autenticado: quiero ver mis metas y fondos aún disponibles, sin que archivar una meta haga reaparecer dinero que sigue reservado.

## Requisitos funcionales y aceptación EARS

- **RF-1 — Visibilidad.** CUANDO se consultan metas al instante de referencia, el sistema DEBE incluir únicamente las del titular creadas hasta ese instante y todavía no archivadas en él, ordenadas por creación e identificador ascendentes; SI no existen, DEBE devolver lista vacía.
- **RF-2 — Importes y progreso.** CUANDO se presenta una meta, el sistema DEBE calcular acumulado como aportes menos retiros efectivos hasta el instante de referencia, restante como máximo entre objetivo menos acumulado y cero, y progreso HALF_UP a dos decimales sin limitarlo a 100; el objetivo DEBE ser positivo y el acumulado no negativo.
- **RF-3 — Estado.** CUANDO el acumulado alcanza o supera el objetivo, el sistema DEBE indicar completada con prioridad sobre vencimiento; CUANDO está incompleta y su fecha objetivo es anterior al día local America/La_Paz, DEBE indicar vencida; EN los demás casos DEBE indicar activa, incluida fecha objetivo hoy o ausente.
- **RF-4 — Reservas.** CUANDO se calcula saldo disponible, el sistema DEBE descontar una sola vez aportes menos retiros efectivos de todas las metas del titular, incluidas archivadas, sin cambiar sus ingresos ni gastos; los retiros DEBEN liberar esa reserva y los movimientos de ahorro futuros no DEBEN afectarla todavía.
- **RF-5 — Integridad.** SI una entrada de ahorro hace negativo algún saldo acumulado por instante, tiene importe/moneda/propietario/fecha incompatibles o intenta alterar una entrada previa, el sistema DEBE rechazarla; CUANDO concurren retiros, el sistema DEBE impedir sobregiro, pudiendo rechazar un escritor con una vista obsoleta. No se exige reintento automático.

## Requisitos no funcionales

Datos persistentes exactos en BOB, aislamiento por titular y coherencia con el dashboard. Los fallos de ahorro invalidan la respuesta global; no se fabrican reservas cero.

## Casos límite

Meta sin fecha, creada exactamente al corte, archivada exactamente al corte, acumulado superior al objetivo, meta vencida ya completada, retiro efectivo después de archivado, entrada futura, varios movimientos en un instante y retiros concurrentes.

## Fuera de alcance

Crear/editar/archivar metas o registrar aportes/retiros mediante endpoints públicos, recordatorios, transferencias bancarias y garantías de reintento automático.

## Criterios de finalización

RF-1 a RF-5 trazados y pruebas de estados, reservas, restricciones, concurrencia y aislamiento ejecutadas con PostgreSQL aislado. La presencia de datos de ejemplo no demuestra gestión pública de metas.

## Dudas y evidencia

[NO VERIFICADO] Garantías concurrentes de cambios de fecha de apertura frente a entradas de ahorro más allá de los escenarios de tests existentes; no se afirman como contrato adicional.

Fuentes: [metas](../../../src/modules/savings-goals/savings-goals.service.ts), [reservas](../../../src/modules/savings-goals/persisted-savings-reservation.reader.ts), [migración](../../../src/database/migrations/1792540800000-SavingsGoals.ts), [salida del dashboard](../../openapi/dashboard.v1.json) y [cobertura](../../sdd/coverage.md).

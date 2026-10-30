# 006 — Gestión, indicadores y reservas de ahorro

## Contexto y objetivo

Permitir al titular crear y gestionar metas, registrar aportes/retiros y consultar su progreso sin confundir reservas con ingresos o gastos. Código validado: 4bea0d915c4197346cdba7b040016b23edb00752, 2026-10-30. Incluye la API autenticada de gestión y sus pruebas HTTP.

## Usuarios e historias

Titular autenticado: quiero fijar un objetivo y fecha, registrar avances, revisar metas activas o archivadas y conocer los fondos aún disponibles.

## Requisitos funcionales y aceptación EARS

- **RF-1 — Visibilidad del panel.** CUANDO se consultan metas en el panel al instante de referencia, el sistema DEBE incluir solo las propias creadas hasta ese instante y no archivadas en él, ordenadas por creación e identificador ascendentes; SI no existen, DEBE devolver lista vacía.
- **RF-2 — Importes y progreso.** CUANDO se presenta una meta, el sistema DEBE calcular acumulado como aportes menos retiros efectivos al corte, restante como máximo entre objetivo menos acumulado y cero, y progreso HALF_UP a dos decimales sin tope 100; el objetivo DEBE ser positivo y el acumulado no negativo.
- **RF-3 — Estado.** CUANDO el acumulado alcanza o supera el objetivo, el sistema DEBE indicar completada antes que vencida; CUANDO está incompleta y su fecha objetivo es anterior al día local America/La_Paz, DEBE indicar vencida; EN los demás casos DEBE indicar activa, incluida fecha objetivo hoy o ausente.
- **RF-4 — Reservas.** CUANDO se calcula saldo disponible, el sistema DEBE descontar una sola vez aportes menos retiros efectivos de todas las metas propias, incluidas archivadas, sin cambiar ingresos ni gastos; los retiros DEBEN liberar esa reserva y las entradas futuras no DEBEN afectarla todavía.
- **RF-5 — Integridad.** SI una entrada hace negativo algún saldo acumulado por instante, contiene importe/moneda/propietario/fecha incompatibles o altera una entrada previa, el sistema DEBE rechazarla; CUANDO concurren retiros, DEBE impedir sobregiro, pudiendo rechazar un escritor con vista obsoleta. No se exige reintento automático.
- **RF-6 — Crear objetivo.** CUANDO el titular proporciona nombre recortado de 1–100 caracteres, objetivo positivo de dos decimales hasta 999999999999.99 y fecha objetivo opcional válida entre 1900 y 9998, el sistema DEBE crear una meta propia en BOB con avance cero; SI omite la fecha o envía ausencia explícita, DEBE conservarla sin fecha; SI hay campos extra o valores inválidos, DEBE rechazar la solicitud.
- **RF-7 — Consultar gestión.** CUANDO el titular consulta sus metas para gestionarlas, el sistema DEBE devolver también las archivadas, señalar su archivo e incluir creación, moneda e indicadores actuales, ordenadas por creación e identificador ascendentes; SI no hay metas, DEBE devolver lista vacía.
- **RF-8 — Editar y archivar.** CUANDO el titular envía al menos un cambio válido de nombre, objetivo, fecha o archivo, el sistema DEBE actualizar su meta conservando los demás campos y permitir archivar o desarchivar; SI es ajena/inexistente, DEBE responder no encontrado; SI el cuerpo es vacío, desconocido o inválido, DEBE rechazarlo. Archivar no DEBE eliminar historial ni liberar reservas.
- **RF-9 — Registrar avance.** CUANDO el titular registra un aporte o retiro como importe positivo de dos decimales hasta 999999999999.99, el sistema DEBE anexarlo a su meta y devolver entrada e indicadores actualizados; SI omite instante, DEBE usar el actual, y SI lo indica, DEBE validar fecha con zona y preservar su efecto temporal. DEBE admitir entradas en metas archivadas, conservar integridad de RF-5 y rechazar metas ajenas/inexistentes, campos extra o valores inválidos.

## Requisitos no funcionales

Sesión válida, datos exactos en BOB, aislamiento por titular y persistencia mediante las garantías existentes. Respuestas privadas sin caché. Los fallos de ahorro invalidan la composición financiera; no se fabrican reservas cero.

## Casos límite

Meta sin fecha o con fecha ya pasada; fecha objetivo hoy; creación/archivo exactamente al corte; objetivo reducido por debajo del acumulado; lista de gestión con archivadas frente a panel sin ellas; aporte futuro; retiro de meta archivada; cuerpo vacío; varios movimientos al mismo instante; retiros concurrentes.

## Fuera de alcance

Borrado destructivo de metas o entradas, edición del ledger, transferencias bancarias, reintento automático y avisos dentro de esta spec; estos últimos se describen en 008.

## Criterios de finalización

RF-1 a RF-9 trazados. Para declarar cumplimiento deben ejecutarse pruebas HTTP de gestión, contrato, ledger, reservas, concurrencia y aislamiento con PostgreSQL aislado. La matriz diferencia las pruebas HTTP de gestión de las internas de ledger/reservas.

## Dudas y evidencia

Las cuatro operaciones de gestión y su OpenAPI tienen pruebas ejecutadas. Límite conservado: no se acreditan garantías concurrentes adicionales al cambiar apertura frente a entradas. 40001 conserva su traducción actual a 500 INTERNAL_ERROR, sin reintento automático.

Fuentes: [controlador](../../../src/modules/savings-goals/savings-goals.controller.ts), [servicio](../../../src/modules/savings-goals/savings-goals.service.ts), [reservas](../../../src/modules/savings-goals/persisted-savings-reservation.reader.ts), [migración](../../../src/database/migrations/1792540800000-SavingsGoals.ts), [OpenAPI](../../openapi/savings-goals.v1.json), [cobertura](../../sdd/coverage.md) y [avisos internos](../008-in-app-notifications/spec.md).

[Plan](plan.md) · [Tareas y resultados](tasks.md).

## Validación BE-SPECS

Validación local independiente BE-SPECS, 2026-10-30: código/tests/OpenAPI 4bea0d915c4197346cdba7b040016b23edb00752; 82 pruebas aprobadas, 0 fallidas, 0 omitidas. Lint, tipos y build aprobados. [Entrega](../../be-specs-delivery.md) · [Matriz de 46 RF](../../sdd/coverage.md). No se acredita CI remota, merge ni despliegue.

Los resultados acreditan los escenarios trazados, sin prometer cobertura exhaustiva de todas las combinaciones ni garantías adicionales fuera de los RF.

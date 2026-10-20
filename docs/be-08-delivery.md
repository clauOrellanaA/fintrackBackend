# BE-08: estadísticas e informes

Base asignada: `origin/dev` en `b706621c4620223f24ac8b11e1e9777d2e48eab5`. Rama `feature/be-08-reports`; worktree `C:/fintrack/worktrees/backend/be-08-reports`. El responsable único de Git es el coordinador. Esta entrega no hace merge, despliegue, ni modifica `.env`.

## API publicada

`GET /api/v1/reports?from=YYYY-MM-DD&to=YYYY-MM-DD` requiere una sesión bearer y responde `Cache-Control: no-store`. La identidad procede exclusivamente de la sesión: no acepta `userId` ni expone datos de otra persona.

`from` y `to` son obligatorios, aparecen una sola vez y expresan fechas locales inclusivas en `America/La_Paz`. El servicio las consulta como el intervalo semiabierto `[inicio de from, inicio del día posterior a to)`. Se admiten fechas de 1900 a 9998, `from` no puede ser posterior a `to` y el intervalo no puede abarcar más de 24 meses calendario. Parámetros desconocidos, repetidos, `userId`, fechas imposibles y cualquier incumplimiento de esas reglas devuelven `400 INVALID_REPORT_PERIOD`.

La respuesta contiene exactamente `period`, `currency`, `asOf`, `comparison`, `expenseDistribution` y `balanceEvolution`. El contrato formal y ejemplos HTTP están en [reports.v1.json](openapi/reports.v1.json). Todos los importes son cadenas BOB de dos decimales; no se exponen números de punto flotante.

- `comparison` informa ingresos, gastos y neto (`income - expense`) del rango. Solo incluye movimientos propios `posted`; una devolución es ingreso y un movimiento `void` no participa.
- `expenseDistribution` agrupa gastos propios `posted` por categoría. Una categoría nula se publica como `categoryId: null` y `categoryName: "Sin categoria"`. Los porcentajes se redondean de forma independiente con HALF_UP y no se ajustan para que sumen exactamente 100.00.
- `balanceEvolution` contiene un punto por cada mes calendario intersectado por el rango, ordenado ascendentemente. El disponible combina apertura, movimientos `posted` y reservas persistidas de metas de ahorro. Cada punto se corta en `min(fin local del mes, asOf)`. Los meses futuros se devuelven, pero no proyectan movimientos ni reservas posteriores a `asOf`.

Errores posibles: `401 UNAUTHENTICATED`, `400 INVALID_REPORT_PERIOD`, `422 DATA_OUT_OF_RANGE`, `500 INTERNAL_ERROR` o `DATA_INTEGRITY_ERROR`, y `503 DATA_UNAVAILABLE`. Los errores no contienen SQL, secretos ni datos parciales; un fallo de una sección aborta el informe completo.

## Persistencia y operación

BE-08 no agrega migraciones ni índices. Usa las tablas, restricciones e índices financieros existentes; no hay paso de actualización de base de datos específico para este endpoint. La configuración ordinaria sigue siendo la del backend existente, incluido PostgreSQL y la zona de producto `America/La_Paz`; no se requieren variables ni secretos nuevos.

## Contraste y validación

Se contrastó estáticamente este contrato con `src/modules/reports`: el controlador protegido expone `GET /reports` con `no-store`; el resolvedor aplica las fechas locales, ambos parámetros, rechazo de parámetros ambiguos/desconocidos y el límite por meses calendario; el servicio entrega los seis campos contractuales dentro de una transacción `REPEATABLE READ`. La composición usa resumen, distribución y saldo existentes, por lo que conserva filtros de propietario, BOB, `posted`, devoluciones como ingreso, exclusión de `void` y reservas persistidas.

También se inspeccionó `tests/reports-http.test.cjs`: cubre bearer y `no-store`, consultas inválidas —incluido el intervalo de 25 meses calendario `2026-01-31` a `2028-01-30`—, aislamiento por usuario, precisión de importes, devolución, `Sin categoria`, reservas y meses futuros sin proyección. Esta documentación no ejecutó esa suite ni declara su resultado; la evidencia de ejecución corresponde al responsable de pruebas.

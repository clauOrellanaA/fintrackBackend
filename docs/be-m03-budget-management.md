# Módulo 3 — Gestión de presupuestos (backend)

## Alcance

La tabla `budgets`, su migración, el cálculo exacto de consumo mensual y la sección de indicadores del panel ya existían. Esta entrega añade la API autenticada para consultar, crear, actualizar el límite y eliminar presupuestos de la persona autenticada. No agrega migraciones, moneda nueva, rollover ni notificaciones externas.

## API

Contrato versionado: [`openapi/budgets.v1.json`](./openapi/budgets.v1.json). Todas las rutas requieren la sesión bearer existente; el propietario siempre se resuelve de la sesión.

| Método y ruta | Comportamiento |
| --- | --- |
| `GET /api/v1/budgets?month=YYYY-MM` | Lista los presupuestos propios del mes y su consumo/estado; por defecto usa el mes actual de `America/La_Paz`. Sin resultados devuelve `[]`. |
| `POST /api/v1/budgets` | Crea con `{ categoryId, month, limit }`; responde `201` con el presupuesto y su consumo actual. |
| `PATCH /api/v1/budgets/:id` | Cambia el límite con `{ limit }`; responde `200` con valores recalculados. |
| `DELETE /api/v1/budgets/:id` | Elimina el límite, no los movimientos; responde `204`. |

Los importes son cadenas decimales positivas con dos decimales, moneda BOB, máximo `999999999999.99`. El mes debe estar entre `1900-01` y `9998-12`. La restricción única existente por usuario/categoría/mes devuelve `409 CONFLICT`; las categorías inexistentes o ajenas se tratan como `404 NOT_FOUND`. Las lecturas no guardan caché.

El consumo y estados provienen del `ExpenseDistributionService` existente: gastos `posted` dentro del mes seleccionado, en el mismo snapshot `REPEATABLE READ` al calcular el dashboard. Se conserva la clasificación exacta existente: `normal` debajo del 80 %, `warning` entre 80 % y 100 % inclusive, y `exceeded` sobre 100 %.

## Validación

La suite de integración HTTP/PostgreSQL cubre sesión, validación de periodo e importe, aislamiento, categoría ajena, duplicados, CRUD, contrato OpenAPI y filtros mensuales. Registrar aquí los comandos y resultados reales antes de publicar.

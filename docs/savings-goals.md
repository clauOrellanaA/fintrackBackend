# Metas de ahorro

El módulo de metas de ahorro permite separar objetivos de dinero sin alterar los movimientos de ingresos y gastos. Cada meta tiene un ledger de aportes y retiros; el acumulado se calcula como `aportes - retiros` en BOB.

La especificación HTTP completa está en [openapi/savings-goals.v1.json](openapi/savings-goals.v1.json).

## Endpoints

Todas las rutas requieren `Authorization: Bearer <session-token>` y devuelven `Cache-Control: no-store`.

- `GET /api/v1/savings-goals`: devuelve las metas del usuario, incluidas las archivadas, ordenadas por creación.
- `POST /api/v1/savings-goals`: crea una meta con `{ "name": "Viaje", "target": "3000.00", "targetDate": "2027-06-30" }`. `targetDate` es opcional y puede ser `null`.
- `PATCH /api/v1/savings-goals/:id`: actualiza `name`, `target`, `targetDate` o `archived`. El cuerpo debe contener al menos un campo.
- `POST /api/v1/savings-goals/:id/entries`: registra `{ "type": "contribution", "amount": "250.00" }` o `withdrawal`. `occurredAt` es opcional y acepta ISO 8601.

Las respuestas de meta incluyen `id`, `name`, `target`, `saved`, `remaining`, `progress`, `state`, `targetDate`, `archived`, `createdAt` y `currency`. Los importes son cadenas con dos decimales. `state` puede ser `active`, `completed` u `overdue`; una meta completada tiene prioridad sobre una vencida.

## Reglas de negocio

- El nombre tiene entre 1 y 100 caracteres y el objetivo debe ser positivo.
- El ledger es append-only: no se editan ni borran entradas. Un retiro no puede dejar el acumulado por debajo de cero.
- Las entradas deben ocurrir después de la creación de la meta y de la apertura de la cuenta.
- Archivar no elimina datos ni libera la reserva: la meta desaparece de los indicadores visibles, pero sus fondos siguen reservados.
- No hay `DELETE`; archivar y desarchivar son operaciones explícitas mediante `archived`.
- Todos los cálculos se realizan dentro de una transacción `REPEATABLE READ` y se filtran por el propietario y la moneda BOB.

## Ejemplo de flujo

```http
POST /api/v1/savings-goals
Authorization: Bearer <token>
Content-Type: application/json

{"name":"Fondo de emergencia","target":"5000.00","targetDate":"2027-12-31"}
```

```http
POST /api/v1/savings-goals/<id>/entries
Authorization: Bearer <token>
Content-Type: application/json

{"type":"contribution","amount":"500.00"}
```

La respuesta de una entrada devuelve tanto el registro creado como el estado actualizado de la meta.

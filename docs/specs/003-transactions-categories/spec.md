# 003 — Transacciones y categorías

## Contexto y objetivo

Registrar ingresos y gastos y mantener un historial propio clasificable, consultable y corregible sin perder movimientos anulados.

## Historias de usuario

| ID | Historia de usuario | Criterios de aceptación |
| --- | --- | --- |
| `HU-003-01` | Como titular autenticado, quiero registrar ingresos y gastos con su fecha y clasificación opcional para mantener mi historial financiero. | `003/RF-1` |
| `HU-003-02` | Como titular autenticado, quiero consultar y filtrar mi historial y abrir el detalle de un movimiento para encontrar y revisar mis operaciones. | `003/RF-2`, `003/RF-3` (detalle) |
| `HU-003-03` | Como titular autenticado, quiero corregir movimientos vigentes o anular errores conservando su registro para mantener un historial fiable. | `003/RF-3`, `003/RF-4` |
| `HU-003-04` | Como titular autenticado, quiero administrar mis categorías y eliminar las que no tienen presupuestos asociados para organizar mis movimientos sin perderlos. | `003/RF-5`, `003/RF-6` |

## Issues propuestas

Propuestas documentales de seguimiento retrospectivo, sin creación en GitHub. El comportamiento descrito está implementado; su validación histórica BE-SPECS se conserva en esta spec y en la [matriz de cobertura](../../sdd/coverage.md). El estado de propuesta corresponde al seguimiento documental y no representa trabajo de implementación pendiente.

Los criterios de aceptación de cada historia y propuesta son los RF referenciados, cuyo texto normativo se conserva en la sección siguiente.

| ID local | Título propuesto | Historia relacionada | Criterios de aceptación |
| --- | --- | --- | --- |
| `ISSUE-003-01` | Registro de movimientos | `HU-003-01` | `003/RF-1` |
| `ISSUE-003-02` | Consulta y búsqueda del historial | `HU-003-02` | `003/RF-2`, `003/RF-3` (detalle) |
| `ISSUE-003-03` | Corrección y anulación de movimientos | `HU-003-03` | `003/RF-3`, `003/RF-4` |
| `ISSUE-003-04` | Gestión de categorías | `HU-003-04` | `003/RF-5`, `003/RF-6` |

## Requisitos funcionales y aceptación EARS

- **RF-1 — Crear movimiento.** CUANDO el titular registra un ingreso o gasto válido, el sistema DEBE guardarlo como vigente en BOB, con importe positivo de dos decimales hasta 999999999999.99, instante válido con zona, categoría propia opcional y descripción opcional recortada de hasta 500 caracteres. SI hay campos desconocidos, formato inválido o categoría ajena/inexistente, DEBE rechazarlo; SI el importe supera el máximo, DEBE indicar fuera de rango.
- **RF-2 — Consultar historial.** CUANDO el titular consulta movimientos, el sistema DEBE filtrar solo los propios por inicio inclusivo, fin exclusivo, tipo, estado o texto en descripción/nombre de categoría, y devolver páginas ordenadas por fecha descendente y luego identificador descendente. Por defecto DEBE mostrar vigentes, página 1 y tamaño 20; DEBE aceptar tamaños 1–100 y estados vigente, anulado o todos. SI un filtro es repetido, desconocido, inválido o el inicio no precede al fin, DEBE rechazarlo.
- **RF-3 — Consultar y editar.** CUANDO el titular consulta un movimiento propio, el sistema DEBE devolver su detalle; CUANDO edita al menos un campo permitido de uno vigente, DEBE aplicar las validaciones de creación y conservar los demás. SI no existe o pertenece a otro titular, DEBE responder no encontrado; SI está anulado, DEBE rechazar la edición como conflicto.
- **RF-4 — Anular.** CUANDO el titular anula un movimiento propio, el sistema DEBE conservarlo con estado anulado y responder sin contenido; SI ya estaba anulado, DEBE responder sin contenido nuevamente; SI no es propio o no existe, DEBE responder no encontrado.
- **RF-5 — Categorías.** CUANDO el titular lista, crea o renombra categorías, el sistema DEBE limitar la operación a las propias; CUANDO crea o renombra una categoría, DEBE exigir nombre recortado de 1–100 caracteres; CUANDO lista categorías, DEBE ordenarlas por nombre y luego identificador ascendentes. SI el nombre exacto ya existe para ese titular, DEBE rechazar el duplicado como conflicto.
- **RF-6 — Eliminar categoría.** CUANDO el titular elimina una categoría propia sin presupuestos asociados, el sistema DEBE quitar su asociación de los movimientos conservándolos y eliminar la categoría; SI hay un presupuesto asociado, DEBE rechazarlo como conflicto; SI es ajena o inexistente, DEBE responder no encontrado.

## Requisitos no funcionales

Aislamiento por sesión, persistencia entre reinicios, importes exactos y respuestas privadas sin caché. La búsqueda de texto no distingue mayúsculas y se interpreta como texto literal.

## Casos límite

Historial vacío y páginas fuera del total; mismo instante en varios movimientos; sin categoría; descripción vacía; ingreso/gasto futuro; categoría con mismo nombre en otro titular; eliminar una categoría usada en movimientos frente a una usada en presupuestos; anulación repetida.

## Fuera de alcance

Bancos, monedas adicionales, movimientos recurrentes, importación/exportación y creación pública de vínculos de devolución. Los datos persistidos pueden contener devoluciones, pero no se expone su vinculación como campo de escritura.

## Criterios de finalización

Todos los RF trazados y pruebas de contratos, aislamiento, filtros y anulaciones ejecutadas satisfactoriamente. Registrar cualquier borde sin prueba dedicada; no declarar cumplimiento únicamente por existir endpoints.

## Dudas y evidencia

Se ejecutaron pruebas de empates/paginación, filtros repetidos, búsqueda literal, edición parcial, anulación idempotente y límites. Las regresiones HTTP verifican type vacío y categoryId vacío como 400 antes de persistir. No se afirma cobertura de cada combinación posible.

Fuentes: [controlador de movimientos](../../../src/modules/transactions/transactions.controller.ts), [categorías](../../../src/modules/transactions/categories.controller.ts), [servicios](../../../src/modules/transactions/transactions.service.ts), [contrato](../../openapi/transactions.v1.json) y [cobertura](../../sdd/coverage.md).

## Validación BE-SPECS

Validación local independiente BE-SPECS, 2026-10-30: código/tests/OpenAPI 4bea0d915c4197346cdba7b040016b23edb00752; 82 pruebas aprobadas, 0 fallidas, 0 omitidas. Lint, tipos y build aprobados. [Entrega](../../be-specs-delivery.md) · [Matriz de 46 RF](../../sdd/coverage.md). No se acredita CI remota, merge ni despliegue.

Los resultados acreditan los escenarios trazados, sin prometer cobertura exhaustiva de todas las combinaciones ni garantías adicionales fuera de los RF.

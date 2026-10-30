# 002 — Perfil propio

## Contexto y objetivo

Permitir al titular consultar y corregir su identidad visible y el punto de partida de sus finanzas sin acceder a cuentas ajenas.

## Historias de usuario

| ID | Historia de usuario | Criterios de aceptación |
| --- | --- | --- |
| `HU-002-01` | Como titular autenticado, quiero consultar mi perfil para conocer mi identidad y el punto de partida de mis finanzas. | `002/RF-1` |
| `HU-002-02` | Como titular autenticado, quiero modificar mi nombre o correo conservando los demás datos para mantener actualizada mi identidad. | `002/RF-2`, `002/RF-4` (conflicto de correo) |
| `HU-002-03` | Como titular autenticado, quiero corregir mi saldo y fecha iniciales para que mis indicadores partan de datos exactos y compatibles con mi historial. | `002/RF-2`, `002/RF-3`, `002/RF-4` |

## Issues propuestas

Propuestas documentales de seguimiento retrospectivo, sin creación en GitHub. El comportamiento descrito está implementado; su validación histórica BE-SPECS se conserva en esta spec y en la [matriz de cobertura](../../sdd/coverage.md). El estado de propuesta corresponde al seguimiento documental y no representa trabajo de implementación pendiente.

Los criterios de aceptación de cada historia y propuesta son los RF referenciados, cuyo texto normativo se conserva en la sección siguiente.

| ID local | Título propuesto | Historia relacionada | Criterios de aceptación |
| --- | --- | --- | --- |
| `ISSUE-002-01` | Consulta del perfil propio | `HU-002-01` | `002/RF-1` |
| `ISSUE-002-02` | Actualización de identidad | `HU-002-02` | `002/RF-2`, `002/RF-4` (conflicto de correo) |
| `ISSUE-002-03` | Corrección del punto de partida financiero | `HU-002-03` | `002/RF-2`, `002/RF-3`, `002/RF-4` |

## Requisitos funcionales y aceptación EARS

- **RF-1 — Consulta propia.** CUANDO el titular consulta su perfil con sesión válida, el sistema DEBE devolver correo, nombre visible, saldo inicial, fecha inicial local y moneda BOB de esa cuenta, sin contraseña ni información de otro titular.
- **RF-2 — Edición parcial.** CUANDO el titular modifica al menos uno de nombre, correo, saldo inicial o fecha inicial, el sistema DEBE conservar los demás campos y devolver el perfil actualizado; SI el cuerpo está vacío, contiene otros campos o valores inválidos, DEBE rechazarlo. Nombre: recortado, 1–80 caracteres; correo: recortado, minúsculas, formato válido y hasta 254 caracteres.
- **RF-3 — Saldo inicial.** CUANDO se modifica el saldo inicial mediante un importe con signo negativo opcional, hasta doce dígitos enteros y exactamente dos decimales, el sistema DEBE conservar su valor exacto en BOB y normalizar -0.00 a 0.00; SI incumple el formato, DEBE rechazarlo.
- **RF-4 — Fecha y conflictos.** CUANDO el titular cambia su fecha inicial, el sistema DEBE aceptar únicamente un día válido no futuro en America/La_Paz; SI resulta posterior a movimientos o metas ya existentes, DEBE rechazarla como conflicto. SI el correo pertenece a otra cuenta, DEBE rechazar su reutilización.

## Requisitos no funcionales

El propietario se obtiene de la sesión. Cambios persistentes; respuestas privadas sin caché. El saldo debe conservar dos decimales sin redondeo implícito. Moneda no editable.

## Casos límite

Perfil histórico con nombre nulo; saldo inicial negativo o cero negativo; fecha imposible o futura; fecha posterior a datos históricos; correo repetido; intento de editar la moneda.

## Fuera de alcance

Administrar perfiles ajenos, cambiar la moneda, avatar, eliminar la cuenta y recuperar contraseñas.

## Criterios de finalización

RF-1 a RF-4 trazados; ejecución satisfactoria de consulta/edición, aislamiento, formatos y conflictos antes de declarar cumplimiento. La inspección documental no sustituye esa ejecución.

## Dudas y evidencia

Core incluye pruebas HTTP de importes negativos, -0.00, extremos, formatos inválidos, preservación parcial y conflicto con metas. No se afirma cobertura exhaustiva de cada combinación.

Fuentes: [controlador](../../../src/modules/users/users.controller.ts), [servicio](../../../src/modules/users/users.service.ts), [entidad](../../../src/modules/users/entities/user.entity.ts), [contrato](../../openapi/users.v1.json) y [cobertura](../../sdd/coverage.md).

## Validación BE-SPECS

Validación local independiente BE-SPECS, 2026-10-30: código/tests/OpenAPI 4bea0d915c4197346cdba7b040016b23edb00752; 82 pruebas aprobadas, 0 fallidas, 0 omitidas. Lint, tipos y build aprobados. [Entrega](../../be-specs-delivery.md) · [Matriz de 46 RF](../../sdd/coverage.md). No se acredita CI remota, merge ni despliegue.

Los resultados acreditan los escenarios trazados, sin prometer cobertura exhaustiva de todas las combinaciones ni garantías adicionales fuera de los RF.

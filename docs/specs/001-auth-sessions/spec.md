# 001 — Registro, acceso y sesiones

## Contexto y objetivo

Permitir que una persona cree una cuenta y acceda de forma privada a sus finanzas, con cierre de sesión y cambio de contraseña. Especificación retrospectiva de la línea base indicada en el [flujo SDD](../../sdd/README.md).

## Historias de usuario

| ID | Historia de usuario | Criterios de aceptación |
| --- | --- | --- |
| `HU-001-01` | Como persona sin cuenta, quiero registrarme y comenzar con mis finanzas vacías para disponer de un espacio financiero propio. | `001/RF-1` |
| `HU-001-02` | Como titular de una cuenta, quiero iniciar sesión y acceder privadamente a mis finanzas para consultar solamente mis datos mientras mi sesión sea válida. | `001/RF-2`, `001/RF-3` |
| `HU-001-03` | Como titular autenticado, quiero cerrar la sesión que estoy utilizando para finalizar su acceso sin revocar mis otras sesiones. | `001/RF-4` |
| `HU-001-04` | Como titular autenticado, quiero cambiar mi contraseña proporcionando la actual para renovar mi credencial y revocar las sesiones anteriores. | `001/RF-5` |

## Issues propuestas

Propuestas documentales de seguimiento retrospectivo, sin creación en GitHub. El comportamiento descrito está implementado; su validación histórica BE-SPECS se conserva en esta spec y en la [matriz de cobertura](../../sdd/coverage.md). El estado de propuesta corresponde al seguimiento documental y no representa trabajo de implementación pendiente.

Los criterios de aceptación de cada historia y propuesta son los RF referenciados, cuyo texto normativo se conserva en la sección siguiente.

| ID local | Título propuesto | Historia relacionada | Criterios de aceptación |
| --- | --- | --- | --- |
| `ISSUE-001-01` | Registro de cuenta | `HU-001-01` | `001/RF-1` |
| `ISSUE-001-02` | Inicio de sesión y acceso privado | `HU-001-02` | `001/RF-2`, `001/RF-3` |
| `ISSUE-001-03` | Cierre de sesión | `HU-001-03` | `001/RF-4` |
| `ISSUE-001-04` | Cambio de contraseña | `HU-001-04` | `001/RF-5` |

## Requisitos funcionales y aceptación EARS

- **RF-1 — Registro.** CUANDO una persona envía correo válido de hasta 254 caracteres, nombre no vacío de hasta 80 caracteres y contraseña de 12 a 1024 caracteres, el sistema DEBE crear su cuenta, normalizar correo a minúsculas y recortar correo/nombre, iniciar saldo en 0.00 BOB en el día local actual y abrir una sesión. SI el correo ya existe, DEBE rechazar el registro como conflicto; SI hay campos extra o datos inválidos, DEBE rechazar la solicitud.
- **RF-2 — Inicio de sesión.** CUANDO se reciben únicamente correo válido y contraseña de 1 a 1024 caracteres coincidentes con una cuenta, el sistema DEBE abrir una sesión; SI la cuenta no existe o la contraseña no coincide, DEBE emitir el mismo error de credenciales inválidas.
- **RF-3 — Acceso privado.** MIENTRAS una sesión no esté revocada ni haya alcanzado su vencimiento de ocho horas, el sistema DEBE identificar al titular a partir de su credencial; SI falta o es inválida, vencida o revocada, DEBE denegar el acceso antes de validar los parámetros de un recurso protegido.
- **RF-4 — Cierre.** CUANDO el titular cierra una sesión válida, el sistema DEBE revocar esa sesión y responder sin contenido; las demás sesiones no son el objetivo de esa operación.
- **RF-5 — Cambio de contraseña.** CUANDO el titular proporciona su contraseña actual correcta y una nueva de 12 a 1024 caracteres, el sistema DEBE actualizarla, revocar todas sus sesiones y responder sin contenido; SI la actual no coincide, DEBE rechazar el cambio sin sustituirla.

## Requisitos no funcionales

No exponer contraseñas ni credenciales almacenadas. Las respuestas de autenticación y los errores no deben almacenarse en caché. Mensajes propios en español; mantener identificadores del contrato. Las cuentas y sesiones deben conservarse entre reinicios.

## Casos límite

Correo duplicado después de normalizar; campos extra; nombre solo con espacios; sesión que vence exactamente en el instante de consulta; varias sesiones revocadas por cambio de contraseña; login usa correo en minúsculas pero no recorta sus espacios, a diferencia del registro.

## Fuera de alcance

Recuperación de contraseña, verificación de correo, MFA, proveedores externos y eliminación de cuenta.

## Criterios de finalización

RF-1 a RF-5 vinculados a pruebas identificadas; para declarar cumplimiento deben ejecutarse satisfactoriamente en una base aislada, incluidos rechazo de acceso y revocación. La auditoría BE-SPECS ejecutó esos escenarios; véase la evidencia actual.

## Dudas y evidencia

No se requiere una decisión nueva para documentar los RF anteriores. Recuperación y MFA no se deducen como compromisos futuros.

Fuentes: [controlador](../../../src/modules/auth/auth.controller.ts), [servicio](../../../src/modules/auth/auth.service.ts), [guard](../../../src/modules/auth/session.guard.ts), [contrato](../../openapi/users.v1.json) y [matriz de pruebas](../../sdd/coverage.md). El inventario vigente del README refleja el registro público implementado.

## Validación BE-SPECS

Validación local independiente BE-SPECS, 2026-10-30: código/tests/OpenAPI 4bea0d915c4197346cdba7b040016b23edb00752; 82 pruebas aprobadas, 0 fallidas, 0 omitidas. Lint, tipos y build aprobados. [Entrega](../../be-specs-delivery.md) · [Matriz de 46 RF](../../sdd/coverage.md). No se acredita CI remota, merge ni despliegue.

Los resultados acreditan los escenarios trazados, sin prometer cobertura exhaustiva de todas las combinaciones ni garantías adicionales fuera de los RF.

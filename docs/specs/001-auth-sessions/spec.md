# 001 — Registro, acceso y sesiones

## Contexto y objetivo

Permitir que una persona cree una cuenta y acceda de forma privada a sus finanzas, con cierre de sesión y cambio de contraseña. Especificación retrospectiva de la línea base indicada en el [flujo SDD](../../sdd/README.md).

## Usuarios e historias

Persona sin cuenta: quiero registrarme y empezar con finanzas vacías. Titular de cuenta: quiero iniciar/cerrar sesión y cambiar mi contraseña para controlar el acceso.

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

RF-1 a RF-5 vinculados a pruebas identificadas; para declarar cumplimiento deben ejecutarse satisfactoriamente en una base aislada, incluidos rechazo de acceso y revocación. Esta entrega no ejecuta esas pruebas.

## Dudas y evidencia

No se requiere una decisión nueva para documentar los RF anteriores. Recuperación y MFA no se deducen como compromisos futuros.

Fuentes: [controlador](../../../src/modules/auth/auth.controller.ts), [servicio](../../../src/modules/auth/auth.service.ts), [guard](../../../src/modules/auth/session.guard.ts), [contrato](../../openapi/users.v1.json) y [matriz de pruebas](../../sdd/coverage.md). El README histórico niega el registro público; la implementación sí lo expone.

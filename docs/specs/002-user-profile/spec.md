# 002 — Perfil propio

## Contexto y objetivo

Permitir al titular consultar y corregir su identidad visible y el punto de partida de sus finanzas sin acceder a cuentas ajenas.

## Usuarios e historias

Titular autenticado: quiero consultar mi perfil y ajustar nombre, correo, saldo y fecha inicial para que mis indicadores partan de datos correctos.

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

[NO VERIFICADO] Cobertura dinámica específica de todas las variantes de saldo inicial editado; la prueba HTTP identificada no demuestra cada borde del formato.

Fuentes: [controlador](../../../src/modules/users/users.controller.ts), [servicio](../../../src/modules/users/users.service.ts), [entidad](../../../src/modules/users/entities/user.entity.ts), [contrato](../../openapi/users.v1.json) y [cobertura](../../sdd/coverage.md).

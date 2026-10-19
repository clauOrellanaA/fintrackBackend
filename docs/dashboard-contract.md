# Panel principal: contrato BE-00

Estado: aprobado por el usuario el 2026-10-18. Este documento describe comportamiento futuro, no endpoints ya implementados.

## Decisiones financieras aprobadas

| ID | Regla | Motivo |
| --- | --- | --- |
| D01 | Una moneda BOB, escala 2, importes JSON como cadenas decimales con dos digitos. PostgreSQL NUMERIC(14,2), valor absoluto maximo 999999999999.99. Entradas con mas de dos decimales se rechazan; no se redondean silenciosamente. | Evita conversiones y perdida de precision. |
| D02 | Zona de producto America/La_Paz. Fecha efectiva `occurredAt` como instante timestamptz. Mes seleccionado YYYY-MM, por defecto mes actual de producto. Rango permitido 1900-01 a 9998-12. Intervalo inicio inclusivo y siguiente mes exclusivo. | Permite construir limites sin depender de la zona del servidor. |
| D03 | Una cuenta por usuario. Saldo inicial firmado y explicito con `openingAt` obligatorio; apertura obligatoria al crear usuario, sin asumir cero real. Saldo a `asOf` = apertura + ingresos posted - gastos posted - aportes netos reservados. No permitir movimientos anteriores a apertura; rechazar incoherencias, nunca descartarlos silenciosamente. Saldo independiente del mes seleccionado. Sin transferencias externas ni otras cuentas en modulo 1. | Distingue saldo acumulado de resultado mensual. |
| D04 | Movimientos positivos income/expense, posted incluidos y void excluidos. No se admiten importes negativos ni cero. Devolucion = ingreso positivo vinculado al gasto original; resumen muestra ingresos y gastos brutos. Categoria ausente usa id null y etiqueta Sin categoria. | Evita doble interpretacion de signos y estados. |
| D05 | Presupuesto por usuario/categoria/mes, limite >0, sin acumulacion entre meses. Consumo = gastos posted del mes; restante = limite - consumo, puede ser negativo. Progreso = consumo / limite *100. normal <80, warning entre 80 y 100 inclusive, exceeded >100. | Conserva el umbral establecido y no confunde 100 con excedido. |
| D06 | Meta con objetivo >0. Aportes positivos reservan disponible; retiros positivos liberan reserva y no pueden superar acumulado. No son income/expense. Acumulado = aportes - retiros; restante = max(objetivo-acumulado,0). Estado completed si acumulado>=objetivo, de otro modo overdue si fecha objetivo local anterior al dia actual, de otro modo active. Mostrar todas salvo archivadas. Progreso puede superar 100. | Impide doble descuento y division por cero; completion precede overdue. |

Porcentajes como cadenas con dos decimales, redondeo HALF_UP mediante aritmetica decimal/entera, nunca punto flotante monetario. Clasificar estados con importes exactos antes del redondeo. Distribucion ordenada por importe descendente y luego categoryId ascendente (null al final). Cada porcentaje se redondea independientemente: suma permitida difiere de 100 en hasta 0.005 puntos porcentuales por categoria; no ajustar importes para forzar 100. Sin gastos devuelve lista vacia.

Todos los campos monetarios y resultados agregados respetan el limite D01; desbordamiento produce 422 DATA_OUT_OF_RANGE, nunca truncamiento. Limites/objetivos invalidos se rechazan al persistir; si existen datos corruptos detectados al consultar, 500 DATA_INTEGRITY_ERROR, no division por cero ni datos ficticios.

Ejemplo D03: apertura 1000.00 + ingreso 2000.10 - gasto 500.05 - aporte 100.00 + retiro 20.00 = disponible 2420.05. Si ingreso fue en septiembre y gasto en octubre, octubre muestra ingresos 0.00 y gastos 500.05; no muestra saldo -500.05. Distribucion 20.00 y 10.00 sobre 30.00 produce 66.67 y 33.33. Presupuesto limite 100.00 con consumo 80.00/100.00/100.01 produce warning/warning/exceeded. Meta 100.00 con aportes 120.00 y retiro 10.00 acumula 110.00, restante 0.00, progreso 110.00, completed.

## D07: decisiones tecnicas

NestJS/TypeScript y npm existentes se conservan. TypeORM con PostgreSQL, migraciones explicitas y synchronize=false en todo entorno; las migraciones son la fuente de esquema, no el health check `pg`. Seleccionar y fijar version compatible de TypeORM en BE-01 mediante lockfile. Queries de dominio siempre reciben el id de identidad resuelta por guard, nunca userId del request.

Sesion opaca bearer de 256 bits aleatorios, persistir solamente hash SHA-256 del token, expiracion absoluta 8 horas y revocacion al cerrar sesion. Passwords con scrypt de Node, salt aleatorio individual y comparacion en tiempo constante. POST /api/v1/auth/login recibe email/password y devuelve accessToken/tokenType/expiresAt; DELETE /api/v1/auth/session revoca. Login invalido siempre 401 INVALID_CREDENTIALS sin revelar existencia de usuario. Tokens y passwords nunca se registran. HTTPS obligatorio fuera de desarrollo local; frontend conserva token en memoria, no URL ni almacenamiento persistente. No endpoint de suplantacion, no userId como login y no bypass de desarrollo. Seed solo desarrollo/test, con dos usuarios diferenciados y password local explicita; no se ejecuta automaticamente en produccion.

Pruebas backend con node:test y PostgreSQL real aislado para migraciones, identidad y propiedad; dependencias y versiones exactas quedan en package-lock de BE-01. Librerias frontend de consultas/graficos quedan a FE-00/FE-03, fuera de esta entrega backend.

## HTTP y evolucion compatible

GET /api/v1/dashboard?month=YYYY-MM queda adoptado. OpenAPI JSON en `openapi/dashboard.v1.json`. No aceptar parametros desconocidos, incluido userId; month repetido o invalido devuelve 400. Sesion se comprueba antes del periodo; ausencia, revocacion o expiracion devuelve 401. Todas las respuestas de login, session y dashboard (incluidos errores) llevan Cache-Control: no-store. Capturar un unico asOf UTC por consulta.

Envelope estable `period`, `currency`, `asOf`, `sections`. Cada seccion es `{status: "notAvailable"}` hasta su feature; al implementarse cambia a `{status: "ready", data: ...}`. No confundir notAvailable con vacio. BE-01 entrega las cinco secciones notAvailable; BE-02 habilita balance; BE-03 monthlySummary; BE-04 expenseDistribution; BE-05 budgets; BE-06 savingsGoals. Frontend debe manejar ambos estados y propiedades adicionales futuras. No quitar ni cambiar tipo de campos existentes en v1.

Secciones vacias listas = []; resumen vacio = income 0.00/expense 0.00; saldo sin movimientos = apertura. Esto solo se devuelve tras una consulta exitosa. Fallo de cualquier consulta aborta respuesta completa: 503 DATA_UNAVAILABLE para dependencia indisponible, 500 INTERNAL_ERROR para fallo inesperado. No resultados parciales ni reemplazos por cero. Error `{error:{code,message}}`, sin SQL, stack, token ni detalles internos.

`period.start` y `period.endExclusive` son UTC, `period.timeZone` identifica la zona de producto. Ejemplo octubre 2026: 2026-10-01T04:00:00.000Z hasta 2026-11-01T04:00:00.000Z. `balance.cutoff` coincide con asOf, no con fin de mes. Presupuestos usan mes seleccionado; metas y saldo son al asOf actual.

Esta rama documental parte de origin/dev 76cfc459911c2149569988febf9c9e1f2b56be45, que solo contiene estructura, sin scripts de aplicacion. La base de arranque de otra rama no queda incluida en BE-00.

## Ejemplo final vacio (BE-06, consulta exitosa)

Usuario con apertura explicita 0.00 y sin movimientos, presupuestos o metas:

```json
{
  "period": {"month": "2026-10", "timeZone": "America/La_Paz", "start": "2026-10-01T04:00:00.000Z", "endExclusive": "2026-11-01T04:00:00.000Z"},
  "currency": "BOB",
  "asOf": "2026-10-18T12:00:00.000Z",
  "sections": {
    "balance": {"status": "ready", "data": {"amount": "0.00", "cutoff": "2026-10-18T12:00:00.000Z"}},
    "monthlySummary": {"status": "ready", "data": {"income": "0.00", "expense": "0.00"}},
    "expenseDistribution": {"status": "ready", "data": []},
    "budgets": {"status": "ready", "data": []},
    "savingsGoals": {"status": "ready", "data": []}
  }
}
```

Ejemplo error 400: `{"error":{"code":"INVALID_PERIOD","message":"month debe tener formato YYYY-MM y un mes valido."}}`. Ante indisponibilidad SQL: 503 `{"error":{"code":"DATA_UNAVAILABLE","message":"No se pudo consultar el panel."}}`.

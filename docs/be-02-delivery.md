# BE-02: saldo disponible

Base origin/dev actualizada mediante fetch: 5c3b75f121df91b35c7950b8d454772434990eee (BE-01 integrada). Rama feature/be-02-dashboard-balance, worktree C:/fintrack/worktrees/backend/be-02-dashboard-balance, responsable unico Git especialista backend. Sin cherry-picks, merge, force ni despliegue.

BalanceService pertenece a transactions y expone consulta por identidad autenticada/corte, sin parametro de mes. Apertura explicita + ingresos posted - gastos posted efectivos desde apertura hasta corte inclusivo. Moneda BOB, movimientos void/futuros excluidos, devoluciones income ya contadas una vez. Snapshot REPEATABLE READ, SQL numeric y BigInt para reservas/serializacion, sin Number para dinero. Cero solo si apertura y movimientos reales lo producen; usuario ausente devuelve 401 y apertura futura 500 DATA_INTEGRITY_ERROR. Resultado fuera del rango contractual devuelve 422 DATA_OUT_OF_RANGE.

Dashboard habilita solo sections.balance: status ready, data.amount cadena de dos decimales, data.cutoff exactamente igual a asOf y currency global. Seleccionar otro mes no cambia la formula del saldo. No se alteran formatos ni reglas BE-00.

## Extension obligatoria BE-06

El esquema vigente no admite reservas ni aportes: SavingsNotEnabled expresa explicitamente esa capacidad aun no habilitada. No captura errores ni representa una consulta fallida. BE-06 debe reemplazar SavingsReservationReader antes de habilitar persistencia/escritura de aportes; recibe userId, asOf y el EntityManager del mismo snapshot. Su importe neto en unidades menores se descuenta una sola vez; cualquier fallo aborta respuesta. Tests con proveedor inyectado comprueban contrato de extension y propagacion, no implementacion persistida BE-06. No se crean modelos de metas en BE-02.

## Verificacion local

Node 24.15.0, PostgreSQL 17 de pruebas aislado puerto 16433 (base propia aleatoria eliminada por suite). npm ci --prefer-offline --no-audit --fetch-retries=0, npm run lint, npm run typecheck y npm test (incluye build) aprobados. Once tests, cero fallos y cero omisiones. No nuevas dependencias ni migraciones; CI existente ejecuta automaticamente la suite ampliada.

Casos nuevos: acumulado de meses previos; apertura sin movimientos y cero explicito; saldo negativo/fraccionario; maximos positivo/negativo y overflow; cutoff inclusivo y futuro excluido; void excluido; aislamiento ante otro usuario; mes HTTP independiente; apertura futura/usuario ausente; reserva no cero descontada una sola vez, mismo EntityManager en repeatable read y fallo del lector devuelve HTTP503 sin SQL/detalles internos ni ceros. Se conservan pruebas de autenticacion/migraciones/seed de BE-01. CI remota se informa al publicar sin presumir su resultado.

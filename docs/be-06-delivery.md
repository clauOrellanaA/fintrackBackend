# BE-06: metas y reservas persistidas

Base origin/dev: `82cb065948d5df5c7570a16aeef9e6d986096f96`, con BE-05 integrada. Rama `feature/be-06-dashboard-savings-goals`, worktree `C:/fintrack/worktrees/backend/be-06-dashboard-savings-goals`. El especialista backend preparo la implementacion; el coordinador asumio la escritura y Git tras agotarse la cuota del especialista. Sin escritores concurrentes, merge, force push ni despliegue.

## Entrega

Tercera migracion `SavingsGoals1792540800000`: metas con propietario, objetivo positivo exacto, moneda BOB, creacion, fecha objetivo opcional y archivo. Entradas de ahorro con FK compuesta meta/usuario, importe positivo y fecha efectiva. Numeric sin typmod y CHECK de escala/rango rechaza entradas que se redondearian silenciosamente. Registro de solo anexado: no actualizar ni eliminar entradas; corregir mediante otro aporte o retiro valido.

Cada entrada incrementa la version de la meta y valida todos los prefijos temporales agrupados por instante para impedir retiros sin reserva efectiva, incluidos retiros retroactivos. Escritores se serializan; un snapshot REPEATABLE READ obsoleto falla con 40001. No hay reintento automatico ni endpoints CRUD en esta entrega. No se afirma proteccion concurrente de modificaciones de apertura no probadas.

SavingsGoalsService muestra metas creadas hasta asOf y no archivadas a ese corte. Acumulado=aportes-retiros; restante=max(objetivo-acumulado,0); progreso HALF_UP BigInt sin limitar 100. completed precede overdue; overdue exige fecha objetivo anterior al dia local America/La_Paz. Una meta incompleta cuyo objetivo vence hoy sigue active. Valores monetarios se serializan con dos decimales y limites contractuales; no se usa Number para dinero.

El puerto SavingsReservationReader esta en shared, con reexport compatible desde transactions. PersistedSavingsReservationReader reemplaza el proveedor sin persistencia y suma reservas incluidas las metas archivadas. Archivar solo oculta; retirar libera dinero. Saldo resta reservas una sola vez y ahorro no agrega income/expense. Las cinco secciones del dashboard estan ready y comparten el mismo EntityManager y snapshot REPEATABLE READ. Errores abortan toda la respuesta; nunca se convierten en ceros o listas vacias.

## Seed

Seis metas por usuario: sin aportes, parcial, completada, excedida, vencida y archivada; cinco visibles. IDs deterministas, sin sobreescribir datos existentes. Reserva neta alice 300.00 y bob 600.00; saldo demo al corte 2026-10-19 queda 2200.05 y 259.50. No cambia contrasenas, aperturas, movimientos previos, ingresos/gastos mensuales ni presupuestos. Aportes/retiros reales, sin ingresos compensatorios. Repetir seed y revertir/reaplicar migraciones no duplica entradas.

## Verificacion

Node 24 y PostgreSQL 17 aislado en puerto 16437. `npm ci --prefer-offline --no-audit --fetch-retries=0`, `npm run lint`, `npm run typecheck` y `npm test` (incluye build) aprobados. Suite final: **33/33**, cero omisiones.

- Regresiones BE-01 a BE-05, metas sin aportes/parciales/completadas/excedidas/vencidas, limites monetarios y progreso real superior a 100.
- D03: 1000.00 + 2000.10 - 500.05 - 100.00 + 20.00 = 2420.05 disponible; ingresos y gastos no incluyen ahorro.
- Dos usuarios, fechas/corte, dia local, archivo que conserva reservas y retiro de meta archivada.
- Integridad de objetivo, escala, moneda, fechas y FK; ledger de solo anexado; retiro retroactivo invalido.
- Dos retiros concurrentes reales bajo READ COMMITTED y REPEATABLE READ: solo uno confirma, el otro falla con 23514 o 40001 respectivamente; no hay sobregiro.
- Commit real de aporte entre lectura del saldo y metas: snapshot anterior consistente, siguiente consulta ve la nueva reserva. Fallo inyectado aborta HTTP con 503 sin datos parciales ni secretos; no se presenta como averia real de PostgreSQL.
- Migraciones desde vacio y actualizaciones desde BE-01 y BE-05 con datos previos; BE-05 aplica solo la nueva migracion. Seed repetible, rollback/reaplicacion y conservacion de credenciales/movimientos/presupuestos.

Pruebas usan bases aleatorias propias del contenedor aislado; no migran ni limpian la base del usuario. CI existente ejecuta la suite ampliada; su estado remoto se informa por separado tras publicar.

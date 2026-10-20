# BE-03: resumen mensual

Base origin/dev actualizada mediante fetch: 4a4b3622dcd1369ee603d1f3300a755d42a88f74 (BE-02 integrada). Rama feature/be-03-dashboard-monthly-summary, worktree C:/fintrack/worktrees/backend/be-03-dashboard-monthly-summary. Responsable unico Git especialista backend; sin cherry-picks, merge, force ni despliegue.

MonthlySummaryService en transactions suma ingresos y gastos brutos separados por usuario de sesion, BOB, posted y fecha efectiva [inicio, fin) del mes IANA validado. Dinero PostgreSQL numeric, conversion BigInt y cadenas de dos decimales. Ceros solo tras consulta exitosa sin movimientos; overflow422 y fallo global sin datos parciales. Las devoluciones son ingresos vinculados y no reducen gastos brutos. No nuevos modelos, dependencias ni migraciones.

Dashboard habilita monthlySummary ready y conserva balance ready, currency y cutoff=asOf; las otras tres secciones siguen notAvailable. Abre un unico REPEATABLE READ y pasa EntityManager a ambos servicios. BalanceService conserva su formula acumulada y su interfaz independiente, abriendo snapshot propio solo si el llamador no le entrega uno.

## Semantica temporal aprobada

El resumen usa exclusivamente el periodo seleccionado: posted futuros dentro del mes se incluyen aunque sean posteriores al asOf del saldo. Saldo conserva su corte actual y no depende del mes. Compartir snapshot asegura version de datos coherente; no iguala esos dos intervalos distintos. Esta interpretacion fue acordada con el coordinador antes de implementar y corresponde a D02/D04.

## Verificacion

Node24.15.0 y PostgreSQL17 aislado puerto16434. npm ci --prefer-offline --no-audit --fetch-retries=0, lint, typecheck y npm test (incluye build) aprobados. Suite15/15 sin omisiones, conservando BE-01/BE-02 y agregando:

- Limites inicio inclusivo/fin exclusivo (un milisegundo a cada lado), cambio de anio, febrero bisiesto y zona historica1900 America/La_Paz.
- Mes vacio real, dos propietarios, posted futuro dentro del mes incluido en resumen pero ausente de saldo, y void excluido.
- Devoluciones brutas, fracciones y maximos exactos; overflow de ambos totales aunque balance neto sea cero.
- Commit concurrente REAL entre consulta de saldo y resumen: ambas conservan snapshot anterior y la peticion siguiente ve el cambio.
- Fallo inyectado de resumen devuelve HTTP503 sin SQL privado, saldo parcial ni ceros artificiales; no se presenta como prueba de una averia PostgreSQL real.

CI existente ejecuta la suite ampliada con servicio PostgreSQL aislado; estado remoto se informa tras publicar. Pruebas no modifican base de usuario y eliminan su propia base aleatoria de la instancia de pruebas.

# BE-05: indicadores de presupuestos

Base origin/dev actualizada mediante fetch: 926b48b249fb6abbe023b0e83dea2ef10ad1b1cf (BE-04 integrada). Rama feature/be-05-dashboard-budgets, worktree C:/fintrack/worktrees/backend/be-05-dashboard-budgets. Responsable unico Git especialista backend, tambien escritor exclusivo de migracion, ORM y seed. Sin cherry-picks, merge, force ni despliegue.

Migracion Budgets1792454400000 y entidad Budget: FK usuario/categoria compuesta, categoria no nula segun contrato; unico propietario/categoria/mes; mes YYYY-MM1900-01..9998-12; BOB; limite numeric positivo, escala<=2 y maximo999999999999.99 sin redondeo silencioso. Configuracion DataSource conserva synchronize=false. Aplicar mediante db:migrate; no se migran bases del usuario durante pruebas.

BudgetsService consume gastos mensuales de la interfaz publica ExpenseDistributionService con EntityManager del mismo snapshot dashboard. No duplica filtros ni accede a privados de transactions. Presupuestos se consultan por usuario y mes, sin rollover. DTO contractual id/categoryId/categoryName/limit/spent/remaining/progress/state; orden categoryId/id ascendente. Solo savingsGoals sigue notAvailable. Sin budgets devuelve[], mientras presupuesto sin gastos muestra0.00 normal tras consulta exitosa. Fallos abortan toda respuesta, nunca ceros ficticios. Sin CRUD ni notificaciones.

## Calculo exacto

Restante=limite-consumo, puede negativo. Progreso HALF_UP BigInt sin limitar100; distribucion mantiene validacion parte<=total separada. Estado con comparacion entera antes de redondear: normal consumo*100<limite*80; exceeded consumo>limite; warning en los demas casos (incluye80% y100% exactos).79.999% puede verse80.00 y seguir normal;100.001% puede verse100.00 y seguir exceeded. No hay Number monetario ni division por limite cero.

## Seed compatible

Usuarios existentes tambien se amplian tras migrar, sin cambiar passwords ni aperturas. Tres presupuestos demo por persona en febrero2026: alice limite100.00 y gastos80.00/100.00/100.01; bob limite200.00 y gastos160.00/200.00/200.01. Cada gasto tiene ingreso compensatorio al MISMO instante: seis movimientos extra por usuario (ocho incluyendo los dos anteriores), neto0. Saldo acumulado y octubre2026 permanecen iguales.

Categorias, presupuestos y movimientos demo usan IDs deterministas propios; seed transaccional/advisory lock no sobreescribe preexistentes. Si ya existe otro presupuesto del usuario para esa categoria/mes, no le agrega movimientos demo. Repetir seed o revertir/reaplicar solo budgets no duplica movimientos ni cambia credenciales. Una apertura incompatible posterior a febrero hace fallar y revertir todo seed, sin omitir integridad. Produccion sigue rechazada.

## Verificacion

Node24.15.0 y PostgreSQL17 aislado16436. npm ci reproducible, lint, typecheck y npm test (incluye build) aprobados. Suite25/25, cero fallos/omisiones, preserva las19 regresiones anteriores con expectativas ampliadas de seed. CI existente ejecuta suite ampliada; resultado remoto se informa al publicar.

Casos nuevos:0/79.99/80/100/>100 y estados antes de redondeo, restante negativo y porcentaje extremo real>100; limites invalidos0/negativo/precision/rango/NaN/Infinity; mes invalido y bordes1900/9998, FK null/otro propietario/currency y unique; filtros de gastos incluido futuro posted, void, refund bruto, limites horarios, no rollover y aislamiento; seed80/100/exceeded para ambos usuarios; commit concurrente REAL entre distribucion y consumo de budgets conserva snapshot anterior y siguiente consulta ve cambio; fallo inyectado HTTP503 global sin privados ni datos parciales.

Otra base aislada simula BE-01 con usuarios y movimientos existentes, aplica SOLO nueva migracion, verifica rollback completo seed por apertura futura, luego seed idempotente sin modificar datos/credenciales anteriores. Prueba rollback/reaplicacion de budgets y de ambas migraciones sobre vacio. Se eliminan exclusivamente bases aleatorias propias de pruebas.

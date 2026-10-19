# BE-04: distribucion de gastos

Base origin/dev actualizada mediante fetch: 0fb4abec216c9675e391082f166c8d5c1eaba94d (BE-03 integrada). Rama feature/be-04-dashboard-expense-distribution, worktree C:/fintrack/worktrees/backend/be-04-dashboard-expense-distribution. Responsable unico Git especialista backend; sin cherry-picks, merge, force ni despliegue.

ExpenseDistributionService en transactions agrupa gastos por categoria con filtros identicos al resumen mediante fragmentos SQL estaticos compartidos: usuario de sesion, BOB, posted y fecha efectiva [inicio, fin) IANA, incluidos posted futuros dentro del mes. Join de categorias por mismo propietario y snapshot comun REPEATABLE READ con saldo/resumen. El dashboard habilita expenseDistribution ready y conserva presupuestos/metas notAvailable. No nuevas dependencias, migraciones ni modelos.

Respuesta categoryId (UUID/null), categoryName, amount y percentage. Sin categoria usa null y Sin categoria. Orden importe descendente, luego UUID ascendente con null ultimo en empate. Importes SQL numeric se convierten a unidades menores BigInt, sin Number monetario; suma de grupos igual a gasto mensual. Total agregado fuera de rango devuelve422 antes de calcular porcentajes. Sin gastos devuelve[] solo tras consulta exitosa; cualquier error aborta toda respuesta.

## Redondeo

Porcentaje a dos decimales, HALF_UP exacto con BigInt: centesimas de punto = floor((importeMenor*20000 + totalMenor)/(2*totalMenor)). Se calcula solo con total positivo, independientemente por categoria. Tres tercios producen33.33 cada uno (99.99 total);1/32 produce3.13 y31/32 produce96.88 (100.01 total). Tolerancia absoluta frente100: hasta0.005 puntos por categoria. No se redistribuyen porcentajes ni se alteran importes para sumar100. Categorias de importe muy pequeno pueden tener0.00% y conservan su importe real.

## Verificacion

Node24.15.0 y PostgreSQL17 aislado en16435. npm ci --prefer-offline --no-audit --fetch-retries=0, lint, typecheck y npm test (incluye build) aprobados. Suite19/19, cero fallos y omisiones. CI existente ejecuta la suite ampliada; estado remoto se informa al publicar.

Casos nuevos: mes vacio/solo ingresos, una o multiples categorias, null y nombre100 caracteres, empate con orden UUID/null, agrupacion de varios movimientos, igualdad exacta con gastos BE-03, tercios/HALF_UP exacto/denominador impar, extremos monetarios y porcentaje0.00, overflow total, filtros IANA/futuros/void/propiedad. Commit concurrente REAL entre resumen y distribucion conserva ambos en snapshot anterior; siguiente peticion ve el nuevo gasto. Fallo inyectado de servicio devuelveHTTP503 sin SQL privado, datos parciales ni lista vacia ficticia (no se presenta como averia real del servidor PostgreSQL). Se conservan todos los casos BE-01/BE-02/BE-03.

Pruebas no modifican base del usuario y eliminan su propia base aleatoria en la instancia aislada. Worktree se conserva para revision; no se integra ni despliega esta rama por el agente.

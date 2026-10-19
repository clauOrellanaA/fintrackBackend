# Arquitectura por features

| Feature | Responsabilidad |
| --- | --- |
| dashboard | Saldo, resumen mensual, graficos e indicadores |
| transactions | Ingresos y gastos, categorias, fechas, busqueda y filtros |
| budgets | Limites mensuales por categoria y alertas al 80 % y al superar 100 % |
| reports | Comparaciones, distribucion por categoria y evolucion mensual |
| savings-goals | Objetivos, montos, fechas y aportes de ahorro |
| notifications | Alertas internas sobre presupuestos y objetivos |
| auth | Registro, inicio de sesion y autenticacion |
| users | Perfil y propiedad de los datos |

Frontend: app contiene composicion, rutas y proveedores; features contiene paginas, componentes, hooks, tipos y acceso a API de cada dominio; shared contiene piezas reutilizables sin logica propia de una feature.

Backend: modules contiene dominios NestJS; auth, users, transactions y dashboard tienen implementacion minima BE-01. entities conserva modelos TypeORM; config concentra configuracion y database agrupa DataSource, migraciones y seed. TypeORM 0.3.31 usa PostgreSQL con migraciones explicitas y synchronize=false. Los servicios publicos de dominio separan composicion dashboard de persistencia.

Las features no deben depender de detalles internos de otras features. Las operaciones financieras, validaciones y autorizacion pertenecen al backend. Toda consulta financiera debe restringirse al usuario autenticado. Las contrasenas se almacenaran con hash seguro en el backend.

El dinero usa decimales exactos en PostgreSQL y contrato JSON explicito, evitando calculos monetarios con punto flotante. Moneda BOB, escala 2, zona America/La_Paz y reglas de redondeo estan aprobadas en dashboard-contract.md.

La capacidad NUMERIC(14,2) del contrato se implementa mediante NUMERIC sin typmod y CHECK de escala y limites: evita que PostgreSQL redondee entradas antes de validarlas. Ver be-01-delivery.md para la razon y evidencia.

Hay autenticacion mediante sesiones bearer opacas revocables y expirables, con scrypt para passwords; identidad obtenida del guard, nunca del navegador. Hay restricciones financieras minimas de integridad y consultas por propietario. BE-02 implementa BalanceService, BE-03 MonthlySummaryService y BE-04 ExpenseDistributionService en transactions: datos agregados SQL numeric, conversion BigInt y serializacion exacta de dos decimales. BE-05 implementa BudgetsService en budgets consumiendo la interfaz publica ExpenseDistributionService del dominio transactions. Dashboard abre un unico REPEATABLE READ y comparte EntityManager con todos; no recalcula cifras ni abre transacciones anidadas. Las interfaces de dominio conservan consultas independientes con su propio snapshot cuando no reciben manager. BE-06 implementa SavingsGoalsService y PersistedSavingsReservationReader en savings-goals. El puerto abstracto esta en shared; transactions importa el modulo publico sin dependencias ciclicas. No existe proveedor de reservas ficticias activo.

Resumen mensual filtra por identidad, BOB, posted y fecha efectiva en [inicio, fin) IANA del periodo validado; ingresos y gastos brutos separados, incluidas devoluciones como ingreso. No se filtra por asOf: un movimiento posted futuro dentro del mes elegido pertenece al resumen, aunque todavia no afecte al saldo acumulado. Snapshot compartido garantiza misma version de datos, sin confundir esos limites temporales distintos.

Distribucion comparte con resumen los fragmentos SQL estaticos MONTHLY_POSTED_JOIN y OWNED_BOB_USER; solo datos parametrizados para identidad/fechas. Agrupa exclusivamente expense por categoria del mismo propietario, null como Sin categoria. Orden importe descendente y UUID ascendente en empates, null ultimo. Porcentajes BigInt HALF_UP independientes; importes suman el gasto mensual y nunca se ajustan para forzar suma porcentual100. Un mes sin gastos devuelve[] tras consulta exitosa.

Budgets tiene entidad TypeORM y migracion propia: categoria UUID no nula con FK compuesta por propietario; unico usuario/categoria/mes; BOB; periodo1900-01..9998-12; limite numeric sin typmod con CHECK de positivo/escala/maximo. Sin arrastre entre meses. Consumo desde interfaz publica transactions evita duplicar filtros, incluido futuro posted y gastos brutos sin descontar devoluciones. Estados exactos antes de redondear: normal<80%, warning80..100% inclusive, exceeded>100%. Progress HALF_UP no se limita a100; distribution conserva su validacion estricta parte<=total. No hay CRUD de budgets ni envio de notificaciones en BE-05.

SavingsReservationReader recibe identidad, corte y EntityManager de la misma transaccion. El proveedor SavingsNotEnabled corresponde exclusivamente al esquema BE-01 sin modelos ni escritura de reservas, no a consultas fallidas. BE-06 debe reemplazarlo antes de habilitar persistencia o aportes, usando ese EntityManager y propagando errores. Las pruebas con reservas inyectadas verifican extension y descuento una sola vez; no afirman soporte persistido de metas.

BE-06: metas visibles creadas hasta asOf y no archivadas a ese corte. Objetivo positivo; acumulado=aportes-retiros hasta asOf; restante=max(objetivo-acumulado,0); progreso HALF_UP sin limitar 100. completed precede overdue; overdue solo si targetDate es anterior al dia local America/La_Paz; hoy sigue active si incompleta. Reservas incluyen metas archivadas: ocultar no cambia fondos. Todas las consultas usan propietario, BOB y EntityManager del mismo REPEATABLE READ. Objetivos/importes invalidos se rechazan; fallos abortan toda respuesta.

Persistencia incluye FK compuesta meta/usuario, fechas posteriores a creacion/apertura, ledger de solo anexado y validacion de todos los prefijos temporales por instante. Cada entrada incrementa la version de la meta para serializar escritores y provocar 40001 ante snapshots RR obsoletos. No se promete reintento automatico ni proteccion concurrente de cambios de apertura no probados. No se agregan endpoints CRUD.

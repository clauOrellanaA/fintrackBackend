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

Hay autenticacion mediante sesiones bearer opacas revocables y expirables, con scrypt para passwords; identidad obtenida del guard, nunca del navegador. Hay restricciones financieras minimas de integridad y consultas por propietario. BE-02 implementa BalanceService y BE-03 MonthlySummaryService en transactions: apertura y movimientos posted se agregan en SQL, con conversion decimal/BigInt y serializacion exacta de dos decimales. Dashboard abre un unico REPEATABLE READ y comparte EntityManager con ambos servicios; no recalcula cifras ni abre transacciones anidadas. Las interfaces de dominio conservan consultas independientes con su propio snapshot cuando no reciben manager. Distribucion, presupuestos y metas siguen pendientes.

Resumen mensual filtra por identidad, BOB, posted y fecha efectiva en [inicio, fin) IANA del periodo validado; ingresos y gastos brutos separados, incluidas devoluciones como ingreso. No se filtra por asOf: un movimiento posted futuro dentro del mes elegido pertenece al resumen, aunque todavia no afecte al saldo acumulado. Snapshot compartido garantiza misma version de datos, sin confundir esos limites temporales distintos.

SavingsReservationReader recibe identidad, corte y EntityManager de la misma transaccion. El proveedor SavingsNotEnabled corresponde exclusivamente al esquema BE-01 sin modelos ni escritura de reservas, no a consultas fallidas. BE-06 debe reemplazarlo antes de habilitar persistencia o aportes, usando ese EntityManager y propagando errores. Las pruebas con reservas inyectadas verifican extension y descuento una sola vez; no afirman soporte persistido de metas.

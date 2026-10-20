# BE-07: validacion integrada y cierre backend

Base `origin/dev`: `d9ee1c8`, con BE-00 a BE-06 y configuracion compartida integradas. Rama `feature/be-07-dashboard-validation`; worktree `C:/fintrack/worktrees/backend/be-07-dashboard-validation`. Responsable unico de escritura y Git: coordinador. No modifica las ramas abiertas en el IDE, la base del usuario ni frontend. Sin merge ni despliegue.

## Contrato e integracion

Ajv JSON Schema 2020 y ajv-formats, dependencias exclusivamente de desarrollo fijadas en lockfile, validan los esquemas de OpenAPI 3.1. Los ejemplos publicados y respuestas HTTP reales se contrastan con Dashboard/Error; no se mantiene otra copia manual de DTO para las pruebas. Las referencias OpenAPI se adaptan a $defs solo en el validador de pruebas, sin cambiar el contrato.

La nueva prueba integrada recorre dos sesiones, verifica las cinco secciones ready, igualdad de distribucion con gastos mensuales, consumo de presupuestos con sus categorias, corte de saldo y no-store. Una cuenta nueva con apertura explicita42.50 verifica vacios financieros reales: resumen0.00, listas vacias y saldo de apertura. Errores de sesion/periodo/identidad cumplen Error y no devuelven secciones parciales. Las regresiones existentes prueban permisos, limites, devoluciones, ahorro real, archivos, retiros concurrentes, snapshot, fallos globales y migraciones desde vacio/upgrade.

Se corrigieron menciones antiguas a ahorro pendiente/proveedor provisional y se documentan los saldos demo posteriores a reservas reales. El contrato esta listo para consumidores frontend, pero este cierre no acredita integracion visual ni pruebas frontend.

## Medicion reproducible

Comando: `npm run benchmark:dashboard`, con TEST_DATABASE_URL de PostgreSQL dedicado; BENCHMARK_OUTPUT opcional exporta JSON. El script crea/elimina solo su base aleatoria propia. La carga de fixture usa una conexion separada con timeout120s porque210000 inserciones con triggers superaron el timeout5s; la API conserva sus5s normales. No se mide la carga como latencia de peticion.

Entorno medido: Node24.15.0, PostgreSQL17.11 local en Docker, puerto16438. Datos sinteticos:42 usuarios,428 categorias,210016 movimientos,50406 presupuestos,2112 metas y21012 entradas de ahorro. Usuario consultado:5008 movimientos y1200 presupuestos historicos adicionales, mes2026-10. Tras3 calentamientos,20 muestras por modalidad:

| Modalidad | p50 ms | p95 ms |
| --- | ---: | ---: |
| Servicio dashboard completo | 14.975 | 16.317 |
| HTTP autenticado y JSON | 20.586 | 26.346 |

Presupuesto tecnico local de referencia: p95 HTTP <500ms, cumplido. Es un objetivo de verificacion elegido para este fixture, **no un SLA aprobado de producto**. Login/scrypt excluido del tiempo medido. No es una prueba de carga concurrente, cache fria ni infraestructura productiva. Evidencia completa: [be-07-benchmark.json](be-07-benchmark.json).

EXPLAIN(ANALYZE,BUFFERS,FORMAT JSON), tras ANALYZE, registra seis consultas distintas y siete SELECT por composicion (budgets reutiliza la API publica de distribucion):

| Consulta | Ejecucion ms | Indices observados |
| --- | ---: | --- |
| Saldo | 6.602 | transactions_user_date_idx |
| Reservas | 1.391 | savings_goals_owner_idx |
| Resumen | 0.298 | transactions_user_date_idx |
| Distribucion | 0.446 | transactions_user_date_idx, categories_user_id_name_key |
| Presupuestos | 0.587 | budgets_user_id_category_id_month_key, categories_user_id_name_key |
| Metas | 2.460 | savings_goals_owner_idx |

Se conservan indices existentes: el volumen medido cumple el presupuesto local y no requiere una nueva migracion de indices. El planificador elige hash joins y escaneos secuenciales sobre las21012 entradas de ahorro; la evidencia conserva filas filtradas y buffers para reevaluar con mayor volumen. No se fuerza el uso de indices ni se afirma escalabilidad ilimitada.

## Validacion y limites de cierre

- npm ci reproducible, lint, typecheck y build aprobados.
- npm test:35/35 pruebas HTTP/PostgreSQL y contrato, sin omisiones. CI existente ejecuta la suite ampliada; resultado remoto se informa tras publicar.
- Benchmark manual reproducible, fuera de CI para evitar umbrales de tiempo dependientes del runner.
- Migraciones y seeds documentados y probados en bases aisladas. No se migraron datos del usuario.

BE-07 cierra la entrega **backend** del modulo. Validaciones de UI, accesibilidad, responsive, contrato consumido por frontend y promocion a qa/main siguen fuera de este cierre. El worktree se conserva para revision.

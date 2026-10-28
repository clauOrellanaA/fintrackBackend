# Constitución de FinTrack backend

1. Simplicidad: conservar NestJS, TypeScript, TypeORM y PostgreSQL; una nueva dependencia exige necesidad documentada en el plan.
2. Spec y código: cada cambio de comportamiento debe actualizar su RF y trazabilidad; la línea base retrospectiva registra lo observado y sus discrepancias.
3. Separación: los controladores reciben solicitudes, los servicios resuelven reglas y la persistencia garantiza integridad; no duplicar cálculos entre módulos.
4. Tests: reutilizar pruebas pertinentes, añadirlas ante cambios de comportamiento y registrar comando, resultado y omisiones; inspeccionar un test no equivale a ejecutarlo.
5. Datos: preservar propiedad por usuario, BOB y dos decimales exactos, zona America/La_Paz y migraciones explícitas; las pruebas de integración usan PostgreSQL aislado.
6. Idioma: mantener identificadores y contratos existentes en inglés, documentación y mensajes propios en español; no renombrar interfaces por traducción.

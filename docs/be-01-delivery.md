# BE-01: persistencia y acceso autenticado

## Base dependiente autorizada

origin/dev al preparar BE-00: 76cfc459911c2149569988febf9c9e1f2b56be45. El arranque NestJS no esta integrado en esa rama: BE-01 parte de chore/backend-startup cbc25c061053193ae655d0b5f4ea489a1281b406, mas cherry-picks de los commits propios BE-00 e04d4d9 y 665a6df, que en esta rama son 90dc096 y 65aa228. Base exacta antes de implementar BE-01: 65aa2288053680d39626f55d7877eb0c54559f7d.

El usuario aprobo expresamente esta rama dependiente el 2026-10-18. No se hizo merge ni se publico dev/qa/main. El diff contra dev incluye arranque y contrato; revisar implementacion BE-01 contra su base exacta y coordinar integracion de prerrequisitos por separado. BE-00 conserva su rama y worktree propios.

Durante la entrega origin/dev avanzo externamente a bbed2677d3057a251b8a2b0d6164eb741c013f11 al integrar BE-00 en PR #3. El contrato permanece identico a la version integrada para evitar conflicto add/add de los cherry-picks; las precisiones de implementacion se registran aqui y en arquitectura. PR BE-01: https://github.com/clauOrellanaA/fintrackBackend/pull/4 . La integracion efectiva de arranque en dev sigue pendiente; este agente no la realiza.

## Entrega y limites

DataSource TypeORM, migracion de users/sessions/categories/transactions, apertura monetaria explicita, FK compuestas por propietario, validacion de fechas y devoluciones, seed local reproducible para dos usuarios, passwords scrypt N=131072 r=8 p=1, sesiones aleatorias 256 bits con hashes persistidos/TTL8h/revocacion. Controlador dashboard protegido y periodo semiabierto con zona IANA. No hay datos financieros falsos: las secciones siguen notAvailable. Registro publico y CRUD completos quedan fuera de alcance.

D01 se implementa con NUMERIC sin typmod y CHECK(scale<=2, valor absoluto<=999999999999.99): capacidad equivalente a NUMERIC(14,2), conservando rechazo de exceso decimal. NUMERIC(14,2) redondearia antes del CHECK, por eso se usan restricciones explicitas en la migracion sin cambiar moneda, escala ni limites aprobados. D07 concreta TypeORM 0.3.31 y Luxon 3.7.2 fijados en package-lock.

Migraciones y seed solo mediante comandos explicitos; produccion no acepta seed. Ninguna prueba modifica la base local del usuario. El test crea y elimina su propia base con nombre aleatorio dentro de una instancia aislada y exige configuracion dedicada.

## Verificacion

Node 24.15.0 y PostgreSQL 17 aislado en Docker, puerto 16432. Suite `npm test`: ocho tests aprobados, cero fallos y cero omitidos: intervalos IANA/historicos y meses invalidos; login/contrato/cache; token ausente/malformado/expirado/revocado; dashboard protegido; dos usuarios consultados mediante identidad real de sesion; integridad SQL y cambios incompatibles; migraciones sobre vacio, repeticion, rollback y reaplicacion; seed repetible y rechazo en produccion.

TypeORM 0.3.28 fue reemplazado por 0.3.31 al identificar npm audit una correccion compatible; instalacion final informa cero vulnerabilidades. Validacion final: npm ci --prefer-offline --no-audit --fetch-retries=0, npm run lint, npm run typecheck y npm test (incluye build) aprobados. Docker Compose config validado con .env.example y OpenAPI JSON verificado con limites de periodo. CI incorpora PostgreSQL aislado y ejecuta la suite real; no se afirma CI remota aprobada.

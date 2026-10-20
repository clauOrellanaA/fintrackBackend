# Hooks de Codex — backend

Configuración del repositorio en `.codex/hooks.json`, compartida por dashboard (módulo 1) y transacciones/categorías (módulo 2). En Windows se invocan mediante `py -3`; en otros sistemas, `python3`.

## Automatizaciones

- `proteger_archivos.py`, en `PreToolUse` de `apply_patch`, bloquea cambios a `tests/`, `__tests__`, `*.test.*`, `*.spec.*` y archivos `.env*`, excepto `.env.example`.
- `bloquear_comandos.py`, en `PreToolUse`, rechaza operaciones destructivas y push forzado. Antes de un push exige rama `feature/`, `fix/` o `chore/` y ejecuta build/pruebas de dashboard y transacciones. Los pushes directos a `main`, `dev` y `qa` se bloquean.
- `ejecutar_tests.py`, en `PostToolUse` de `apply_patch`, ejecuta `npm test` cuando `TEST_DATABASE_URL` está configurada para la base aislada `fintrack_be01_test`. En caso contrario ejecuta `npm run build` y las pruebas contract/period; no lee `.env`, crea bases ni ejecuta migraciones/seed de desarrollo.
- `auditoria.py`, en `PostToolUse` y `SubagentStop`, guarda fecha, evento, herramienta y, para parches, solo los nombres de archivos. No registra comandos ni contenido del parche.

El registro local `.codex/auditoria.log` no se versiona (`*.log`). Los hooks no sustituyen CI: GitHub Actions sigue ejecutando la suite completa con PostgreSQL.

## Validación

2026-10-19: se reemplazaron los scripts JavaScript previos. El hook Python bloqueó la edición de una prueba y `DROP DATABASE`, permitió `.env.example`, y ejecutó correctamente build más contract/period. Se comprobó que el auditor no registra el contenido del parche y que el push de feature ejecuta y pasa su gate. No se ejecutó la suite PostgreSQL de integración porque no se configuró `TEST_DATABASE_URL`.

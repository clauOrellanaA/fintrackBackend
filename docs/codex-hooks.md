# Hooks de Codex — backend

Configuración del repositorio en `.codex/hooks.json`. En Windows los scripts se invocan mediante `py -3`; en otros sistemas, `python3`.

## Automatizaciones

- `proteger_archivos.py`, en `PreToolUse` de `apply_patch`, bloquea cambios a `tests/`, `__tests__`, `*.test.*`, `*.spec.*` y archivos `.env*`, excepto `.env.example`.
- `detectar_credenciales.py`, también en `PreToolUse` de `apply_patch`, busca claves de proveedores conocidas y encabezados de llaves privadas en las líneas añadidas. Bloquea el parche sin imprimir los valores detectados; los placeholders y las líneas eliminadas no disparan el hook.
- `bloquear_comandos.py`, en `PreToolUse`, rechaza operaciones destructivas y push forzado. Antes de un push exige rama `feature/`, `fix/` o `chore/` y ejecuta el gate de pruebas de dashboard, transacciones y presupuestos. Los pushes directos a `main`, `dev` y `qa` se bloquean.
- `ejecutar_tests.py`, en `PostToolUse` de `apply_patch`, ejecuta `npm test` cuando `TEST_DATABASE_URL` está configurada para la base aislada `fintrack_be01_test`. En caso contrario ejecuta `npm run build` y las pruebas contract/period; no lee `.env`, crea bases ni ejecuta migraciones/seed de desarrollo.
- `auditoria.py`, en `PostToolUse` y `SubagentStop`, guarda fecha, evento, herramienta y, para parches, solo los nombres de archivos. No registra comandos ni contenido del parche.

El registro local `.codex/auditoria.log` no se versiona (`*.log`). Los hooks no sustituyen CI: GitHub Actions sigue ejecutando la suite completa con PostgreSQL.

## Validación

2026-10-19: se reemplazaron los scripts JavaScript previos. Se comprobaron directamente el bloqueo de edición de pruebas y `DROP DATABASE`, el paso de `.env.example`, build más contract/period, el registro sin contenido del parche y el gate de push.

2026-10-19: se añadió el escaneo de credenciales. Ejecuta `py -3 .codex/hooks/test_detectar_credenciales.py` para validar tokens conocidos, llaves privadas, placeholders y líneas eliminadas. También se amplió el gate previo a push para incluir presupuestos. Los tests unitarios y la invocación directa con un evento `PreToolUse` pasaron. La prueba real mediante Codex CLI no pudo ejecutar la herramienta de terminal en este entorno: Windows devolvió `CreateProcessAsUserW failed: 5 (Access is denied.)`; por ello, la activación end-to-end en el loop del agente queda sin confirmar.

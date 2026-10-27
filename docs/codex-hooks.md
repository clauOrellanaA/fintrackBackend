# Hooks de Codex — backend

Configuración del repositorio en `.codex/hooks.json`. En Windows se usa `py -3`; en otros sistemas, `python3`. Los launchers resuelven la raíz con `git rev-parse --show-toplevel`, por lo que también funcionan al iniciar Codex desde un subdirectorio. El runner ejecuta las comprobaciones desde la raíz Git; la auditoría guarda allí su registro local.

Los eventos usan el contrato canónico de Codex: `tool_name: "Bash"` para comandos, incluido unified exec, y `tool_name: "apply_patch"` para parches; ambos llevan el texto en `tool_input.command`.

Después de cambiar las definiciones de `hooks.json`, abre `/hooks` en Codex CLI y revisa y confía las definiciones nuevas o modificadas antes de usarlas; luego inicia una nueva sesión en el repositorio. La confianza depende del hash de cada definición y los hooks pendientes de revisión se omiten. Consulta la [documentación oficial de hooks](https://learn.chatgpt.com/docs/hooks).

## Automatizaciones

- `proteger_archivos.py`, en `PreToolUse` de `apply_patch`, bloquea cambios a `tests/`, `__tests__`, `*.test.*`, `*.spec.*` y archivos `.env*`, excepto `.env.example`. Inspecciona tanto las rutas originales como los destinos `Move to`, normaliza separadores y segmentos `..` y compara sin distinguir mayúsculas, de forma conservadora también fuera de Windows.
- `detectar_credenciales.py`, también en `PreToolUse` de `apply_patch`, busca claves de proveedores conocidas y encabezados de llaves privadas en las líneas añadidas. Bloquea el parche sin imprimir los valores detectados; los placeholders y las líneas eliminadas no disparan el hook.
- `bloquear_comandos.py`, en `PreToolUse`, rechaza operaciones destructivas y push forzado incluso con opciones globales de Git como `-C`. Antes de un push comprueba la rama del repositorio efectivo y cada destino: solo acepta `origin` y ramas explícitas `feature/`, `fix/` o `chore/`, por ejemplo `git push -u origin fix/be-hooks-review` o `git -C . push origin HEAD:refs/heads/fix/be-hooks-review`. Rechaza destinos protegidos, refspecs forzados, destinos implícitos, borrados y opciones `--all`/`--mirror`; también rechaza un `origin` configurado como mirror. Ejecuta las comprobaciones de `ejecutar_tests.py` antes de permitir el push.
- Para push se exige una única invocación Git directa, también válida con `& git` en PowerShell. Se rechazan wrappers de shell, expansiones, redirecciones y comandos compuestos no verificables. La opción global `-c` solo admite `core.quotepath` y `color.ui` en pushes. Estos hooks son una protección adicional con alcance acotado, no un parser universal de shell ni una frontera de seguridad completa.
- `ejecutar_tests.py`, en `PostToolUse` de `apply_patch`, ejecuta `npm test` cuando `TEST_DATABASE_URL` está configurada para la base aislada `fintrack_be01_test`. En caso contrario ejecuta `npm run build` y las pruebas contract/period; no lee `.env`, crea bases ni ejecuta migraciones/seed de desarrollo.
- `auditoria.py`, en `PostToolUse` y `SubagentStop`, guarda fecha, herramienta y, para parches, solo los nombres de archivos. No registra comandos ni contenido del parche.

El registro local `.codex/auditoria.log` no se versiona (`*.log`). Los hooks no sustituyen CI: GitHub Actions sigue ejecutando la suite completa con PostgreSQL.

## Validación

2026-10-19: se reemplazaron los scripts JavaScript previos. Se comprobaron directamente el bloqueo de edición de pruebas y `DROP DATABASE`, el paso de `.env.example`, build más contract/period, el registro sin contenido del parche y el gate de push.

2026-10-19: se añadió el escaneo de credenciales. Ejecuta `py -3 .codex/hooks/test_detectar_credenciales.py` para validar tokens conocidos, llaves privadas, placeholders y líneas eliminadas. También se amplió el gate previo a push para incluir presupuestos. Los tests unitarios y la invocación directa con un evento `PreToolUse` pasaron. La prueba real mediante Codex CLI no pudo ejecutar la herramienta de terminal en este entorno: Windows devolvió `CreateProcessAsUserW failed: 5 (Access is denied.)`; por ello, la activación end-to-end en el loop del agente queda sin confirmar.


2026-10-26: se corrigieron las rutas desde subdirectorios, la validación de opciones Git y destinos del push, y la protección de renombrados y variantes de mayúsculas de Windows. Se añadieron pruebas de regresión mediante la interfaz JSON/exit-code del hook y su ejecución en CI. Verificación local en Windows: 19 tests de hooks aprobados (16 nuevos y 3 de credenciales); los comandos peligrosos se enviaron solo como texto. Los tests de push simulan el runner de pruebas; no publican ramas ni acreditan integración PostgreSQL. También aprobaron lint, typecheck, build y los 5 tests contract/period. La activación completa dentro del agente y la CI remota deben verificarse por separado.

Desde la raíz del repositorio:

```powershell
py -3 -B -m unittest discover -s .codex/hooks -p "test_*.py" -v
```

En otros sistemas usa `python3` en lugar de `py -3`.

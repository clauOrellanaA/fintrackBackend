# FinanTrack - backend

Sistema web para la gestion y el control de finanzas personales.

Equipo **Cosa1ycosa2**: Luciana Salinas y Claudia Orellana.

## Estado

Base estructural sin codigo de aplicacion ni dependencias instaladas. No existen todavia scripts de desarrollo, compilacion o pruebas de la aplicacion. Los workflows validan la estructura y la higiene de Git.

## Arquitectura

Frontend: React + TypeScript + Vite, organizado en src/features.
Backend: Node.js + NestJS + TypeScript, organizado en src/modules.
Persistencia: PostgreSQL. Infraestructura prevista: Docker Compose.

Repositorios hermanos: ../fintrackFrontend y ../fintrackBackend. Cada uno tiene historial Git independiente. Los remotos de GitHub deben configurarse cuando se disponga de sus URLs.

Consultar [arquitectura](docs/architecture.md), [integracion](docs/integration.md) y [flujo Git](CONTRIBUTING.md).

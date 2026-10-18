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

Backend: modules contiene cada dominio; sus controladores, servicios y modulos NestJS se agregaran al implementar. dto contiene contratos de entrada y entities modelos del dominio. config concentra configuracion; database agrupa migraciones y seeds. El ORM queda pendiente de seleccion.

Las features no deben depender de detalles internos de otras features. Las operaciones financieras, validaciones y autorizacion pertenecen al backend. Toda consulta financiera debe restringirse al usuario autenticado. Las contrasenas se almacenaran con hash seguro en el backend.

El dinero se representara mediante decimales exactos en PostgreSQL y un contrato JSON explicito, evitando calculos monetarios con punto flotante. Moneda, zona horaria y reglas de redondeo se definiran antes de implementar.

No hay autenticacion, autorizacion ni reglas financieras implementadas en esta etapa.

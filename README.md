# Mi Centro para Vercel

Organizador personal creado con Next.js. Incluye:

- Matriz de prioridades Eisenhower.
- Proyectos con vista de tarjetas y cronograma.
- Avance automático según tareas completadas.
- Presupuesto mensual y registro de gastos.
- Descarga y restauración de respaldos JSON.
- Diseño adaptable para iPad, móvil y computadora.

Todos los datos se guardan únicamente en el `localStorage` del navegador. El proyecto no requiere una base de datos, una cuenta de usuario ni variables de entorno.

Consulta `GUIA_VERCEL.md` para publicarlo desde GitHub en Vercel.

## Desarrollo local

```bash
pnpm install
pnpm dev
```

## Verificación de producción

```bash
pnpm build
pnpm start
```


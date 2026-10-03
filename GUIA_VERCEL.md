# Mi Centro — publicación en Vercel

Este proyecto ya está preparado como una aplicación Next.js para Vercel. No necesita base de datos: guarda tareas, proyectos, gastos y presupuestos únicamente en el `localStorage` del navegador.

## Forma recomendada: GitHub + Vercel

1. Descomprime esta carpeta en tu escritorio.
2. Abre PowerShell dentro de la carpeta y crea el repositorio:

```powershell
git init
git add .
git commit -m "feat: mi centro para vercel"
gh repo create mi-centro --private --source=. --remote=origin --push
```

3. Entra en [vercel.com/new](https://vercel.com/new), importa el repositorio `mi-centro` y pulsa **Deploy**. No debes crear bases de datos ni variables de entorno.

## Probar en Windows antes de publicar

Necesitas Node.js 22.13 o posterior. En PowerShell:

```powershell
corepack enable
corepack prepare pnpm@11.25.0 --activate
pnpm install
pnpm dev
```

Los cambios se guardarán automáticamente en el navegador donde abras la app.

## Privacidad

Vercel solo sirve la aplicación; los datos nunca se envían a Vercel ni a una base externa. Cada navegador y dispositivo mantiene una copia independiente. Borrar los datos del navegador elimina esa copia local.

## Respaldo

Para usar la información en otro dispositivo, descarga el respaldo JSON desde **Respaldo → Descargar respaldo**. En el otro dispositivo abre la app y usa **Cargar respaldo**. Es recomendable descargar una copia periódicamente y antes de borrar datos del navegador.

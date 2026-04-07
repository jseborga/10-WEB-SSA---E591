# SSA Ingenieria | Next.js + Easypanel

Sitio web corporativo con:
- Next.js en modo `standalone`
- Prisma + SQLite
- Panel admin protegido por password
- Chat configurable con IA o WebSocket
- Soporte multiidioma

## Deploy recomendado

La forma correcta de desplegar este proyecto es:
- fuente `Git`
- build `Dockerfile`
- volumen persistente para `/app/data`

No hace falta instalar dependencias manualmente en el servidor.
El `Dockerfile` ya hace esto durante el build:
- instala `bun`
- instala dependencias principales
- instala dependencias del `chat-service`
- genera cliente Prisma
- compila Next.js

## Easypanel

En Easypanel crea un servicio `App` desde tu repositorio Git y usa:
- `Build Type`: `Dockerfile`
- `Dockerfile Path`: `Dockerfile`
- `Port`: `3000`

Agrega un volumen:
- `Mount Path`: `/app/data`

Variables obligatorias:

```env
DATABASE_URL=file:/app/data/custom.db
NODE_ENV=production
ADMIN_PASSWORD=TU_PASSWORD_ADMIN
ADMIN_SESSION_SECRET=TU_SECRETO_LARGO
```

Variables opcionales para chat IA:

```env
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GEMINI_API_KEY=
OPENAI_COMPAT_API_KEY=
OPENAI_COMPAT_BASE_URL=
NEXT_PUBLIC_CHAT_SOCKET_URL=
NEXT_PUBLIC_CHAT_SOCKET_PATH=
```

Notas:
- si activas IA desde el panel admin, configura proveedor, modelo y clave
- si no activas IA, el widget puede usar WebSocket si defines `NEXT_PUBLIC_CHAT_SOCKET_URL`
- si no defines socket y tampoco IA, el chat no tendrá backend conversacional real

## Primer arranque

Al iniciar el contenedor:
- se ejecuta `prisma db push`
- se crea o actualiza la base SQLite en `/app/data/custom.db`
- se levanta Next.js
- se intenta levantar el mini servicio de chat en segundo plano

## Desarrollo local

```bash
bun install
bun run db:generate
bun run db:push
bun run dev
```

## Build local

```bash
bun run build
bun run lint
```

## Seguridad

- el panel admin ya no es publico sin password
- las rutas de escritura y lectura sensible requieren sesion admin
- define siempre `ADMIN_PASSWORD` y `ADMIN_SESSION_SECRET` en produccion

# SSA Ingeniería — sitio web en Cloudflare

Sitio corporativo y panel de administración en **Next.js 16** desplegado en **Cloudflare Workers** (OpenNext):

| Pieza | Servicio de Cloudflare |
| --- | --- |
| Aplicación (páginas, API, panel) | Workers |
| Base de datos | D1 (SQLite) vía Prisma |
| Fotos, vídeos y backups | R2 |
| Variantes de imagen (portadas, redes) | Images |

No hay servidor, Docker ni volúmenes que mantener.

## Panel de administración (`/admin`)

- **Inicio**: resumen, contactos nuevos y accesos rápidos.
- **Publicaciones**: editor simple con portada, galería, vista previa, traducciones y SEO con IA.
- **Fotos y medios**: biblioteca en R2 y editor de fotos (recorte, luz, color, filtros, antes/después) que nunca sobrescribe el original. Mejora con **Gemini (Google AI Studio)**.
- **Redes sociales**: conecta una página de Facebook con su cuenta de Instagram y trae los posts como publicaciones.
- **Integraciones**: clave de Google AI Studio y modelo de imagen.
- **Proyectos y ajustes**: el panel clásico (proyectos, sitio, CRM, chat, Telegram, backups/migración).

## Requisitos

- Cuenta de Cloudflare. Se recomienda **Workers Paid (5 USD/mes)**: el plan gratuito limita el CPU por petición a 10 ms, poco para renderizar páginas con Next.js.
- Node 20+ y `bun` (o npm).

## Despliegue (primera vez)

```bash
bun install
npx wrangler login

# 1. Crear la base y el bucket
npx wrangler d1 create ssa-web          # copia el database_id en wrangler.jsonc
npx wrangler r2 bucket create ssa-web-media

# 2. Crear las tablas
bun run db:migrate:remote

# 3. Secretos (se piden por consola, no quedan en el repo)
npx wrangler secret put ADMIN_PASSWORD          # 12+ caracteres
npx wrangler secret put ADMIN_SESSION_SECRET    # openssl rand -hex 32

# 4. Publicar
bun run deploy
```

Después, en el panel de Cloudflare: **Workers → ssa-web → Settings → Domains & Routes** para usar tu dominio, y actualiza `SITE_URL` en `wrangler.jsonc` (o la URL del sitio en el panel).

Cloudflare Images debe estar habilitado en la cuenta (Images → Overview) para las variantes de portada.

### Despliegue automático desde GitHub

En **Workers & Pages → Create → Import a repository**, elige este repositorio con:

- Build command: `bun run cf:build`
- Deploy command: `npx opennextjs-cloudflare deploy`

## Migrar los datos del servidor anterior

1. En el sitio antiguo: **Admin → Migración → Generar backup** y descarga el `.tar`.
2. En el sitio nuevo: **Admin → Proyectos y ajustes → Migración → Importar** y sube ese archivo. Restaura la base en D1 y sube todas las fotos/vídeos a R2 manteniendo las mismas URLs (`/api/media/...`).
3. En **Fotos y medios** pulsa **Sincronizar biblioteca** para que los archivos importados aparezcan en la biblioteca.
4. Si usabas Telegram, vuelve a pulsar **Sincronizar webhook** (ahora siempre se valida un secreto).

## Conectar Instagram y Facebook

Necesitas una **página de Facebook** con una **cuenta de Instagram profesional** vinculada.

1. Crea una app en [developers.facebook.com](https://developers.facebook.com) (tipo *Business*).
2. Con el **Explorador de la Graph API** genera un token con los permisos `pages_show_list`, `pages_read_engagement` e `instagram_basic`, y conviértelo en token de larga duración.
3. Pégalo en **Admin → Redes sociales → Conectar**. Desde ahí eliges posts y los importas como borrador o publicados.

## Google AI Studio (Gemini)

Crea una clave en [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) y pégala en **Admin → Integraciones**. Se usa para mejorar fotos en el editor y para textos/SEO. La clave nunca se devuelve al navegador.

## Desarrollo local

```bash
cp .dev.vars.example .dev.vars        # y rellena los valores
bun install
bun run db:migrate:local              # D1 local en .wrangler/
bun run preview                       # build de Workers + servidor local en http://localhost:8787
```

`bun run dev` arranca Next.js en modo desarrollo usando los bindings locales de D1/R2.

Cambios en el esquema: edita `prisma/schema.prisma`, genera el SQL con
`npx prisma migrate diff --from-schema <esquema-anterior> --to-schema prisma/schema.prisma --script > migrations/000N_nombre.sql`
y aplícalo con `bun run db:migrate:local` / `db:migrate:remote`.

## Seguridad

- Sesión del panel firmada (HMAC) con caducidad de 12 h verificada en el servidor; `ADMIN_SESSION_SECRET` es obligatorio y distinto de la contraseña.
- Límite de intentos de acceso y de mensajes al chat IA (por IP y sesión).
- Subidas con lista blanca de formatos (sin SVG); importación de URLs bloquea destinos internos.
- Claves de IA y token de Meta nunca se envían al navegador.
- Webhook de Telegram con secreto obligatorio.
- Cabeceras HSTS, `nosniff`, `X-Frame-Options` y `Referrer-Policy`.

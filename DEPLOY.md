# Deploy — Inspecta + PocketBase

La web es estática e **independiente** de PocketBase. El código habla siempre a
`/api` (mismo origen), así que **no cambia nada entre tu máquina y el VPS**.

## Desarrollo (tu máquina)

1. Corre un PocketBase local (Inspecta usa el puerto 8097):
   ```bash
   ./pocketbase serve --http=127.0.0.1:8097
   ```
2. Corre la app:
   ```bash
   npm run dev                   # Vite proxea /api → 127.0.0.1:8097
   ```
   (Si tu PocketBase usa otro puerto, ponlo en `.env.local` → `VITE_PB_URL`.)

Sin PocketBase corriendo, la app igual funciona 100% offline (Dexie).

## Producción (VPS) — el mismo binario sirve todo

1. Compila la web:
   ```bash
   npm run build                 # genera dist/
   ```
2. Copia `dist/*` dentro de `pb_public/` (junto al binario de PocketBase en el VPS).
3. Corre PocketBase con tu dominio (HTTPS automático):
   ```bash
   ./pocketbase serve inspecta.tudominio.cl
   ```
   Resultado en `https://inspecta.tudominio.cl`:
   - `/`        → la app (PWA)
   - `/api/...` → datos + fotos (mismo origen, sin configurar nada)
   - `/_/`      → panel admin de PocketBase

Correr como servicio (systemd) y backups: ver README / doc de PocketBase.

## Por qué "es fácil del otro lado"

El cliente PocketBase apunta a `'/'` (mismo origen). En dev eso se resuelve vía el
proxy de Vite; en prod, al servirse desde `pb_public/`, `/api` ya ES PocketBase.
El código de la app **no tiene URLs ni claves de backend** — nada que cambiar al mover.

## Usuarios y equipos

Las cuentas **no se crean desde la app** (el auto-registro está cerrado a propósito).
Crea la primera desde el panel `/_/`, o por CLI:

```bash
./pocketbase superuser upsert TU_EMAIL TU_CLAVE     # superusuario del panel
```

Los usuarios de la app se crean en `/_/` → colección `users`. Después, dentro de
Inspecta: **Equipo → Nuevo equipo** (quien lo crea queda como administrador) y
**invitar por email** a usuarios que ya existan, asignándoles rol.

Las migraciones de `pb_migrations/` se aplican solas al arrancar; cópialas junto al
binario en el VPS.

## Pendiente

- Motor de sync push/pull (Dexie ↔ PocketBase) + subida de fotos como archivo:
  implementado, falta probarlo contra un PocketBase con datos reales y varios
  usuarios concurrentes (la estrategia actual es "última escritura gana").
- El sync empuja **todo** lo local en cada corrida; con volumen conviene filtrar por
  `updated` y por equipo activo.

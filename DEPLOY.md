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

## Producción con Docker — `https://inspecta.jpreyes.cl`

Es lo mismo, empaquetado: `deploy/Dockerfile` compila la web con node y la copia a
`pb_public/` dentro de una imagen que solo lleva el binario de PocketBase.

```bash
docker compose -f deploy/docker-compose.yml up -d --build
```

En el VPS srv1134838 **no** se usa el HTTPS automático de PocketBase: ahí cloudflared
corre como servicio systemd con un solo túnel para todos los sitios del box, y es
Cloudflare quien pone el certificado. Así que PocketBase escucha HTTP plano y solo
publicamos el puerto local que el túnel enruta:

```
cloudflared (systemd) → 127.0.0.1:8094 → pocketbase:8090
```

En el dashboard de Zero Trust, el túnel lleva un public hostname `inspecta.jpreyes.cl`
→ HTTP → `localhost:8094`.

Notas de operación:

- Los datos viven en el volumen docker `inspecta_pb_data`. Respaldo:
  `docker compose -f deploy/docker-compose.yml exec pocketbase tar czf - -C /pb pb_data > backup.tar.gz`
- `pb_migrations/` se monta desde el repo, así que los cambios de esquema hechos en
  `/_/` quedan versionados.
- La web va **dentro de la imagen**: para publicar cambios del frontend hay que
  reconstruir (`up -d --build`), no basta con reiniciar.
- Las cuentas (superusuario del panel y usuario de la app) quedan en
  `deploy/credentials.env`, gitignored.

## Por qué "es fácil del otro lado"

El cliente PocketBase apunta a `'/'` (mismo origen). En dev eso se resuelve vía el
proxy de Vite; en prod, al servirse desde `pb_public/`, `/api` ya ES PocketBase.
El código de la app **no tiene URLs ni claves de backend** — nada que cambiar al mover.

## Pendiente

- Migración de colecciones PocketBase (projects, structures, inspections,
  findings + campo `photos` con thumbnails, tests) con reglas por dueño.
- Motor de sync push/pull (Dexie ↔ PocketBase) + subida de fotos como archivo.
  Se cablea y prueba contra un PocketBase real (local o del VPS).

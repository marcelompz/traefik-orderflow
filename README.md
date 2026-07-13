# Traefik — Ingress único (OrderFlow + Aieer + Axon)

Sustituye el **nginx del host** (`/etc/nginx`, systemd) y **certbot** por un solo
Traefik que termina TLS con Let's Encrypt (DNS-01 vía Cloudflare) y enruta todos
los ecosistemas por `Host`.

## Rutas configuradas (`dynamic/services.yml`)

| Dominio | Contenedor destino |
|---|---|
| `axon.pesallaccia.com` | `axon-production-workspace-1:3005` |
| `staging.axon.pesallaccia.com` | `axon-staging-workspace-1:3005` |
| `orderflow.pesallaccia.com`, `provecchio.com` | `orderflow-frontend-prod:80` (`/api`→`orderflow-backend-prod:3010`, `/webhook`→`orderflow-odoo-adapter-prod:3005`) |
| `staging.provecchio.com` | `orderflow_frontend:80` |
| `staging.aieer.pesallaccia.com` | `staging_frontend:80` (`/api`→`staging_backend:8000`) |

> Los contenedores de OrderFlow prod están caídos; darán 502 hasta levantarlos
> (mismo estado actual). El resto funciona igual que con nginx.

## 1. Despliegue inicial (no rompe nada)

```bash
# En el server:
mkdir -p /srv/traefik
# Copiar todo el contenido de este proyecto a /srv/traefik (scp desde local).

cd /srv/traefik
cp .env.example .env            # completar ACME_EMAIL y CF_DNS_API_TOKEN
touch acme.json && chmod 600 acme.json

# Red externa compartida
docker network create traefik-public

# Conectar los contenedores destino a la red de Traefik
for c in axon-production-workspace-1 axon-staging-workspace-1 \
         orderflow-frontend-prod orderflow-backend-prod orderflow-odoo-adapter-prod \
         orderflow_frontend staging_frontend staging_backend; do
  docker network connect traefik-public "$c" 2>/dev/null || true
done

# Construir y levantar Traefik
docker compose build
docker compose up -d
docker compose logs -f traefik
```

⚠️ **No arranca todavía si el puerto 80/443 sigue ocupado por el nginx del host.**
El paso de corte (abajo) detiene ese nginx.

## 2. Corte de tráfico (cutover)

```bash
# Respaldo rápido de la config del host nginx
cp -r /etc/nginx /root/nginx-backup-$(date +%F)

# Detener el nginx del host (libera 80/443) y arrancar Traefik
systemctl stop nginx
docker compose -f /srv/traefik/docker-compose.yml up -d

# Verificar
curl -vI https://axon.pesallaccia.com      # 200/301 + cert (staging = no confiable en browser)
docker exec traefik cat /letsencrypt/acme.json
```

## 3. Certificados: requisito Cloudflare

El challenge es **DNS-01 con Cloudflare**, así funciona aunque Cloudflare esté en
modo proxy (orange cloud) delante del origen. Necesitás:

- `CF_DNS_API_TOKEN`: token de API de Cloudflare con permiso **Edit zone DNS**
  (scope a la zona `pesallaccia.com`).
- Crearlo en: Cloudflare → My Profile → API Tokens → "Edit zone DNS".

Sin este token, Traefik corre pero **no emite certs** y el HTTPS falla.

## 4. Pasar a producción (LE real)

1. Confirmar que staging emite certs correctamente.
2. En `.env`: `ACME_CASERVER=https://acme-v02.api.letsencrypt.org/directory`
3. Borrar `acme.json` (o su sección) y recrearlo con 600.
4. `docker compose -f /srv/traefik/docker-compose.yml up -d` (re-crea certs prod).

## 5. Rollback

```bash
docker compose -f /srv/traefik/docker-compose.yml down
systemctl start nginx      # restaura el ingress anterior
```

Por eso conviene NO borrar `/etc/nginx` ni los compose de certbot hasta confirmar.

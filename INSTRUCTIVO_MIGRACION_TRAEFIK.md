# Instructivo de Migración de Nginx a Traefik v3

Este documento contiene la guía paso a paso para migrar el enrutamiento de todos los servicios del servidor `178.104.193.155` desde **Nginx** hacia **Traefik v3** con SSL automático (Let's Encrypt / Cloudflare DNS).

---

## 🌐 Resumen de Dominios y Puertos Mapeados

| Dominio | Servicio Destino | Tipo de Red |
| :--- | :--- | :--- |
| `aieer.cetisa.com.py` | `data_analysis_frontend:80` (Frontend)<br>`data_analysis_backend:8000` (`/api`, `/token`) | Docker (`traefik-public`) |
| `aieer-staging.cetisa.com.py`<br>`staging.aieer.pesallaccia.com` | `staging_frontend:80` (Frontend)<br>`staging_backend:8000` (`/api`, `/token`) | Docker (`traefik-public`) |
| `secure.pesallaccia.com` | `vaultwarden:80` (Web)<br>`vaultwarden:3012` (`/notifications/hub` WS) | Docker (`traefik-public`) |
| `capacitaciones.psicovital.com.py` | `host.docker.internal:8080` | Host local |
| `demo.pesallaccia.com` | `host.docker.internal:8038` | Host local |
| `vitalog.pesallaccia.com` | `host.docker.internal:8888` (`/` Mobile)<br>`host.docker.internal:3333` (`/web`) <br>`host.docker.internal:8000` (`/api`, `/docs`, `/openapi.json`) | Host local |

---

## 📋 Pasos para la Migración

### Paso 1: Conectar los contenedores Docker existentes a `traefik-public`

Ejecutar en la terminal del servidor:

```bash
docker network create traefik-public || true

# Conectar contenedores AIEER
docker network connect traefik-public data_analysis_frontend || true
docker network connect traefik-public data_analysis_backend || true

# Conectar Vaultwarden
docker network connect traefik-public vaultwarden || true
```

---

### Paso 2: Verificar la configuración dinámica de Traefik

El archivo dynamic/services.yml ya cuenta con las reglas para todos los dominios.

Para verificar los archivos de configuración:
```bash
cat /opt/traefik-orderflow/dynamic/services.yml
cat /opt/traefik-orderflow/docker-compose.yml
```

---

### Paso 3: Detener Nginx y ejecutar Traefik (Conmutación)

Para hacer el cambio sin pérdida de datos ni colisión de puertos:

```bash
# 1. Detener Nginx para liberar los puertos 80 y 443
systemctl stop nginx
systemctl disable nginx

# 2. Desplegar Traefik
cd /opt/traefik-orderflow
docker compose up -d

# 3. Verificar estado de los contenedores y logs de Traefik
docker compose ps
docker logs -f traefik
```

---

## ↩️ Plan de Reversión (Rollback en caso de emergencia)

Si requieres volver temporalmente a Nginx:

```bash
# 1. Detener Traefik
cd /opt/traefik-orderflow
docker compose down

# 2. Reactivar y levantar Nginx
systemctl enable nginx
systemctl start nginx
```

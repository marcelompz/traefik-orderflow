# Traefik como único ingress para todos los ecosistemas (OrderFlow, Aieer, Axon).
# Reemplaza el nginx del host + certbot.
#
# Configuración estática montada como volumen (./traefik.yml) para poder
# editarla sin reconstruir la imagen. La config dinámica (rutas) y acme.json
# también se montan como volumen.

FROM traefik:v3.3

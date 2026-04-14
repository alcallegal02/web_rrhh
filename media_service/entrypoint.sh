#!/bin/sh
set -e

# Ajustar permisos de forma quirúrgica solo en el volumen de datos
# 777: Todos pueden leer, escribir y ejecutar (necesario para compartir volumen entre contenedores con distintos UID)
echo "Configurando entorno de seguridad para volúmenes..."
mkdir -p /media_data
chown -R mediauser:mediauser /media_data || echo "Warning: No se pudo cambiar dueño de /media_data (normal en Windows)"
chmod -R 777 /media_data || echo "Warning: No se pudo cambiar permisos de /media_data (normal en Windows)"

# su-exec es más seguro y eficiente que sudo/su en Docker (disponible en Alpine)
echo "Cediendo privilegios a mediauser y arrancando servicio..."
exec su-exec mediauser "$@"

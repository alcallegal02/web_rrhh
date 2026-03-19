#!/bin/sh
set -e

# Ajustar permisos de forma quirúrgica solo en el volumen de datos
# 775: Propietario(rwx), Grupo(rwx), Otros(r-x)
echo "Configurando entorno de seguridad para volúmenes..."
mkdir -p /media_data
chown -R mediauser:mediauser /media_data
chmod -R 775 /media_data

# Ejecutar el comando recibido (CMD) cambiando al usuario limitado 'mediauser'
# su-exec es más seguro y eficiente que sudo/su en Docker
echo "Cediendo privilegios a mediauser y arrancando servicio..."
exec su-exec mediauser "$@"

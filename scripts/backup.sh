#!/bin/sh

# Backup script for minimal disaster recovery
echo "Starting backup service..."

while true; do
    # Wait until 03:00 AM
    current_hour=$(date +%H)
    if [ "$current_hour" != "03" ]; then
        # Check every hour
        sleep 3600
        continue
    fi

    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="/backups/backup_${POSTGRES_DB}_${TIMESTAMP}.sql.gz"
    MEDIA_BACKUP="/backups/media_${TIMESTAMP}.tar.gz"

    echo "[$(date)] Creating DB Backup: $BACKUP_FILE"
    PGPASSWORD=$POSTGRES_PASSWORD pg_dump -h $POSTGRES_HOST -U $POSTGRES_USER $POSTGRES_DB | gzip > $BACKUP_FILE
    chmod 600 $BACKUP_FILE

    echo "[$(date)] Creating Media Backup: $MEDIA_BACKUP"
    # Backing up /media
    tar -czf $MEDIA_BACKUP /media 2>/dev/null
    chmod 600 $MEDIA_BACKUP

    # Rotate old backups (Keep last 3 days -> +2)
    echo "[$(date)] Cleaning old backups (Keep 3 days)..."
    find /backups -name "backup_*.sql.gz" -mtime +2 -delete
    find /backups -name "media_*.tar.gz" -mtime +2 -delete
    # Clean legacy naming if exists
    find /backups -name "uploads_*.tar.gz" -mtime +2 -delete

    echo "[$(date)] Backup completed. Sleeping..."
    # Sleep to avoid repeating in the same hour window
    sleep 3700 
done

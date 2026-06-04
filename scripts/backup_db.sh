#!/bin/bash

# ==========================================
# Script de Sauvegarde Automatique MySQL
# ==========================================

# Variables
DB_USER="admin_stock"
DB_PASSWORD="votre_mot_de_passe"
DB_NAME="gestion_stock_db"
BACKUP_DIR="/var/backups/gestion_stock"
DATE=$(date +"%Y-%m-%d_%H-%M-%S")
FILENAME="backup_${DB_NAME}_${DATE}.sql.gz"

# Créer le dossier de sauvegarde s'il n'existe pas
mkdir -p ${BACKUP_DIR}

echo "Démarrage de la sauvegarde..."

# 1. Création de l'export de la base de données et compression
# (Si vous utilisez Docker, la commande sera légèrement différente : docker exec gestion_stock_db mysqldump...)
mysqldump -u ${DB_USER} -p${DB_PASSWORD} ${DB_NAME} | gzip > ${BACKUP_DIR}/${FILENAME}

echo "Sauvegarde locale réussie : ${BACKUP_DIR}/${FILENAME}"

# ==========================================
# 2. ENVOI VERS L'EXTÉRIEUR (Exemples)
# Décommentez (enlevez le #) la méthode que vous utilisez
# ==========================================

# EXEMPLE A : Envoi vers Amazon S3 (Nécessite AWS CLI installé et configuré)
# aws s3 cp ${BACKUP_DIR}/${FILENAME} s3://votre-bucket-sauvegarde/gestion-stock/

# EXEMPLE B : Envoi vers Google Drive (Nécessite Rclone installé et configuré)
# rclone copy ${BACKUP_DIR}/${FILENAME} mon_drive_google:DossierSauvegardes/

# EXEMPLE C : Envoi vers un autre serveur via SCP/SSH
# scp ${BACKUP_DIR}/${FILENAME} utilisateur@autre_serveur:/dossier/sauvegardes/

# ==========================================
# 3. Nettoyage : Garder uniquement les 7 derniers jours sur le VPS
# ==========================================
find ${BACKUP_DIR} -type f -name "*.sql.gz" -mtime +7 -exec rm {} \;

echo "Sauvegarde terminée."

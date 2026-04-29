const fs = require('fs');
const path = require('path');

const BACKUP_DIR = 'C:\\GestionStock_Backups';
const DB_FILE = path.join(__dirname, 'database.db');

/**
 * Effectue une sauvegarde de la base de données si elle n'a pas encore été faite aujourd'hui.
 */
const performBackup = () => {
  try {
    // S'assurer que le dossier de sauvegarde existe
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
      console.log(`[BACKUP] Dossier de sauvegarde créé : ${BACKUP_DIR}`);
    }

    const today = new Date().toISOString().split('T')[0]; // Format YYYY-MM-DD
    const backupFile = path.join(BACKUP_DIR, `backup_${today}.db`);

    // Ne pas refaire la sauvegarde si elle existe déjà pour aujourd'hui
    if (fs.existsSync(backupFile)) {
      console.log(`[BACKUP] La sauvegarde du jour (${today}) est déjà présente.`);
      return;
    }

    // Copier le fichier de la base de données
    fs.copyFileSync(DB_FILE, backupFile);
    console.log(`[BACKUP] Succès ! Base de données sauvegardée sous : ${backupFile}`);

    // Nettoyer les anciennes sauvegardes (conserver les 30 dernières)
    cleanOldBackups();
  } catch (error) {
    console.error(`[BACKUP] Erreur critique lors de la sauvegarde automatique :`, error.message);
  }
};

/**
 * Supprime les anciennes sauvegardes pour ne garder que les 30 plus récentes.
 */
const cleanOldBackups = () => {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(file => file.startsWith('backup_') && file.endsWith('.db'))
      .map(file => ({
        name: file,
        time: fs.statSync(path.join(BACKUP_DIR, file)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time); // Plus récent au plus ancien

    const MAX_BACKUPS = 30;
    if (files.length > MAX_BACKUPS) {
      const foldersToRemove = files.slice(MAX_BACKUPS);
      foldersToRemove.forEach(file => {
        fs.unlinkSync(path.join(BACKUP_DIR, file.name));
        console.log(`[BACKUP] Ancienne sauvegarde supprimée : ${file.name}`);
      });
    }
  } catch (error) {
    console.error(`[BACKUP] Erreur lors du nettoyage des anciennes sauvegardes :`, error.message);
  }
};

module.exports = { performBackup };

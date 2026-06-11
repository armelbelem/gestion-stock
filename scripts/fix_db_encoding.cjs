const mysql = require('mysql2/promise');

// Chargement de la configuration de la base de données
const dbConfig = process.env.DATABASE_URL || {
  host: process.env.MYSQLHOST || process.env.DB_HOST || 'localhost',
  user: process.env.MYSQLUSER || process.env.DB_USER || 'root',
  password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || '',
  database: process.env.MYSQLDATABASE || process.env.DB_NAME || 'gestion_stock_db',
  port: process.env.MYSQLPORT || process.env.DB_PORT || 3306,
};

async function runRepair() {
  console.log('🔌 Connexion à la base de données...');
  const connection = await mysql.createConnection(typeof dbConfig === 'string' ? dbConfig : {
    ...dbConfig,
    charset: 'utf8mb4'
  });

  try {
    // 1. Récupérer toutes les tables et colonnes textuelles
    const [columns] = await connection.query(`
      SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND DATA_TYPE IN ('varchar', 'text', 'mediumtext', 'longtext', 'enum')
    `);

    console.log(`🔍 Analyse de ${columns.length} colonnes textuelles...`);

    for (const col of columns) {
      const { TABLE_NAME, COLUMN_NAME, DATA_TYPE } = col;

      // Compter s'il y a des caractères corrompus (contenant 'Ã')
      const [countRows] = await connection.query(`
        SELECT COUNT(*) as count FROM \`${TABLE_NAME}\` 
        WHERE \`${COLUMN_NAME}\` LIKE '%Ã%'
      `);

      const count = countRows[0].count;
      if (count > 0) {
        console.log(`⚠️  Table "${TABLE_NAME}", Colonne "${COLUMN_NAME}" (${DATA_TYPE}) : ${count} ligne(s) corrompue(s) trouvée(s).`);

        if (DATA_TYPE === 'enum') {
          // Les colonnes ENUM doivent être modifiées au niveau de la structure de la table
          // (Notre script principal gère déjà la colonne status de contract_orders)
          continue;
        }

        // Réparation automatique pour les colonnes VARCHAR/TEXT (Double encodage UTF-8)
        console.log(`   🔧 Réparation en cours pour \`${TABLE_NAME}\`.\`${COLUMN_NAME}\`...`);
        try {
          await connection.query(`
            UPDATE \`${TABLE_NAME}\` 
            SET \`${COLUMN_NAME}\` = CONVERT(BINARY CONVERT(\`${COLUMN_NAME}\` USING latin1) USING utf8mb4)
            WHERE \`${COLUMN_NAME}\` LIKE '%Ã%'
          `);
          console.log(`   ✅ Réparation réussie !`);
        } catch (err) {
          console.error(`   ❌ Échec de la réparation pour cette colonne :`, err.message);
        }
      }
    }

    console.log('\n🎉 Analyse et réparations terminées !');
  } catch (err) {
    console.error('❌ Erreur générale :', err.message);
  } finally {
    await connection.end();
  }
}

runRepair();

/**
 * SCRIPT DE MIGRATION VERS INNODB (ERP MINING AUTOLOG)
 * 
 * CE QUE FAIT CE SCRIPT :
 * - Se connecte à la base de données locale.
 * - Récupère dynamiquement toutes les tables utilisant le moteur MyISAM.
 * - Les convertit une à une vers le moteur transactionnel InnoDB.
 * - Confirme la réussite de l'opération en listant les tables migrées.
 */

import mysql from 'mysql2/promise';

// Configuration de la base de données
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gestion_stock_db',
  port: parseInt(process.env.DB_PORT) || 3306,
};

async function runMigration() {
  console.log('--- DEBUT DE LA MIGRATION VERS INNODB ---');
  console.log(`Connexion à la base : "${dbConfig.database}" sur ${dbConfig.host}:${dbConfig.port}...`);
  
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('✔ Connexion établie avec succès.');

    // 1. Récupérer toutes les tables MyISAM de la base de données
    const query = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = ? AND engine = 'MyISAM'
    `;
    const [tables] = await connection.query(query, [dbConfig.database]);
    
    if (tables.length === 0) {
      console.log('✔ Aucune table MyISAM trouvée. Toutes vos tables utilisent déjà InnoDB ou un autre moteur !');
      return;
    }

    console.log(`Découverte de ${tables.length} table(s) utilisant MyISAM. Début de la migration...`);
    console.log('------------------------------------------------');

    // 2. Convertir chaque table vers InnoDB
    for (const row of tables) {
      const tableName = row.TABLE_NAME || row.table_name;
      try {
        console.log(`⏳ Migration de la table "${tableName}" vers InnoDB...`);
        await connection.query(`ALTER TABLE \`${tableName}\` ENGINE=InnoDB`);
        console.log(`✔ Table "${tableName}" migrée avec succès.`);
      } catch (err) {
        console.error(`❌ Échec de la migration pour la table "${tableName}" :`, err.message);
      }
    }

    console.log('------------------------------------------------');
    
    // 3. Double vérification finale
    const [remainingTables] = await connection.query(query, [dbConfig.database]);
    if (remainingTables.length === 0) {
      console.log('🎉 SUCCÈS : Toutes les tables ont été migrées vers InnoDB avec succès !');
      console.log('Les transactions (COMMIT/ROLLBACK) et les verrous de ligne sont maintenant 100% opérationnels.');
    } else {
      console.warn(`⚠️ ATTENTION : Il reste ${remainingTables.length} table(s) en MyISAM.`);
    }
    console.log('------------------------------------------------');

  } catch (error) {
    console.error('❌ ERREUR CRITIQUE lors de la migration :', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Connexion fermée.');
    }
  }
}

runMigration();

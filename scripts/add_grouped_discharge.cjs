const mysql = require('mysql2/promise');

async function migrate() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'gestion_stock_db',
    port: 3306,
  });

  console.log('🔌 Connecté à la base de données.');

  try {
    // 1. Créer la table grouped_discharges (historique des décharges groupées)
    console.log('📦 Création de la table grouped_discharges...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS grouped_discharges (
        id VARCHAR(100) NOT NULL PRIMARY KEY,
        discharge_number VARCHAR(50) NOT NULL,
        client_id INT NOT NULL,
        client_name VARCHAR(255) DEFAULT NULL,
        partner_id VARCHAR(100) DEFAULT NULL,
        partner_name VARCHAR(255) DEFAULT NULL,
        delivery_ids JSON DEFAULT NULL,
        items JSON DEFAULT NULL,
        notes TEXT DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR(100) DEFAULT NULL,
        KEY idx_gd_client (client_id),
        KEY idx_gd_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ Table grouped_discharges créée (ou existait déjà).');

    // 2. Ajouter la colonne grouped_discharge_id sur la table deliveries
    console.log('📦 Ajout de la colonne grouped_discharge_id à deliveries...');
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'deliveries' AND COLUMN_NAME = 'grouped_discharge_id'
    `);

    if (columns.length === 0) {
      await connection.query(`
        ALTER TABLE deliveries ADD COLUMN grouped_discharge_id VARCHAR(100) DEFAULT NULL
      `);
      console.log('✅ Colonne grouped_discharge_id ajoutée à deliveries.');
    } else {
      console.log('ℹ️  Colonne grouped_discharge_id existe déjà dans deliveries.');
    }

    console.log('\n🎉 Migration terminée avec succès !');
  } catch (err) {
    console.error('❌ Erreur lors de la migration:', err.message);
  } finally {
    await connection.end();
  }
}

migrate();

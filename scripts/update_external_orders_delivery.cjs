const mysql = require('mysql2/promise');

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gestion_stock_db',
    port: parseInt(process.env.DB_PORT) || 3306,
  });

  console.log('🔌 Connecté à la base de données.');

  try {
    // 1. Ajouter la colonne quantity_delivered sur la table external_order_items
    console.log('📦 Ajout de la colonne quantity_delivered à external_order_items...');
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'external_order_items' AND COLUMN_NAME = 'quantity_delivered'
    `);

    if (columns.length === 0) {
      await connection.query(`
        ALTER TABLE external_order_items ADD COLUMN quantity_delivered INT DEFAULT 0
      `);
      console.log('✅ Colonne quantity_delivered ajoutée à external_order_items.');
    } else {
      console.log('ℹ️  Colonne quantity_delivered existe déjà dans external_order_items.');
    }

    // 2. Créer la table external_deliveries
    console.log('📦 Création de la table external_deliveries...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS external_deliveries (
        id VARCHAR(100) NOT NULL PRIMARY KEY,
        external_order_id VARCHAR(36) NOT NULL,
        bl_number VARCHAR(100) NOT NULL,
        items JSON NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR(100) DEFAULT NULL,
        KEY idx_ed_order (external_order_id),
        CONSTRAINT fk_external_deliveries_order FOREIGN KEY (external_order_id) REFERENCES external_orders(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ Table external_deliveries créée (ou existait déjà).');

    console.log('\n🎉 Migration terminée avec succès !');
  } catch (err) {
    console.error('❌ Erreur lors de la migration:', err.message);
  } finally {
    await connection.end();
  }
}

migrate();

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
    console.log('📦 Ajout de la colonne metadata à external_orders...');
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'external_orders' AND COLUMN_NAME = 'metadata'
    `);

    if (columns.length === 0) {
      await connection.query(`
        ALTER TABLE external_orders ADD COLUMN metadata JSON DEFAULT NULL
      `);
      console.log('✅ Colonne metadata ajoutée à external_orders.');
    } else {
      console.log('ℹ️  Colonne metadata existe déjà dans external_orders.');
    }

    console.log('\n🎉 Migration terminée avec succès !');
  } catch (err) {
    console.error('❌ Erreur lors de la migration:', err.message);
  } finally {
    await connection.end();
  }
}

migrate();

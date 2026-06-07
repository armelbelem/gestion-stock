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
    console.log('📦 Ajout des colonnes code et ref à external_order_items...');
    
    // Add 'code' column
    const [codeColumns] = await connection.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'external_order_items' AND COLUMN_NAME = 'code'
    `);
    if (codeColumns.length === 0) {
      await connection.query(`
        ALTER TABLE external_order_items ADD COLUMN code VARCHAR(100) DEFAULT NULL
      `);
      console.log('✅ Colonne code ajoutée à external_order_items.');
    } else {
      console.log('ℹ️  Colonne code existe déjà.');
    }

    // Add 'ref' column
    const [refColumns] = await connection.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'external_order_items' AND COLUMN_NAME = 'ref'
    `);
    if (refColumns.length === 0) {
      await connection.query(`
        ALTER TABLE external_order_items ADD COLUMN ref VARCHAR(100) DEFAULT NULL
      `);
      console.log('✅ Colonne ref ajoutée à external_order_items.');
    } else {
      console.log('ℹ️  Colonne ref existe déjà.');
    }

    console.log('\n🎉 Migration terminée avec succès !');
  } catch (err) {
    console.error('❌ Erreur lors de la migration:', err.message);
  } finally {
    await connection.end();
  }
}

migrate();

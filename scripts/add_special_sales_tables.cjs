const mysql = require('mysql2/promise');

async function migrate() {
  const dbConfig = process.env.DATABASE_URL || {
    host: process.env.MYSQLHOST || process.env.DB_HOST || 'localhost',
    user: process.env.MYSQLUSER || process.env.DB_USER || 'root',
    password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || '',
    database: process.env.MYSQLDATABASE || process.env.DB_NAME || 'gestion_stock_db',
    port: parseInt(process.env.MYSQLPORT || process.env.DB_PORT) || 3306,
  };

  const connection = await mysql.createConnection(dbConfig);

  console.log('🔌 Connecté à la base de données.');

  try {
    // 1. Create special_sales table
    console.log('📦 Création de la table special_sales...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS special_sales (
        id VARCHAR(36) PRIMARY KEY,
        clientName VARCHAR(255) NOT NULL,
        date DATETIME NOT NULL,
        notes TEXT,
        storeId VARCHAR(36) DEFAULT NULL,
        totalHT DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        tva DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        totalTTC DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        margin DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        status VARCHAR(50) NOT NULL DEFAULT 'termine',
        metadata JSON DEFAULT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✅ Table special_sales opérationnelle.');

    // 2. Create special_sale_items table
    console.log('📦 Création de la table special_sale_items...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS special_sale_items (
        id VARCHAR(36) PRIMARY KEY,
        specialSaleId VARCHAR(36) NOT NULL,
        ref VARCHAR(100) DEFAULT NULL,
        description VARCHAR(255) NOT NULL,
        quantity INT NOT NULL DEFAULT 1,
        purchasePrice DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        sellingPrice DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (specialSaleId) REFERENCES special_sales(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✅ Table special_sale_items opérationnelle.');

    // 3. Double check if metadata column exists in special_sales (just in case the table existed before)
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'special_sales' AND COLUMN_NAME = 'metadata'
    `);

    if (columns.length === 0) {
      await connection.query(`
        ALTER TABLE special_sales ADD COLUMN metadata JSON DEFAULT NULL
      `);
      console.log('✅ Colonne metadata ajoutée à special_sales.');
    }

    console.log('\n🎉 Migration des Ventes Spéciales terminée avec succès !');
  } catch (err) {
    console.error('❌ Erreur lors de la migration:', err.message);
  } finally {
    await connection.end();
  }
}

migrate();

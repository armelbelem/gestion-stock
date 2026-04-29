const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gestion_stock_db',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,
  charset: 'utf8mb4'
});

const initDb = async () => {
  const connection = await pool.getConnection();
  try {
    console.log('Synchronisation de la base avec encodage compatible...');
    
    // Forcer l'encodage de la session
    await connection.query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;");
    await connection.query('SET FOREIGN_KEY_CHECKS = 0;');

    const tables = {
      stores: `(
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        address TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      categories: `(
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        storeId VARCHAR(100)
      )`,
      articles: `(
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        categoryId VARCHAR(100) NOT NULL,
        price DOUBLE DEFAULT 0,
        minStock INT DEFAULT 0,
        barcode VARCHAR(255),
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        storeId VARCHAR(100)
      )`,
      inventory: `(
        id VARCHAR(100) PRIMARY KEY,
        storeId VARCHAR(100) NOT NULL,
        articleId VARCHAR(100) NOT NULL,
        quantity INT DEFAULT 0,
        minStock INT DEFAULT 0,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY store_article (storeId, articleId)
      )`,
      fournisseurs: `(
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(255),
        address TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      fiscal_years: `(
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        startDate DATETIME NOT NULL,
        endDate DATETIME,
        status ENUM('active', 'closed') DEFAULT 'active',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      mouvements: `(
        id VARCHAR(100) PRIMARY KEY,
        articleId VARCHAR(100) NOT NULL,
        supplierId VARCHAR(100),
        type ENUM('IN', 'OUT') NOT NULL,
        quantity INT NOT NULL,
        date DATETIME NOT NULL,
        notes TEXT,
        fiscalYearId VARCHAR(100),
        storeId VARCHAR(100)
      )`,
      clients: `(
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(255),
        address TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        storeId VARCHAR(100)
      )`,
      users: `(
        id VARCHAR(100) PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'admin',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        storeId VARCHAR(100)
      )`,
      sales: `(
        id VARCHAR(100) PRIMARY KEY,
        clientId VARCHAR(100) NOT NULL,
        userId VARCHAR(100) NOT NULL,
        totalAmount DOUBLE DEFAULT 0,
        discount DOUBLE DEFAULT 0,
        amountPaid DOUBLE DEFAULT 0,
        paymentType VARCHAR(50) DEFAULT 'complet',
        status VARCHAR(50) DEFAULT 'payé',
        dueDate DATETIME,
        notes TEXT,
        date DATETIME NOT NULL,
        fiscalYearId VARCHAR(100),
        storeId VARCHAR(100)
      )`,
      sale_items: `(
        id VARCHAR(100) PRIMARY KEY,
        saleId VARCHAR(100) NOT NULL,
        articleId VARCHAR(100) NOT NULL,
        quantity INT NOT NULL,
        unitPrice DOUBLE NOT NULL
      )`,
      payments: `(
        id VARCHAR(100) PRIMARY KEY,
        saleId VARCHAR(100) NOT NULL,
        amount DOUBLE NOT NULL,
        date DATETIME NOT NULL,
        notes TEXT,
        fiscalYearId VARCHAR(100),
        storeId VARCHAR(100)
      )`,
      transfers: `(
        id VARCHAR(100) PRIMARY KEY,
        articleId VARCHAR(100) NOT NULL,
        fromStoreId VARCHAR(100) NOT NULL,
        toStoreId VARCHAR(100) NOT NULL,
        quantity INT NOT NULL,
        userId VARCHAR(100) NOT NULL,
        date DATETIME DEFAULT CURRENT_TIMESTAMP,
        notes TEXT,
        status VARCHAR(50) DEFAULT 'complété'
      )`,
      logs: `(
        id VARCHAR(100) PRIMARY KEY,
        userId VARCHAR(100),
        action VARCHAR(255) NOT NULL,
        details TEXT,
        storeId VARCHAR(100),
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    };

    for (const [name, schema] of Object.entries(tables)) {
      await connection.query(`CREATE TABLE IF NOT EXISTS ${name} ${schema} ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
      // Forcer la conversion si la table existe déjà avec un mauvais encodage
      await connection.query(`ALTER TABLE ${name} CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    }

    // Initialisation Magasins
    const [existingStores] = await connection.query('SELECT * FROM stores');
    let defaultStoreId = '';
    if (existingStores.length === 0) {
      const storeNames = ['Magasin Central', 'Dépôt Nord', 'Boutique Sud', 'Point de Vente Est', 'Entrepôt Ouest'];
      for (const name of storeNames) {
        const sId = uuidv4();
        await connection.query('INSERT INTO stores (id, name) VALUES (?, ?)', [sId, name]);
        if (name === 'Magasin Central') defaultStoreId = sId;
      }
    } else {
      defaultStoreId = existingStores[0].id;
    }

    // Seed Admin
    const [admins] = await connection.query('SELECT * FROM users WHERE username = ?', ['admin']);
    if (admins.length === 0) {
      const hashedPassword = bcrypt.hashSync('admin123', 10);
      await connection.query('INSERT INTO users (id, username, password, role, storeId) VALUES (?, ?, ?, ?, ?)',
        [uuidv4(), 'admin', hashedPassword, 'admin', defaultStoreId]);
    }

    await connection.query('SET FOREIGN_KEY_CHECKS = 1;');
    console.log('Base de données MySQL synchronisée avec succès (UTF8MB4_UNICODE_CI).');
  } catch (err) {
    console.error('Erreur SQL:', err);
  } finally {
    connection.release();
  }
};

initDb();
module.exports = pool;

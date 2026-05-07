import mysql from 'mysql2/promise';

async function setup() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'gestion_stock_db',
    port: 3306
  });
  
  try {
    console.log("Creating documents table...");
    await connection.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id VARCHAR(191) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100),
        filePath VARCHAR(255) NOT NULL,
        fileType VARCHAR(50),
        fileSize INT,
        uploadedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        userId VARCHAR(191),
        notes TEXT,
        fiscalYearId VARCHAR(100)
      )
    `);
    console.log("Table created successfully.");
  } catch (err) {
    console.error(err.message);
  } finally {
    await connection.end();
  }
}

setup();

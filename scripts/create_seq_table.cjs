const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
  const pool = mysql.createPool({
    host: process.env.MYSQLHOST || 'localhost',
    user: process.env.MYSQLUSER || 'root',
    password: process.env.MYSQLPASSWORD || '',
    database: process.env.MYSQLDATABASE || 'gestion_stock_db',
    port: process.env.MYSQLPORT || 3306
  });

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS document_sequences (
        id varchar(50) NOT NULL,
        doc_type varchar(10) NOT NULL,
        doc_date date NOT NULL,
        last_sequence int(11) NOT NULL DEFAULT 0,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('Table created!');
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

run();

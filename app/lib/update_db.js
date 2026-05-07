import mysql from 'mysql2/promise';

async function update() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'gestion_stock_db',
    port: 3306
  });
  
  try {
    console.log("Adding tvaAmount column to sales table...");
    await connection.query("ALTER TABLE sales ADD COLUMN tvaAmount DOUBLE DEFAULT 0 AFTER discount");
    console.log("Column added successfully.");
  } catch (err) {
    if (err.code === 'ER_DUP_COLUMN_NAME') {
      console.log("Column already exists.");
    } else {
      console.error(err.message);
    }
  } finally {
    await connection.end();
  }
}

update();

import mysql from 'mysql2/promise';

async function check() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'gestion_stock_db',
    port: 3306
  });
  
  try {
    const [rows] = await connection.query("DESCRIBE sales");
    console.log(JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error(err.message);
  } finally {
    await connection.end();
  }
}

check();

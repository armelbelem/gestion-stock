import mysql from 'mysql2/promise';

async function checkLogs() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'gestion_stock_db'
  });

  try {
    const [rows] = await connection.query('DESCRIBE logs');
    console.log('Schema table logs :', rows);
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE') {
      console.log('La table logs n existe pas. Création...');
      await connection.query(`
        CREATE TABLE logs (
          id VARCHAR(36) PRIMARY KEY,
          userId VARCHAR(36),
          storeId VARCHAR(36),
          action VARCHAR(255),
          details TEXT,
          date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('Table logs créée.');
    } else {
      console.error(error);
    }
  } finally {
    await connection.end();
  }
}

checkLogs();

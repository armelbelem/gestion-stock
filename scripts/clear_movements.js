import mysql from 'mysql2/promise';

async function clearMovements() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'gestion_stock_db'
  });

  try {
    console.log('Suppression de tous les mouvements de stock...');
    await connection.query('TRUNCATE TABLE mouvements');
    console.log('Succès : Historique des mouvements vidé.');
  } catch (error) {
    console.error('Erreur :', error);
  } finally {
    await connection.end();
  }
}

clearMovements();

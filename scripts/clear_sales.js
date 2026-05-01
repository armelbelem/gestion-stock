import mysql from 'mysql2/promise';

async function clearSales() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'gestion_stock_db'
  });

  try {
    console.log('Début de la suppression des données de vente...');
    
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    
    await connection.query('TRUNCATE TABLE sale_items');
    console.log('- Table sale_items vidée');
    
    await connection.query('TRUNCATE TABLE payments');
    console.log('- Table payments vidée');
    
    await connection.query('TRUNCATE TABLE sales');
    console.log('- Table sales vidée');

    // Supprimer aussi les mouvements de stock de type 'OUT'
    await connection.query("DELETE FROM mouvements WHERE type = 'OUT'");
    console.log("- Mouvements de type 'OUT' supprimés");

    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    
    console.log('Succès : Toutes les ventes ont été supprimées.');
  } catch (error) {
    console.error('Erreur lors de la suppression :', error);
  } finally {
    await connection.end();
  }
}

clearSales();

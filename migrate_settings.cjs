const mysql = require('mysql2/promise');

async function migrate() {
  const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'gestion_stock_db',
    port: 3306,
  };

  const connection = await mysql.createConnection(dbConfig);
  
  try {
    console.log('Ajout des colonnes à la table settings...');
    
    const [columns] = await connection.query('SHOW COLUMNS FROM settings');
    const existingColumns = columns.map(c => c.Field);
    
    const newColumns = [
      { name: 'supervisorName', type: 'TEXT' },
      { name: 'supervisorTitle', type: 'TEXT' },
      { name: 'stampImage', type: 'LONGTEXT' },
      { name: 'signatureImage', type: 'LONGTEXT' }
    ];
    
    for (const col of newColumns) {
      if (!existingColumns.includes(col.name)) {
        await connection.query(`ALTER TABLE settings ADD COLUMN ${col.name} ${col.type}`);
        console.log(`✅ Colonne ${col.name} ajoutée.`);
      } else {
        console.log(`ℹ️ Colonne ${col.name} existe déjà.`);
      }
    }
    
    console.log('Migration terminée avec succès.');
  } catch (err) {
    console.error('Erreur lors de la migration:', err);
  } finally {
    await connection.end();
  }
}

migrate();

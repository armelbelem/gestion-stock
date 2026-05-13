import mysql from 'mysql2/promise';

async function migrate() {
  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gestion_stock_db',
    port: parseInt(process.env.DB_PORT) || 3306,
  };

  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('Ajout des colonnes de pied de page à la table settings...');
    
    const [columns] = await connection.query('SHOW COLUMNS FROM settings');
    const existingColumns = columns.map(c => c.Field);
    
    const newColumns = [
      { name: 'footerLine1', type: 'TEXT' },
      { name: 'footerLine2', type: 'TEXT' },
      { name: 'footerLine3', type: 'TEXT' },
      { name: 'footerLine4', type: 'TEXT' }
    ];
    
    for (const col of newColumns) {
      if (!existingColumns.includes(col.name)) {
        await connection.query(`ALTER TABLE settings ADD COLUMN ${col.name} ${col.type}`);
        console.log(`✅ Colonne ${col.name} ajoutée.`);
      } else {
        console.log(`ℹ️ Colonne ${col.name} existe déjà.`);
      }
    }
    
    // Initialiser les valeurs à partir des anciens champs pour ne pas perdre les données actuelles
    console.log('Synchronisation des données initiales...');
    await connection.query(`
      UPDATE settings SET 
        footerLine1 = taxSystem,
        footerLine2 = secondaryAddress,
        footerLine3 = footerMessage,
        footerLine4 = bankInfo
      WHERE id = 1
    `);
    
    console.log('Migration terminée avec succès.');
  } catch (err) {
    console.error('Erreur lors de la migration:', err);
  } finally {
    if (connection) await connection.end();
  }
}

migrate();

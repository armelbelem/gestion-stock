const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST || 'localhost',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'gestion_stock'
  });

  console.log('Ajout des colonnes de personnalisation des libellés...');

  try {
    const columns = [
      'bc_col_no', 'bc_col_site', 'bc_col_desc', 'bc_col_code', 'bc_col_ref', 'bc_col_qty', 'bc_col_price', 'bc_col_total',
      'bl_col_no', 'bl_col_site', 'bl_col_desc', 'bl_col_code', 'bl_col_ref', 'bl_col_qty'
    ];

    for (const col of columns) {
      try {
        await connection.query(`ALTER TABLE contract_partners ADD COLUMN ${col} VARCHAR(255) DEFAULT NULL`);
        console.log(`Colonne ${col} ajoutée.`);
      } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
          console.log(`Colonne ${col} existe déjà.`);
        } else {
          throw err;
        }
      }
    }

    console.log('Migration terminée avec succès !');
  } catch (error) {
    console.error('Erreur lors de la migration :', error);
  } finally {
    await connection.end();
  }
}

migrate();

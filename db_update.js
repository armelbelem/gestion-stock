import dbModule from './app/lib/db.js';

async function run() {
  const db = dbModule;
  try {
    await db.query('ALTER TABLE sale_items MODIFY articleId VARCHAR(255) NULL');
    console.log('Modified articleId');
  } catch (e) {
    console.log('Error altering sale_items articleId:', e.message);
  }
  
  try {
    await db.query('ALTER TABLE sale_items ADD COLUMN description VARCHAR(255) NULL');
    console.log('Added description');
  } catch (e) {
    console.log('Error altering sale_items description:', e.message);
  }
  
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS external_orders (
        id VARCHAR(36) PRIMARY KEY,
        clientId VARCHAR(36),
        supplierId VARCHAR(36),
        description VARCHAR(255),
        quantity INT,
        purchasePrice DECIMAL(10,2),
        sellPrice DECIMAL(10,2),
        status VARCHAR(50) DEFAULT 'en_attente',
        saleId VARCHAR(36) NULL,
        date DATETIME,
        storeId VARCHAR(36)
      )
    `);
    console.log('Created external_orders');
  } catch (e) {
    console.log('Error creating external_orders:', e.message);
  }
  process.exit(0);
}

run();

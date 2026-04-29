import dbModule from './app/lib/db.js';

async function run() {
  const db = dbModule;
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS external_order_items (
        id VARCHAR(36) PRIMARY KEY,
        externalOrderId VARCHAR(36),
        description VARCHAR(255),
        quantity INT,
        purchasePrice DECIMAL(10,2),
        sellPrice DECIMAL(10,2)
      )
    `);
    console.log('Created external_order_items');
  } catch (e) {
    console.log('Error creating external_order_items:', e.message);
  }
  process.exit(0);
}

run();

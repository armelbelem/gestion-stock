const mysql = require('mysql2/promise');

async function migrate() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'gestion_stock_db'
  });

  try {
    console.log('Starting migration for virtual sales (CFAO)...');
    
    // Get all sales from CFAO store
    const [sales] = await connection.query('SELECT * FROM sales WHERE storeId = "CFAO"');
    console.log(`Found ${sales.length} virtual sales.`);

    for (const sale of sales) {
      // Try to find the corresponding contract order to get the correct TVA rate
      // The saleId is usually 'C-' + orderId.substring(0,8)
      // We search for a contract_order whose ID starts with the same substring
      const orderSub = sale.id.replace('C-', '');
      const [orders] = await connection.query('SELECT * FROM contract_orders WHERE id LIKE ?', [orderSub + '%']);
      
      const order = orders[0];
      const tvaRate = order ? Number(order.tva_rate || 18) : 18;
      
      // If tvaAmount is already set and totalAmount seems TTC, skip
      // But based on user request, they are currently HT.
      if (sale.tvaAmount === 0 || !sale.tvaAmount) {
        const htAmount = sale.totalAmount;
        const tvaAmount = Math.round(htAmount * (tvaRate / 100));
        const ttcAmount = htAmount + tvaAmount;
        
        console.log(`Updating sale ${sale.id}: HT ${htAmount} -> TTC ${ttcAmount} (TVA ${tvaAmount} @ ${tvaRate}%)`);
        
        await connection.query(
          'UPDATE sales SET totalAmount = ?, tvaAmount = ?, amountPaid = ? WHERE id = ?',
          [ttcAmount, tvaAmount, ttcAmount, sale.id]
        );
      } else {
        console.log(`Sale ${sale.id} already has TVA. Skipping.`);
      }
    }

    console.log('Migration completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await connection.end();
  }
}

migrate();

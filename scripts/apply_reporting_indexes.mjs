import db from '../app/lib/db.js';

async function main() {
  try {
    console.log("Applying indexes for reporting...");
    
    // Index on sales date and userId
    await db.query("CREATE INDEX idx_sales_userid_date ON sales (userId, date)");
    
    // Index on users role
    await db.query("CREATE INDEX idx_users_role ON users (role)");
    
    // Index on sale_items
    await db.query("CREATE INDEX idx_saleitems_saleid ON sale_items (saleId)");

    console.log("Indexes applied successfully.");
    process.exit(0);
  } catch (error) {
    if (error.code === 'ER_DUP_KEYNAME') {
      console.log("Indexes already exist.");
      process.exit(0);
    }
    console.error("Error applying indexes:", error);
    process.exit(1);
  }
}

main();

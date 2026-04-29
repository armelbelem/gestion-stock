import dbModule from './app/lib/db.js';
import xlsx from 'xlsx';
import { v4 as uuidv4 } from 'uuid';

async function run() {
  const db = dbModule;
  try {
    const workbook = xlsx.readFile('Classeur1.XLSX');
    const sheet_name_list = workbook.SheetNames;
    // skip the first empty row by specifying range
    const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheet_name_list[0]], { range: 1 });
    
    console.log(`Found ${rows.length} rows to import`);
    
    // Default store id
    const [stores] = await db.query('SELECT id FROM stores LIMIT 1');
    const storeId = stores.length > 0 ? stores[0].id : uuidv4();
    
    if (stores.length === 0) {
      await db.query('INSERT INTO stores (id, name, location) VALUES (?, ?, ?)', [storeId, 'Magasin Principal', 'Dakar']);
      console.log('Created default store');
    }

    let importedCount = 0;
    
    for (const row of rows) {
      if (!row.name) continue;
      
      const id = row.id || uuidv4();
      const name = row.name;
      const price = parseFloat(row.price) || 0;
      const currentStock = parseInt(row.currentStock) || 0;
      const minStock = parseFloat(row.minStock) || 0; // Keeping it float as in excel
      const barcode = row.barcode ? String(row.barcode) : null;
      const code = row.code ? String(row.code) : null;
      const rowStoreId = row.storeId || storeId;
      
      // Check if article with same code/barcode/name exists? Let's just insert/update
      try {
        await db.query(`
          INSERT INTO articles (id, name, price, currentStock, minStock, barcode, storeId, code)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            price = VALUES(price),
            currentStock = VALUES(currentStock),
            minStock = VALUES(minStock),
            barcode = VALUES(barcode),
            code = VALUES(code)
        `, [id, name, price, currentStock, minStock, barcode, rowStoreId, code]);
        
        importedCount++;
        if (importedCount % 100 === 0) {
          console.log(`Imported ${importedCount} items...`);
        }
      } catch (err) {
        console.error(`Error importing row: ${name}`, err.message);
      }
    }
    
    console.log(`Successfully imported ${importedCount} items.`);
    
  } catch (e) {
    console.log('Error during import:', e.message);
  }
  process.exit(0);
}

run();

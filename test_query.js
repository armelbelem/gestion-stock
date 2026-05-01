import db from './app/lib/db.js';

async function test() {
    try {
        const query = `
          SELECT a.id, a.code, a.name, a.price, a.minStock, a.barcode, a.storeId, a.createdAt,
                 s.name as createdInStoreName,
                 COALESCE((
                   SELECT SUM(quantity) FROM inventory 
                   WHERE articleId = a.id 
                 ), 0) as currentStock,
                 (SELECT JSON_ARRAYAGG(JSON_OBJECT('storeName', s2.name, 'qty', i2.quantity))
                  FROM inventory i2 
                  JOIN stores s2 ON i2.storeId = s2.id 
                  WHERE i2.articleId = a.id) as storeDetails
          FROM articles a
          LEFT JOIN stores s ON a.storeId = s.id
          LIMIT 5
        `;
        const [rows] = await db.query(query);
        console.log(JSON.stringify(rows, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

test();

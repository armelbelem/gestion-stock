import { NextResponse } from 'next/server';
import db from '../../../lib/db';
import { authenticateToken } from '../../../lib/auth';
import { logAction } from '../../../lib/actions';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.user.role !== 'admin') return NextResponse.json({ error: 'Accès réservé aux administrateurs' }, { status: 403 });

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const { data, storeId: targetStoreId } = await request.json(); // Array of article objects + target store
    
    const storeId = targetStoreId || auth.user.storeId || 1;
    let updatedCount = 0;
    let createdCount = 0;

    for (const row of data) {
      const { id, code, name, price, currentStock, minStock, barcode } = row;
      if (!name) continue;
      
      let articleId = id;
      if (!articleId && (code || name || barcode)) {
        const [existing] = await connection.query(
          'SELECT id FROM articles WHERE code = ? OR name = ? OR (barcode IS NOT NULL AND barcode = ? AND barcode <> "") LIMIT 1',
          [code || '___NONE___', name || '___NONE___', barcode || '___NONE___']
        );
        if (existing.length > 0) articleId = existing[0].id;
      }

      if (articleId) {
        // UPDATE
        await connection.query(
          'UPDATE articles SET price = ?, minStock = ?, barcode = ?, code = ?, name = ? WHERE id = ?',
          [Number(price) || 0, Number(minStock) || 0, barcode || null, code || null, name, articleId]
        );
        
        // Update inventory for the SPECIFIC store
        // Check if inventory record exists for this store
        const [invExists] = await connection.query('SELECT quantity FROM inventory WHERE articleId = ? AND storeId = ?', [articleId, storeId]);
        
        if (invExists.length > 0) {
          await connection.query(
            'UPDATE inventory SET quantity = ? WHERE articleId = ? AND storeId = ?',
            [Number(currentStock) || 0, articleId, storeId]
          );
        } else {
          await connection.query(
            'INSERT INTO inventory (id, storeId, articleId, quantity, minStock) VALUES (?, ?, ?, ?, ?)',
            [uuidv4(), storeId, articleId, Number(currentStock) || 0, Number(minStock) || 0]
          );
        }
        
        updatedCount++;
      } else {
        // CREATE NEW
        const [result] = await connection.query(
          'INSERT INTO articles (code, name, price, currentStock, minStock, barcode, storeId) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [code || null, name, Number(price) || 0, Number(currentStock) || 0, Number(minStock) || 0, barcode || null, storeId]
        );
        const newId = result.insertId;
        await connection.query(
          'INSERT INTO inventory (id, storeId, articleId, quantity, minStock) VALUES (?, ?, ?, ?, ?)',
          [uuidv4(), storeId, newId, Number(currentStock) || 0, Number(minStock) || 0]
        );
        createdCount++;
      }
    }

    await logAction(auth.user.id, storeId, 'Import Excel de masse', { updated: updatedCount, created: createdCount });
    await connection.commit();
    
    return NextResponse.json({ success: true, updated: updatedCount, created: createdCount });
  } catch (err) {
    await connection.rollback();
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    connection.release();
  }
}

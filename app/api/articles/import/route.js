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
    const { data } = await request.json(); // Array of article objects from Excel
    
    let updatedCount = 0;
    let createdCount = 0;

    for (const row of data) {
      const { id, code, name, price, currentStock, minStock, barcode } = row;
      if (!name) continue; // Sécurité supplémentaire
      
      // Recherche par ID, ou Code, ou Nom, ou Code-barres
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
        
        // Update inventory for the main store
        await connection.query(
          'UPDATE inventory SET quantity = ? WHERE articleId = ?',
          [Number(currentStock) || 0, articleId]
        );
        
        updatedCount++;
      } else {
        // CREATE NEW if no ID/Code found
        const [result] = await connection.query(
          'INSERT INTO articles (code, name, price, currentStock, minStock, barcode, storeId) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [code || null, name, Number(price) || 0, Number(currentStock) || 0, Number(minStock) || 0, barcode || null, auth.user.storeId || 1]
        );
        const newId = result.insertId;
        await connection.query(
          'INSERT INTO inventory (id, storeId, articleId, quantity, minStock) VALUES (?, ?, ?, ?, ?)',
          [uuidv4(), auth.user.storeId || 1, newId, Number(currentStock) || 0, Number(minStock) || 0]
        );
        createdCount++;
      }
    }

    await logAction(auth.user.id, auth.user.storeId, 'Import Excel de masse', { updated: updatedCount, created: createdCount });
    await connection.commit();
    
    return NextResponse.json({ success: true, updated: updatedCount, created: createdCount });
  } catch (err) {
    await connection.rollback();
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    connection.release();
  }
}

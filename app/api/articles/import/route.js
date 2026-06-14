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
    const warnings = [];

    const cleanNum = (val) => {
      if (typeof val === 'number') return val;
      if (!val) return 0;
      // Supprimer espaces, remplacer virgule par point, supprimer symboles non numériques sauf le point
      const cleaned = String(val).replace(/\s/g, '').replace(/,/g, '.').replace(/[^0-9.]/g, '');
      return parseFloat(cleaned) || 0;
    };

    // Rule violation checks
    const checkRuleViolations = (row, rowIndex) => {
      const { price, currentStock, minStock } = row;
      const rowNum = rowIndex + 2;

      const checkField = (val, fieldName) => {
        if (val === undefined || val === null) return;
        const strVal = String(val).trim();
        
        if (/\d\s+\d/.test(strVal)) {
          warnings.push(`Ligne ${rowNum} (${fieldName}) : Présence d'un espace comme séparateur de milliers (ex: "${strVal}").`);
        }
        if (strVal.includes(',')) {
          warnings.push(`Ligne ${rowNum} (${fieldName}) : Utilisation d'une virgule au lieu d'un point pour les décimales (ex: "${strVal}").`);
        }
        if (fieldName === 'Prix' && /(fcfa|xof|[$€])/i.test(strVal)) {
          warnings.push(`Ligne ${rowNum} (${fieldName}) : Présence du symbole monétaire (ex: "${strVal}").`);
        }
      };

      checkField(price, 'Prix');
      checkField(currentStock, 'Stock');
      checkField(minStock, 'Seuil');
    };

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      let { id, code, name, price, currentStock, minStock, barcode } = row;
      
      // We need at least a name or barcode/code to proceed
      if (!name && !barcode && !code) continue;

      checkRuleViolations(row, i);

      if (barcode) {
        // Query database by barcode and storeId
        const [existing] = await connection.query(
          'SELECT id, name, code, price, minStock, barcode FROM articles WHERE barcode = ? AND storeId = ? LIMIT 1',
          [barcode, storeId]
        );

        if (existing.length > 0) {
          const dbArticle = existing[0];
          const [invExists] = await connection.query(
            'SELECT quantity FROM inventory WHERE articleId = ? AND storeId = ?',
            [dbArticle.id, storeId]
          );
          const dbQuantity = invExists.length > 0 ? invExists[0].quantity : 0;

          const updateFields = [];
          const updateParams = [];
          let hasChanged = false;

          if ('name' in row && name !== undefined) {
            const cleanName = String(name || '').trim();
            if (dbArticle.name !== cleanName) {
              updateFields.push('name = ?');
              updateParams.push(cleanName);
              hasChanged = true;
            }
          }
          if ('code' in row && code !== undefined) {
            const cleanCode = String(code || '').trim();
            if ((dbArticle.code || '') !== cleanCode) {
              updateFields.push('code = ?');
              updateParams.push(cleanCode || null);
              hasChanged = true;
            }
          }
          if ('price' in row && price !== undefined && price !== null) {
            const cleanPrice = cleanNum(price);
            if (parseFloat(dbArticle.price) !== cleanPrice) {
              updateFields.push('price = ?');
              updateParams.push(cleanPrice);
              hasChanged = true;
            }
          }
          if ('minStock' in row && minStock !== undefined && minStock !== null) {
            const cleanMinStock = cleanNum(minStock);
            if (parseInt(dbArticle.minStock) !== cleanMinStock) {
              updateFields.push('minStock = ?');
              updateParams.push(cleanMinStock);
              hasChanged = true;
            }
          }

          let inventoryChanged = false;
          let cleanStock = dbQuantity;
          if ('currentStock' in row && currentStock !== undefined && currentStock !== null) {
            cleanStock = cleanNum(currentStock);
            if (dbQuantity !== cleanStock) {
              inventoryChanged = true;
              hasChanged = true;
            }
          }

          if (hasChanged) {
            if (updateFields.length > 0) {
              updateParams.push(dbArticle.id);
              await connection.query(
                `UPDATE articles SET ${updateFields.join(', ')} WHERE id = ?`,
                updateParams
              );
            }

            if (inventoryChanged || ('minStock' in row && minStock !== undefined && minStock !== null)) {
              if (invExists.length > 0) {
                const finalMinStock = ('minStock' in row && minStock !== undefined && minStock !== null)
                  ? cleanNum(minStock)
                  : dbArticle.minStock;
                await connection.query(
                  'UPDATE inventory SET quantity = ?, minStock = ? WHERE articleId = ? AND storeId = ?',
                  [cleanStock, finalMinStock, dbArticle.id, storeId]
                );
              } else {
                const finalMinStock = ('minStock' in row && minStock !== undefined && minStock !== null)
                  ? cleanNum(minStock)
                  : dbArticle.minStock;
                await connection.query(
                  'INSERT INTO inventory (id, storeId, articleId, quantity, minStock) VALUES (?, ?, ?, ?, ?)',
                  [uuidv4(), storeId, dbArticle.id, cleanStock, finalMinStock]
                );
              }
            }
            updatedCount++;
          }
        } else {
          // Barcode does not exist -> Create new article
          const finalName = 'name' in row ? String(name || '').trim() : 'Sans nom';
          const finalCode = 'code' in row ? String(code || '').trim() : null;
          const finalPrice = 'price' in row ? cleanNum(price) : 0;
          const finalStock = 'currentStock' in row ? cleanNum(currentStock) : 0;
          const finalMinStock = 'minStock' in row ? cleanNum(minStock) : 0;

          const [result] = await connection.query(
            'INSERT INTO articles (code, name, price, currentStock, minStock, barcode, storeId) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [finalCode, finalName, finalPrice, finalStock, finalMinStock, barcode, storeId]
          );
          const newId = result.insertId;
          await connection.query(
            'INSERT INTO inventory (id, storeId, articleId, quantity, minStock) VALUES (?, ?, ?, ?, ?)',
            [uuidv4(), storeId, newId, finalStock, finalMinStock]
          );
          createdCount++;
        }
      } else {
        // No barcode -> Create new article
        const finalName = 'name' in row ? String(name || '').trim() : 'Sans nom';
        const finalCode = 'code' in row ? String(code || '').trim() : null;
        const finalPrice = 'price' in row ? cleanNum(price) : 0;
        const finalStock = 'currentStock' in row ? cleanNum(currentStock) : 0;
        const finalMinStock = 'minStock' in row ? cleanNum(minStock) : 0;

        const [result] = await connection.query(
          'INSERT INTO articles (code, name, price, currentStock, minStock, barcode, storeId) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [finalCode, finalName, finalPrice, finalStock, finalMinStock, null, storeId]
        );
        const newId = result.insertId;
        await connection.query(
          'INSERT INTO inventory (id, storeId, articleId, quantity, minStock) VALUES (?, ?, ?, ?, ?)',
          [uuidv4(), storeId, newId, finalStock, finalMinStock]
        );
        createdCount++;
      }
    }

    await logAction(auth.user.id, storeId, 'Import Excel de masse', { updated: updatedCount, created: createdCount });
    await connection.commit();
    
    return NextResponse.json({ success: true, updated: updatedCount, created: createdCount, warnings });
  } catch (err) {
    await connection.rollback();
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    connection.release();
  }
}

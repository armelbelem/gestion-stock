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
    let ignoredCount = 0;
    let valuationChange = 0;
    const details = [];
    const warnings = [];

    const cleanNum = (val) => {
      if (typeof val === 'number') return val;
      if (!val) return 0;
      // Supprimer espaces, remplacer virgule par point, supprimer symboles non numériques sauf le point
      const cleaned = String(val).replace(/\s/g, '').replace(/,/g, '.').replace(/[^0-9.]/g, '');
      return parseFloat(cleaned) || 0;
    };

    const normalizeBarcode = (bc) => {
      if (!bc) return '';
      return String(bc).replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    };

    // Charger tous les articles existants du magasin avec leur inventaire pour matcher en mémoire (plus rapide et gère la normalisation)
    const [dbArticles] = await connection.query(
      `SELECT a.id, a.name, a.code, a.price, a.minStock, a.barcode, i.quantity AS dbQuantity
       FROM articles a
       LEFT JOIN inventory i ON a.id = i.articleId AND i.storeId = a.storeId
       WHERE a.storeId = ?`,
      [storeId]
    );

    const articlesMap = new Map();
    for (const art of dbArticles) {
      if (art.barcode) {
        const norm = normalizeBarcode(art.barcode);
        if (norm && !articlesMap.has(norm)) {
          articlesMap.set(norm, art);
        }
      }
    }

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
      let { code, name, price, currentStock, minStock, barcode } = row;
      
      // We need at least a name or barcode/code to proceed
      if (!name && !barcode && !code) {
        ignoredCount++;
        details.push({
          action: 'error',
          row: i + 2,
          name: 'Ligne vide ou incomplète',
          reason: 'Le Nom, le Code-barres et la Référence/Code sont tous manquants ou vides.'
        });
        continue;
      }

      checkRuleViolations(row, i);

      if (barcode) {
        const normalized = normalizeBarcode(barcode);
        const dbArticle = articlesMap.get(normalized);

        if (dbArticle) {
          const dbQuantity = (dbArticle.dbQuantity !== null && dbArticle.dbQuantity !== undefined) ? dbArticle.dbQuantity : 0;
          const invExists = dbArticle.dbQuantity !== null && dbArticle.dbQuantity !== undefined;

          const updateFields = [];
          const updateParams = [];
          let hasChanged = false;
          const changes = {};

          if ('name' in row && name !== undefined) {
            const cleanName = String(name || '').trim();
            if (dbArticle.name !== cleanName) {
              updateFields.push('name = ?');
              updateParams.push(cleanName);
              hasChanged = true;
              changes.name = { old: dbArticle.name, new: cleanName };
            }
          }
          if ('code' in row && code !== undefined) {
            const cleanCode = String(code || '').trim();
            if ((dbArticle.code || '') !== cleanCode) {
              updateFields.push('code = ?');
              updateParams.push(cleanCode || null);
              hasChanged = true;
              changes.code = { old: dbArticle.code || '', new: cleanCode };
            }
          }

          let cleanPrice = parseFloat(dbArticle.price) || 0;
          if ('price' in row && price !== undefined && price !== null) {
            const parsedPrice = cleanNum(price);
            if (cleanPrice !== parsedPrice) {
              updateFields.push('price = ?');
              updateParams.push(parsedPrice);
              hasChanged = true;
              changes.price = { old: cleanPrice, new: parsedPrice };
              cleanPrice = parsedPrice;
            }
          }
          if ('minStock' in row && minStock !== undefined && minStock !== null) {
            const cleanMinStock = cleanNum(minStock);
            if (parseInt(dbArticle.minStock) !== cleanMinStock) {
              updateFields.push('minStock = ?');
              updateParams.push(cleanMinStock);
              hasChanged = true;
              changes.minStock = { old: parseInt(dbArticle.minStock) || 0, new: cleanMinStock };
            }
          }

          let inventoryChanged = false;
          let cleanStock = dbQuantity;
          if ('currentStock' in row && currentStock !== undefined && currentStock !== null) {
            cleanStock = cleanNum(currentStock);
            if (dbQuantity !== cleanStock) {
              inventoryChanged = true;
              hasChanged = true;
              changes.stock = { old: dbQuantity, new: cleanStock };
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
              if (invExists) {
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

            // Calcul de la valorisation de stock
            const oldVal = dbQuantity * (parseFloat(dbArticle.price) || 0);
            const newVal = cleanStock * cleanPrice;
            valuationChange += (newVal - oldVal);

            details.push({
              action: 'update',
              name: dbArticle.name,
              barcode: dbArticle.barcode || code || '',
              changes
            });
          }
        } else {
          // Barcode does not exist -> Create new article (requires name)
          const finalName = String(name || '').trim();
          if (!finalName) {
            ignoredCount++;
            details.push({
              action: 'error',
              row: i + 2,
              name: barcode || 'Sans Code-barres',
              reason: 'Impossible de créer un nouvel article sans Nom/Désignation.'
            });
            continue;
          }

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

          valuationChange += (finalStock * finalPrice);
          details.push({
            action: 'create',
            name: finalName,
            barcode: barcode || finalCode || '',
            price: finalPrice,
            stock: finalStock
          });
        }
      } else {
        // No barcode -> Create new article (requires name)
        const finalName = String(name || '').trim();
        if (!finalName) {
          ignoredCount++;
          details.push({
            action: 'error',
            row: i + 2,
            name: 'Sans Nom',
            reason: 'Impossible de créer un nouvel article sans Nom/Désignation.'
          });
          continue;
        }

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

        valuationChange += (finalStock * finalPrice);
        details.push({
          action: 'create',
          name: finalName,
          barcode: finalCode || '',
          price: finalPrice,
          stock: finalStock
        });
      }
    }

    await logAction(auth.user.id, storeId, 'Import Excel de masse', { updated: updatedCount, created: createdCount });
    await connection.commit();
    
    return NextResponse.json({
      success: true,
      updated: updatedCount,
      created: createdCount,
      summary: {
        total: data.length,
        created: createdCount,
        updated: updatedCount,
        ignored: ignoredCount,
        valuationChange
      },
      details,
      warnings
    });
  } catch (err) {
    await connection.rollback();
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    connection.release();
  }
}

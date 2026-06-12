import { NextResponse } from 'next/server';
import db from '../../../lib/db';
import { authenticateToken } from '../../../lib/auth';
import { logAction } from '../../../lib/actions';
import { v4 as uuidv4 } from 'uuid';

// PUT: Modifier ou annuler une vente spéciale
export async function PUT(request, { params }) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const body = await request.json();
  const { action } = body;

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Vérifier l'existence de la vente
    const [sales] = await connection.query('SELECT * FROM special_sales WHERE id = ?', [id]);
    if (sales.length === 0) {
      return NextResponse.json({ error: 'Vente introuvable' }, { status: 404 });
    }
    const sale = sales[0];

    if (action === 'annuler') {
      await connection.query('UPDATE special_sales SET status = ? WHERE id = ?', ['annule', id]);
      await connection.commit();
      await logAction(auth.user.id, auth.user.storeId, 'Annulation vente spéciale', { id, clientName: sale.clientName });
      return NextResponse.json({ success: true });
    }

    if (action === 'update_metadata') {
      const { metadata } = body;
      await connection.query('UPDATE special_sales SET metadata = ? WHERE id = ?', [JSON.stringify(metadata), id]);
      await connection.commit();
      return NextResponse.json({ success: true });
    }

    if (action === 'edit') {
      const { clientName, items, notes, date } = body;

      if (!clientName) return NextResponse.json({ error: 'Le nom du client est requis' }, { status: 400 });
      if (!items || items.length === 0) return NextResponse.json({ error: 'Au moins un produit est requis' }, { status: 400 });

      // 1. Supprimer les anciens articles
      await connection.query('DELETE FROM special_sale_items WHERE specialSaleId = ?', [id]);

      // 2. Insérer les nouveaux articles et calculer les montants
      let totalHT = 0;
      let totalMargin = 0;

      // Récupérer le taux de TVA actuel des paramètres
      const [settingsRows] = await connection.query('SELECT tvaRate FROM settings LIMIT 1');
      const tvaRate = Number(settingsRows[0]?.tvaRate || 18);

      for (const item of items) {
        const purchasePrice = parseFloat(item.purchasePrice) || 0;
        const sellingPrice = parseFloat(item.sellingPrice) || 0;
        const qty = parseInt(item.quantity) || 1;

        if (sellingPrice <= 0) {
          throw new Error(`Impossible de modifier la vente: l'article "${item.description || 'sélectionné'}" a un prix de vente de 0 FCFA.`);
        }

        totalHT += (sellingPrice * qty);
        totalMargin += ((sellingPrice - purchasePrice) * qty);

        const itemId = uuidv4();
        await connection.query(
          'INSERT INTO special_sale_items (id, specialSaleId, ref, description, quantity, purchasePrice, sellingPrice) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [itemId, id, item.ref || null, item.description, qty, purchasePrice, sellingPrice]
        );
      }

      const tva = totalHT * (tvaRate / 100);
      const totalTTC = totalHT + tva;

      // 3. Mettre à jour l'en-tête et synchroniser les métadonnées de l'impression
      let updatedMetadata = null;
      if (sale.metadata) {
        try {
          const meta = typeof sale.metadata === 'string' ? JSON.parse(sale.metadata) : sale.metadata;
          if (meta && meta.items) {
            const oldMetaItems = meta.items || [];
            meta.items = items.map((newItem, idx) => {
              const matchingOld = newItem.id ? oldMetaItems.find(o => o.id === newItem.id) : null;
              if (matchingOld) {
                return {
                  ...newItem,
                  code: matchingOld.code || ''
                };
              }
              const matchingIndex = oldMetaItems[idx];
              return {
                ...newItem,
                code: matchingIndex ? (matchingIndex.code || '') : ''
              };
            });
            updatedMetadata = JSON.stringify(meta);
          }
        } catch (e) {
          console.error("Error parsing/updating metadata during edit:", e);
        }
      }

      const saleDate = date ? new Date(date) : new Date(sale.date);
      if (updatedMetadata) {
        await connection.query(
          'UPDATE special_sales SET clientName = ?, date = ?, notes = ?, totalHT = ?, tva = ?, totalTTC = ?, margin = ?, metadata = ? WHERE id = ?',
          [clientName, saleDate, notes || null, totalHT, tva, totalTTC, totalMargin, updatedMetadata, id]
        );
      } else {
        await connection.query(
          'UPDATE special_sales SET clientName = ?, date = ?, notes = ?, totalHT = ?, tva = ?, totalTTC = ?, margin = ? WHERE id = ?',
          [clientName, saleDate, notes || null, totalHT, tva, totalTTC, totalMargin, id]
        );
      }

      await connection.commit();
      await logAction(auth.user.id, auth.user.storeId, 'Modification vente spéciale', { id, clientName, totalTTC });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Action non reconnue' }, { status: 400 });
  } catch (err) {
    await connection.rollback();
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    connection.release();
  }
}

// DELETE: Supprimer une vente spéciale
export async function DELETE(request, { params }) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  // Seul un admin ou un gestionnaire peut supprimer
  if (auth.user.role === 'vendeur' || auth.user.role === 'observateur') {
    return NextResponse.json({ error: 'Accès interdit pour ce rôle' }, { status: 403 });
  }

  const { id } = await params;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [sales] = await connection.query('SELECT * FROM special_sales WHERE id = ?', [id]);
    if (sales.length === 0) {
      return NextResponse.json({ error: 'Vente introuvable' }, { status: 404 });
    }
    const sale = sales[0];

    // Supprimer les articles de la vente spéciale (normalement fait par ON DELETE CASCADE mais on sécurise)
    await connection.query('DELETE FROM special_sale_items WHERE specialSaleId = ?', [id]);
    await connection.query('DELETE FROM special_sales WHERE id = ?', [id]);

    await connection.commit();

    await logAction(auth.user.id, auth.user.storeId, 'Suppression vente spéciale', { id, clientName: sale.clientName });

    return NextResponse.json({ success: true });
  } catch (err) {
    await connection.rollback();
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    connection.release();
  }
}

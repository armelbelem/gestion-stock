import { NextResponse } from 'next/server';
import db from '../../../../lib/db';
import { authenticateToken } from '../../../../lib/auth';
import { logAction } from '../../../../lib/actions';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request, { params }) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id: saleId } = await params;
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();

    // 1. Récupérer les détails du proforma
    const [sales] = await connection.query('SELECT * FROM sales WHERE id = ?', [saleId]);
    if (sales.length === 0) throw new Error('Proforma non trouvé');
    
    const sale = sales[0];
    if (sale.status !== 'proforma') throw new Error('Ce document n\'est pas un proforma ou a déjà été converti.');

    const [items] = await connection.query('SELECT * FROM sale_items WHERE saleId = ?', [saleId]);
    const storeId = sale.storeId;

    const [fyRows] = await connection.query("SELECT * FROM fiscal_years WHERE status = 'active'");
    const activeYear = fyRows[0];
    if (!activeYear) throw new Error("Action impossible : Aucun exercice fiscal n'est ouvert.");

    // 2. Vérifier et déduire le stock pour chaque article
    for (const item of items) {
      if (item.articleId) {
        const [inv] = await connection.query('SELECT quantity FROM inventory WHERE articleId = ? AND storeId = ?', [item.articleId, storeId]);
        if (inv.length === 0 || inv[0].quantity < item.quantity) {
           // Récupérer le nom de l'article pour le message d'erreur
           const [art] = await connection.query('SELECT name FROM articles WHERE id = ?', [item.articleId]);
           throw new Error(`Stock insuffisant pour l'article "${art[0]?.name || item.articleId}" (Restant: ${inv[0]?.quantity || 0})`);
        }
        
        // Déduire le stock
        await connection.query('UPDATE inventory SET quantity = quantity - ? WHERE articleId = ? AND storeId = ?', [item.quantity, item.articleId, storeId]);
        
        // Créer le mouvement de stock
        await connection.query('INSERT INTO mouvements (id, articleId, type, quantity, date, storeId, fiscalYearId) VALUES (?, ?, ?, ?, ?, ?, ?)', 
          [uuidv4(), item.articleId, 'OUT', item.quantity, new Date().toISOString(), storeId, activeYear.id]);
      }
    }

    // 3. Mettre à jour le statut du proforma en vente réelle
    // Par défaut, on le passe en 'en_attente' (crédit) car le paiement n'est pas forcément fait à la conversion
    // Mais on peut regarder si un amountPaid a été saisi à la création du proforma
    const newStatus = sale.amountPaid >= sale.totalAmount ? 'payé' : (sale.amountPaid > 0 ? 'partiel' : 'en_attente');
    
    await connection.query('UPDATE sales SET status = ?, date = ? WHERE id = ?', [newStatus, new Date().toISOString(), saleId]);

    // 4. Si un paiement partiel existait, on l'enregistre (normalement non car isProforma sautait le paiement, mais par sécurité)
    if (sale.amountPaid > 0) {
      const [existingPayments] = await connection.query('SELECT id FROM payments WHERE saleId = ?', [saleId]);
      if (existingPayments.length === 0) {
        await connection.query('INSERT INTO payments (id, saleId, amount, date, storeId, fiscalYearId) VALUES (?, ?, ?, ?, ?, ?)', 
          [uuidv4(), saleId, sale.amountPaid, new Date().toISOString(), storeId, activeYear.id]);
      }
    }

    await logAction(auth.user.id, storeId, 'Conversion Proforma en Vente', { saleId });
    await connection.commit();
    
    return NextResponse.json({ success: true, newStatus });
  } catch (err) {
    await connection.rollback();
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    connection.release();
  }
}

import { NextResponse } from 'next/server';
import db from '../../../lib/db';
import { authenticateToken } from '../../../lib/auth';
import { getStoreConstraint, logAction } from '../../../lib/actions';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const storeId = getStoreConstraint(auth.user, searchParams.get('storeId'));
  const includeContracts = searchParams.get('includeContracts') === 'true';

  if (!clientId || !startDate || !endDate) {
    return NextResponse.json({ error: "Client, date de début et date de fin requis" }, { status: 400 });
  }

  try {

    // Requête pour récupérer les ventes groupées par article pour ce client et ce mois
    const query = `
      SELECT 
        a.code, 
        a.barcode,
        COALESCE(a.name, si.description, 'Article Inconnu') as name, 
        si.unitPrice, 
        SUM(si.quantity) as totalQuantity, 
        SUM(si.quantity * si.unitPrice) as totalAmount
      FROM sale_items si
      JOIN sales s ON si.saleId = s.id
      LEFT JOIN articles a ON si.articleId = a.id
      WHERE s.clientId = ? 
        AND s.date >= ? 
        AND s.date <= ? 
        AND s.status != 'annulée'
        ${storeId ? 'AND s.storeId = ?' : ''}
        ${!includeContracts ? "AND s.storeId != 0 AND s.storeId != 'CFAO'" : ''}
      GROUP BY a.code, a.barcode, COALESCE(a.name, si.description, 'Article Inconnu'), si.unitPrice
      ORDER BY name ASC
    `;

    // Utilisation de formats compatibles ISO pour la comparaison
    const startParam = startDate + 'T00:00:00';
    const endParam = endDate + 'T23:59:59';
    const params = [clientId, startParam, endParam];
    if (storeId) params.push(storeId);

    const [rows] = await db.query(query, params);

    // Récupérer le total des remises sur la période
    const discountQuery = `
      SELECT SUM(discount) as totalDiscount 
      FROM sales 
      WHERE clientId = ? AND date >= ? AND date <= ? AND status != 'annulée'
      ${storeId ? 'AND storeId = ?' : ''}
      ${!includeContracts ? "AND storeId != 0 AND storeId != 'CFAO'" : ''}
    `;
    const [discountRows] = await db.query(discountQuery, params);
    const totalDiscount = Number(discountRows[0]?.totalDiscount || 0);

    // Récupérer le total de la TVA sur la période
    const tvaQuery = `
      SELECT SUM(tvaAmount) as totalTva 
      FROM sales 
      WHERE clientId = ? AND date >= ? AND date <= ? AND status != 'annulée'
      ${storeId ? 'AND storeId = ?' : ''}
      ${!includeContracts ? "AND storeId != 0 AND storeId != 'CFAO'" : ''}
    `;
    const [tvaRows] = await db.query(tvaQuery, params);
    const totalTva = Number(tvaRows[0]?.totalTva || 0);

    // Calcul des totaux généraux
    const summary = rows.reduce((acc, row) => {
      acc.totalQuantity += Number(row.totalQuantity);
      acc.totalGrossAmount += Number(row.totalAmount);
      return acc;
    }, { totalQuantity: 0, totalGrossAmount: 0 });

    summary.totalDiscount = totalDiscount;
    summary.totalTva = totalTva;
    summary.totalAmount = (summary.totalGrossAmount - totalDiscount) + totalTva;

    return NextResponse.json({
      items: rows,
      summary: summary
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await request.json();
    const { clientId, startDate, endDate, storeId: bodyStoreId } = body;
    const storeId = getStoreConstraint(auth.user, bodyStoreId);

    if (!clientId || !startDate || !endDate) {
      return NextResponse.json({ error: "Client, dates de début et de fin requis" }, { status: 400 });
    }

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      
      const startParam = startDate + 'T00:00:00';
      const endParam = endDate + 'T23:59:59';
      
      const [sales] = await connection.query(
        `SELECT id, totalAmount, amountPaid, storeId, fiscalYearId 
         FROM sales 
         WHERE clientId = ? AND date >= ? AND date <= ? AND status IN ('en_attente', 'partiel')
         ${storeId ? 'AND storeId = ?' : ''}`,
        storeId ? [clientId, startParam, endParam, storeId] : [clientId, startParam, endParam]
      );

      if (sales.length === 0) {
        return NextResponse.json({ message: "Aucune vente à régler pour cette période." });
      }

      let totalSettled = 0;
      for (const sale of sales) {
        const remaining = sale.totalAmount - sale.amountPaid;
        if (remaining > 0) {
          await connection.query(
            'INSERT INTO payments (id, saleId, amount, date, notes, storeId, fiscalYearId) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [uuidv4(), sale.id, remaining, new Date().toISOString(), 'Réglement groupé mensuel', sale.storeId, sale.fiscalYearId]
          );
          await connection.query(
            'UPDATE sales SET amountPaid = totalAmount, status = "payé" WHERE id = ?',
            [sale.id]
          );
          totalSettled += remaining;
        }
      }

      await logAction(auth.user.id, storeId || auth.user.storeId, 'Réglement période client', { clientId, startDate, endDate, totalSettled });
      await connection.commit();
      return NextResponse.json({ success: true, totalSettled });
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

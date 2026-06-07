import { NextResponse } from 'next/server';
import db from '../../../lib/db';
import { authenticateToken, hasPermission } from '../../../lib/auth';
import { getStoreConstraint } from '../../../lib/actions';

export async function GET(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!hasPermission(auth.user, 'finances', 'view')) {
    return NextResponse.json({ error: 'Accès interdit : Permissions insuffisantes' }, { status: 403 });
  }
  try {
    const { searchParams } = request.nextUrl;
    const storeId = getStoreConstraint(auth.user, searchParams.get('storeId'));
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Récupérer l'exercice actif
    const [fyRows] = await db.query("SELECT * FROM fiscal_years WHERE status = 'active'");
    const activeYear = fyRows[0];
    if (!activeYear) {
      return NextResponse.json({ months: [], totalRevenue: 0, totalDebt: 0 });
    }

    // Déterminer la plage de dates
    let start, end;
    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
    } else {
      end = new Date();
      start = new Date();
      start.setMonth(end.getMonth() - 11);
      start.setDate(1);
    }

    // Générer la liste des mois à traiter
    let monthsList = [];
    let current = new Date(end.getFullYear(), end.getMonth(), 1);
    const limit = new Date(start.getFullYear(), start.getMonth(), 1);
    
    // Sécurité pour éviter les boucles infinies ou trop longues
    let iterations = 0;
    while (current >= limit && iterations < 48) {
      monthsList.push(current.toISOString().substring(0, 7));
      current.setMonth(current.getMonth() - 1);
      iterations++;
    }

    let months = [];
    for (const monthStr of monthsList) {
      // Pour chaque mois, on applique le filtre de date s'il existe
      let monthStart = monthStr + '-01';
      let monthEnd = monthStr + '-31';

      // Si un filtre global existe, on prend l'intersection
      const effectiveStart = startDate && startDate > monthStart ? startDate : monthStart;
      const effectiveEnd = (endDate && endDate < monthEnd ? endDate : monthEnd) + 'T23:59:59';

      let revQuery = 'SELECT SUM(totalAmount) as total FROM sales WHERE (date BETWEEN ? AND ?) AND status != "annulée" AND fiscalYearId = ? AND (storeId != "CFAO" OR storeId IS NULL)';
      let revParams = [effectiveStart, effectiveEnd, activeYear.id];
      if (storeId && storeId !== 'all' && storeId !== '') { 
        if (storeId === 'CFAO') {
          revQuery = 'SELECT 0 as total';
          revParams = [];
        } else {
          revQuery += ' AND storeId = ?'; 
          revParams.push(storeId);
        }
      }
      const [revRow] = await db.query(revQuery, revParams);

      let cashQuery = `
        SELECT SUM(p.amount) as total 
        FROM payments p
        LEFT JOIN sales s ON p.saleId = s.id
        WHERE (p.date BETWEEN ? AND ?) AND (s.status IS NULL OR s.status != 'annulée') AND (s.fiscalYearId = ? OR p.fiscalYearId = ?)
      `;
      let cashParams = [effectiveStart, effectiveEnd, activeYear.id, activeYear.id];
      if (storeId && storeId !== 'all' && storeId !== '') { 
        cashQuery += ' AND p.storeId = ?'; 
        cashParams.push(storeId); 
      }
      const [cashRow] = await db.query(cashQuery, cashParams);
      
      months.push({ 
        month: monthStr, 
        revenue: Number(revRow[0].total) || 0, 
        cash: Number(cashRow[0].total) || 0 
      });
    }

    let totalRevenue = 0;
    let totalPaid = 0;

    // --- 1. SALES (Standard) - Exclure CFAO (Achats)
    let salesRevQuery = 'SELECT SUM(totalAmount) as total FROM sales WHERE status != "annulée" AND fiscalYearId = ? AND (storeId != "CFAO" OR storeId IS NULL)';
    let salesPaidQuery = 'SELECT SUM(amountPaid) as total FROM sales WHERE status != "annulée" AND fiscalYearId = ? AND (storeId != "CFAO" OR storeId IS NULL)';
    let salesRevParams = [activeYear.id];
    let salesPaidParams = [activeYear.id];

    if (startDate && endDate) {
      const dRange = ' AND date BETWEEN ? AND ?';
      salesRevQuery += dRange; salesRevParams.push(startDate, endDate + 'T23:59:59');
      salesPaidQuery += dRange; salesPaidParams.push(startDate, endDate + 'T23:59:59');
    }
    if (storeId && storeId !== 'all') {
      if (storeId === 'CFAO') {
        salesRevQuery = 'SELECT 0 as total';
        salesPaidQuery = 'SELECT 0 as total';
        salesRevParams = [];
        salesPaidParams = [];
      } else {
        salesRevQuery += ' AND storeId = ?'; salesRevParams.push(storeId);
        salesPaidQuery += ' AND storeId = ?'; salesPaidParams.push(storeId);
      }
    }
    const [sRev] = await db.query(salesRevQuery, salesRevParams);
    const [sPaid] = await db.query(salesPaidQuery, salesPaidParams);
    totalRevenue += Number(sRev[0].total || 0);
    totalPaid += Number(sPaid[0].total || 0);

    // --- 2. EXTERNAL ORDERS (Special) - RETIRÉ DU RAPPORT GLOBAL (Demandé par l'utilisateur)
    /*
    let extRevQuery = `
      SELECT SUM(i.quantity * i.sellPrice) as total 
      FROM external_order_items i 
      JOIN external_orders e ON i.externalOrderId = e.id 
      WHERE e.status != 'annule' AND e.fiscalYearId = ?
    `;
    let extPaidQuery = 'SELECT SUM(amountPaid) as total FROM external_orders WHERE status != "annule" AND fiscalYearId = ?';
    let extRevParams = [activeYear.id];
    let extPaidParams = [activeYear.id];

    if (startDate && endDate) {
      const dRange = ' AND e.date BETWEEN ? AND ?';
      const dRangePaid = ' AND date BETWEEN ? AND ?';
      extRevQuery += dRange; extRevParams.push(startDate, endDate + 'T23:59:59');
      extPaidQuery += dRangePaid; extPaidParams.push(startDate, endDate + 'T23:59:59');
    }
    if (storeId && storeId !== 'all') {
      extRevQuery += ' AND e.storeId = ?'; extRevParams.push(storeId);
      extPaidQuery += ' AND storeId = ?'; extPaidParams.push(storeId);
    }
    const [eRev] = await db.query(extRevQuery, extRevParams);
    const [ePaid] = await db.query(extPaidQuery, extPaidParams);
    totalRevenue += Number(eRev[0].total || 0);
    totalPaid += Number(ePaid[0].total || 0);
    */

    // --- 3. ACHATS PARTENAIRES (Détail par partenaire)
    let partnerPurchases = [];
    
    // a. Depuis contract_orders
    let conPurchQuery = `
      SELECT p.name, SUM(o.contractAmount * (1 + COALESCE(o.tva_rate, 0) / 100)) as total 
      FROM contract_orders o
      JOIN contract_partners p ON o.partner_id = p.id
      WHERE (o.status = "CLÔTURÉ" OR o.status = "termine")
    `;
    let conPurchParams = [];
    if (startDate && endDate) {
      conPurchQuery += ' AND o.createdAt BETWEEN ? AND ?';
      conPurchParams.push(startDate + ' 00:00:00', endDate + ' 23:59:59');
    }
    conPurchQuery += ' GROUP BY p.name';
    const [cPurchRows] = await db.query(conPurchQuery, conPurchParams);
    
    // Consolidation (Source unique : contract_orders pour éviter les doublons avec les ventes)
    const breakdown = {};
    cPurchRows.forEach(r => breakdown[r.name] = (breakdown[r.name] || 0) + Number(r.total));

    partnerPurchases = Object.entries(breakdown).map(([name, total]) => ({ name, total }));
    const totalPurchases = partnerPurchases.reduce((acc, curr) => acc + curr.total, 0);

    return NextResponse.json({ 
      months, 
      totalRevenue, 
      totalPaid, 
      totalDebt: totalRevenue - totalPaid,
      totalPurchases,
      partnerPurchases
    });
  } catch (err) { 
    console.error('[MONTHLY REPORT ERROR]', err);
    return NextResponse.json({ 
      error: err.message, 
      details: err.stack
    }, { status: 500 }); 
  }
}


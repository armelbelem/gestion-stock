import { NextResponse } from 'next/server';
import db from '../../../lib/db';
import { authenticateToken } from '../../../lib/auth';

export async function GET(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const partnerId = searchParams.get('partnerId');

  try {
    let query = `
      SELECT 
        coi.*, 
        co.createdAt as orderDate, 
        co.orderNumber,
        c.name as clientName,
        f.name as supplierName
      FROM contract_order_items coi
      JOIN contract_orders co ON coi.orderId = co.id
      LEFT JOIN clients c ON co.clientId = c.id
      LEFT JOIN fournisseurs f ON co.supplierId = f.id
      WHERE co.status = 'termine'
    `;
    const params = [];

    if (partnerId) {
      query += ` AND co.partner_id = ? `;
      params.push(partnerId);
    }

    if (startDate && endDate) {
      query += ` AND co.createdAt BETWEEN ? AND ? `;
      params.push(`${startDate} 00:00:00`, `${endDate} 23:59:59`);
    }

    query += ` ORDER BY co.createdAt DESC`;

    const [rows] = await db.query(query, params);
    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

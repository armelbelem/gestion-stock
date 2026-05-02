import { NextResponse } from 'next/server';
import db from '../../../lib/db';
import { authenticateToken } from '../../../lib/auth';
import { logAction, getStoreConstraint } from '../../../lib/actions';

export async function PUT(request, { params }) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params;
  const { name, email, phone, address } = await request.json();
  try {
    await db.query('UPDATE clients SET name = ?, email = ?, phone = ?, address = ? WHERE id = ?', 
      [name, email || null, phone || null, address || null, id]);
    await logAction(auth.user.id, null, 'Modification client', { id, name });
    return NextResponse.json({ success: true });
  } catch (err) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}

export async function DELETE(request, { params }) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  
  const { searchParams } = new URL(request.url);
  const storeId = getStoreConstraint(auth.user, searchParams.get('storeId'));
  const { id } = await params;

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Vérifier si le client a des ventes ou commandes spéciales
    const [sales] = await connection.query('SELECT count(*) as count FROM sales WHERE clientId = ?', [id]);
    const [orders] = await connection.query('SELECT count(*) as count FROM external_orders WHERE clientId = ?', [id]);
    
    const hasHistory = sales[0].count > 0 || orders[0].count > 0;

    if (hasHistory) {
      if (auth.user.role === 'admin') {
        // Pour les admins, on permet la suppression en "détachant" l'historique
        await connection.query('UPDATE sales SET clientId = NULL WHERE clientId = ?', [id]);
        await connection.query('UPDATE external_orders SET clientId = NULL WHERE clientId = ?', [id]);
      } else {
        throw new Error('Impossible de supprimer : ce client a un historique de ventes. Seul un administrateur peut effectuer cette action (l\'historique sera conservé anonymement).');
      }
    }

    await connection.query('DELETE FROM clients WHERE id = ?', [id]);
    await logAction(auth.user.id, storeId, 'Suppression client', { id });
    
    await connection.commit();
    return NextResponse.json({ success: true });
  } catch (err) { 
    await connection.rollback();
    return NextResponse.json({ error: err.message }, { status: 400 }); 
  } finally {
    connection.release();
  }
}

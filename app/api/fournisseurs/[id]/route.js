import { NextResponse } from 'next/server';
import db from '../../../lib/db';
import { authenticateToken } from '../../../lib/auth';
import { logAction, getStoreConstraint } from '../../../lib/actions';

export async function PUT(request, { params }) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params;
  const { name, email, phone, address, rccm, nif, bp, myClientCode } = await request.json();
  try {
    await db.query('UPDATE fournisseurs SET name = ?, email = ?, phone = ?, address = ?, rccm = ?, nif = ?, bp = ?, myClientCode = ? WHERE id = ?',
      [name, email || null, phone || null, address || null, rccm || null, nif || null, bp || null, myClientCode || null, id]);
    await logAction(auth.user.id, null, 'Modification fournisseur', { id, name });
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

    // Vérifier si le fournisseur a un historique
    const [movs] = await connection.query('SELECT count(*) as count FROM mouvements WHERE supplierId = ?', [id]);
    const [orders] = await connection.query('SELECT count(*) as count FROM external_orders WHERE supplierId = ?', [id]);
    
    const hasHistory = movs[0].count > 0 || orders[0].count > 0;

    if (hasHistory) {
      if (auth.user.role === 'admin') {
        // Pour les admins, on permet la suppression en "détachant" l'historique
        await connection.query('UPDATE mouvements SET supplierId = NULL WHERE supplierId = ?', [id]);
        await connection.query('UPDATE external_orders SET supplierId = NULL WHERE supplierId = ?', [id]);
      } else {
        throw new Error('Impossible de supprimer : ce fournisseur a un historique de mouvements. Seul un administrateur peut effectuer cette action.');
      }
    }

    await connection.query('DELETE FROM fournisseurs WHERE id = ?', [id]);
    await logAction(auth.user.id, storeId, 'Suppression fournisseur', { id });
    
    await connection.commit();
    return NextResponse.json({ success: true });
  } catch (err) { 
    await connection.rollback();
    
    if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.errno === 1451) {
      return NextResponse.json({ 
        error: "Impossible de supprimer ce fournisseur car il est lié à des historiques (mouvements, commandes). Pour des raisons de comptabilité et d'intégrité, vous ne pouvez pas le supprimer." 
      }, { status: 400 });
    }
    
    return NextResponse.json({ error: err.message }, { status: 400 }); 
  } finally {
    connection.release();
  }
}

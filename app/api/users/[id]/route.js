import { NextResponse } from 'next/server';
import db from '../../../lib/db';
import { authenticateToken } from '../../../lib/auth';
import { logAction } from '../../../lib/actions';

export async function DELETE(request, { params }) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  
  // Seul un admin peut supprimer un utilisateur
  if (auth.user.role !== 'admin') {
    return NextResponse.json({ error: 'Droits insuffisants' }, { status: 403 });
  }

  const { id: userId } = await params;

  // Empêcher de se supprimer soi-même
  if (userId === auth.user.id) {
    return NextResponse.json({ error: 'Impossible de supprimer votre propre compte' }, { status: 400 });
  }

  try {
    // Vérifier si l'utilisateur existe
    const [rows] = await db.query('SELECT username FROM users WHERE id = ?', [userId]);
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
    }
    const username = rows[0].username;

    // Tentative de suppression
    await db.query('DELETE FROM users WHERE id = ?', [userId]);
    
    await logAction(auth.user.id, auth.user.storeId, 'Suppression utilisateur', { userId, username });
    
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error deleting user:', err);
    // Gestion des contraintes d'intégrité (clé étrangère)
    if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.errno === 1451) {
      return NextResponse.json({ 
        error: "Cet utilisateur ne peut pas être supprimé car il possède un historique (ventes, paiements ou logs). Vous devriez plutôt désactiver son compte ou changer son mot de passe." 
      }, { status: 400 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.user.role !== 'admin') return NextResponse.json({ error: 'Droits insuffisants' }, { status: 403 });

  const { id: userId } = await params;
  const { username, password, role, storeId } = await request.json();
  // storeId peut être null (= accès tous les magasins)
  const resolvedStoreId = storeId || null;

  try {
    if (password) {
      const bcrypt = await import('bcryptjs');
      const hashedPassword = bcrypt.default.hashSync(password, 10);
      await db.query('UPDATE users SET username = ?, password = ?, role = ?, storeId = ? WHERE id = ?', 
        [username, hashedPassword, role, resolvedStoreId, userId]);
    } else {
      await db.query('UPDATE users SET username = ?, role = ?, storeId = ? WHERE id = ?', 
        [username, role, resolvedStoreId, userId]);
    }
    
    await logAction(auth.user.id, auth.user.storeId, 'Modification utilisateur', { userId, username, role });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

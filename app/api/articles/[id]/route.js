import { NextResponse } from 'next/server';
import db from '../../../lib/db';
import { authenticateToken } from '../../../lib/auth';
import { logAction, getStoreConstraint } from '../../../lib/actions';

export async function PUT(request, { params }) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  // Seul l'admin ou un gérant peut modifier un article (prix, nom, etc.)
  if (auth.user.role !== 'admin' && auth.user.role !== 'gestionnaire') {
    return NextResponse.json({ error: 'Accès interdit : Administrateur ou Gérant requis pour modifier les articles' }, { status: 403 });
  }

  const { id: articleId } = await params;
  const { code, name, price, minStock, barcode } = await request.json();


  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [oldDataRows] = await connection.query('SELECT name, price FROM articles WHERE id = ?', [articleId]);
    const oldData = oldDataRows[0];

    await connection.query(
      'UPDATE articles SET code = ?, name = ?, price = ?, minStock = ?, barcode = ? WHERE id = ?',
      [code || null, name, price || 0, minStock || 0, barcode || null, articleId]
    );

    let logMsg = `Modification article: ${name}`;
    if (oldData && oldData.price !== parseFloat(price)) {
      logMsg = `Changement prix article "${name}": ${oldData.price} -> ${price}`;
    } else if (oldData && oldData.name !== name) {
      logMsg = `Renommage article: "${oldData.name}" -> "${name}"`;
    }

    await logAction(auth.user.id, auth.user.storeId, logMsg, { id: articleId, old: oldData, new: { name, price } });
    await connection.commit();
    return NextResponse.json({ success: true });
  } catch (err) {
    await connection.rollback();
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    connection.release();
  }
}

export async function DELETE(request, { params }) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const requestedStoreId = searchParams.get('storeId');
  const storeId = getStoreConstraint(auth.user, requestedStoreId);
  const { id: articleId } = await params;
  console.log(`[DELETE] Tentative de suppression de l'article ID: ${articleId} par l'utilisateur: ${auth.user.username}`);

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // Si l'utilisateur est ADMIN ou GESTIONNAIRE et qu'aucun magasin n'est spécifié (vue globale), on fait une suppression globale
      if ((auth.user.role === 'admin' || auth.user.role === 'gestionnaire') && !storeId) {
        console.log(`[DELETE] ADMIN : Suppression GLOBALE de l'article ${articleId}`);
        await connection.query('DELETE FROM inventory WHERE articleId = ?', [articleId]);
        await connection.query('DELETE FROM mouvements WHERE articleId = ?', [articleId]);
        await connection.query('DELETE FROM articles WHERE id = ?', [articleId]);
        await logAction(auth.user.id, null, 'Suppression totale article', { id: articleId });
      } 
      else if (storeId) {
        // Suppression locale pour les autres
        console.log(`[DELETE] Local pour magasin: ${storeId}`);
        await connection.query('DELETE FROM inventory WHERE articleId = ? AND storeId = ?', [articleId, storeId]);
        await connection.query('DELETE FROM mouvements WHERE articleId = ? AND storeId = ?', [articleId, storeId]);
        await logAction(auth.user.id, storeId, 'Suppression article du magasin', { id: articleId });
      }


    await connection.commit();
    return NextResponse.json({ success: true });
  } catch (err) { 
    await connection.rollback(); 
    console.error('Error deleting article:', err);

    // Gestion spécifique des erreurs de contrainte d'intégrité (Clé étrangère)
    if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.errno === 1451) {
      return NextResponse.json({ 
        error: "Impossible de supprimer cet article car il possède un historique (ventes, mouvements ou commandes). Pour des raisons de comptabilité, vous ne pouvez pas supprimer un article qui a déjà été utilisé. Vous pouvez cependant modifier son nom ou son prix." 
      }, { status: 400 });
    }

    return NextResponse.json({ error: err.message }, { status: 500 }); 
  } finally { connection.release(); }
}


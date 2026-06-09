import db from '../../lib/db';
import { authenticateToken, hasPermission } from '../../lib/auth';
import { logAction } from '../../lib/actions';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

// GET: Récupérer l'historique des décharges (BL libres)
export async function GET(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  if (!hasPermission(auth.user, 'procurement', 'view') && !hasPermission(auth.user, 'stock', 'view_cost_price')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }

  // Ensure 'status' column exists
  try {
    await db.query("SELECT status FROM grouped_discharges LIMIT 1");
  } catch (e) {
    try {
      await db.query("ALTER TABLE grouped_discharges ADD COLUMN status VARCHAR(20) DEFAULT 'valide'");
    } catch (err) {
      console.error('Error adding status column:', err);
    }
  }

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId');
  const partnerId = searchParams.get('partnerId');
  const search = searchParams.get('search');

  try {
    let query = 'SELECT gd.*, u.username as creator_name FROM grouped_discharges gd LEFT JOIN users u ON gd.created_by = u.id WHERE 1=1';
    const params = [];

    if (clientId && clientId !== 'all') {
      query += ' AND gd.client_id = ?';
      params.push(clientId);
    }
    if (partnerId && partnerId !== 'all') {
      query += ' AND gd.partner_id = ?';
      params.push(partnerId);
    }
    if (search && search.trim() !== '') {
      query += ' AND (gd.discharge_number LIKE ? OR gd.client_name LIKE ?)';
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    query += ' ORDER BY gd.created_at DESC LIMIT 50';
    const [rows] = await db.query(query, params);

    const parsed = rows.map(row => ({
      ...row,
      delivery_ids: typeof row.delivery_ids === 'string' ? JSON.parse(row.delivery_ids) : (row.delivery_ids || []),
      items: typeof row.items === 'string' ? JSON.parse(row.items) : (row.items || [])
    }));

    return NextResponse.json(parsed);
  } catch (err) {
    console.error('[GROUPED DISCHARGE GET ERROR]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Enregistrer une décharge groupée standalone (sans lien vers des commandes ou stocks)
export async function POST(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  if (!hasPermission(auth.user, 'procurement', 'view') && !hasPermission(auth.user, 'stock', 'view_cost_price')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }

  const body = await request.json();
  const { 
    clientId, clientName, partnerId, partnerName, items, notes,
    customSenderDetails, customRecipientDetails, customDate, customCity,
    customSite, customSupervisorName, customSupervisorTitle, customDocNumber,
    sectionTitle, blColNo, blColSite, blColDesc, blColCode, blColRef, blColQty,
    hideBlColNo, hideBlColSite, hideBlColDesc, hideBlColCode, hideBlColRef, hideBlColQty
  } = body;

  if (!clientId || !items || items.length === 0) {
    return NextResponse.json({ error: 'clientId et items sont requis' }, { status: 400 });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Déterminer/générer le numéro de décharge unique
    let dischargeNumber = customDocNumber;
    if (!dischargeNumber) {
      const [seqRows] = await connection.query(
        'SELECT COUNT(*) as count FROM grouped_discharges WHERE client_id = ?',
        [clientId === 'libre' ? null : clientId]
      );
      const seq = (seqRows[0]?.count || 0) + 1;
      const now = new Date();
      const ddmm = `${String(now.getDate()).padStart(2, '0')}${String(now.getMonth() + 1).padStart(2, '0')}`;
      const yyyy = now.getFullYear();
      dischargeNumber = `BEG-${String(seq).padStart(3, '0')}-${ddmm}-${yyyy}`;
    }

    const dischargeId = uuidv4();

    // On stocke les items avec les réglages de métadonnées dans les items
    const parsedItems = items.map(it => {
      if (it.isMetadata) {
        return it;
      }
      return {
        code: it.code,
        description: it.description,
        refCfao: it.refCfao,
        quantity: parseInt(it.quantity) || 0
      };
    }).filter(it => it.quantity > 0 || it.isMetadata);

    if (parsedItems.filter(it => !it.isMetadata).length === 0) {
      throw new Error('Veuillez spécifier au moins un article avec une quantité positive.');
    }

    // 2. Insérer la décharge groupée libre en base
    await connection.query(
      `INSERT INTO grouped_discharges (
        id, discharge_number, client_id, client_name, partner_id, partner_name, 
        delivery_ids, items, notes, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        dischargeId, 
        dischargeNumber, 
        clientId === 'libre' ? null : clientId, 
        clientName, 
        partnerId || null, 
        partnerName || null, 
        JSON.stringify([]), // Pas de BL logistiques liés car c'est un BL libre
        JSON.stringify(parsedItems), 
        notes || null, 
        auth.user.id,
        customDate ? new Date(customDate) : new Date()
      ]
    );

    await connection.commit();

    await logAction(auth.user.id, auth.user.storeId, 'Création Décharge Libre (BEG)', {
      dischargeId,
      dischargeNumber,
      clientName,
      nbItems: parsedItems.length
    });

    return NextResponse.json({ success: true, id: dischargeId, dischargeNumber }, { status: 201 });
  } catch (err) {
    await connection.rollback();
    console.error('[GROUPED DISCHARGE POST ERROR]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    connection.release();
  }
}

// DELETE: Annuler/supprimer une décharge groupée standalone
export async function DELETE(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  if (auth.user.role === 'gestionnaire2' || auth.user.role === 'gestionnaire 2') {
    return NextResponse.json({ error: 'Accès refusé : Rôle non autorisé à supprimer des décharges' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) return NextResponse.json({ error: 'ID requis' }, { status: 400 });

  try {
    const [rows] = await db.query('SELECT * FROM grouped_discharges WHERE id = ?', [id]);
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Décharge introuvable' }, { status: 404 });
    }

    await db.query('DELETE FROM grouped_discharges WHERE id = ?', [id]);
    await logAction(auth.user.id, auth.user.storeId, 'Annulation Décharge Libre (BEG)', { dischargeId: id });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[GROUPED DISCHARGE DELETE ERROR]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT: Mettre à jour une décharge groupée (ex: annuler ou modifier)
export async function PUT(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  if (auth.user.role === 'gestionnaire2' || auth.user.role === 'gestionnaire 2') {
    return NextResponse.json({ error: 'Accès refusé : Rôle non autorisé à modifier ou annuler des décharges' }, { status: 403 });
  }

  if (!hasPermission(auth.user, 'procurement', 'view') && !hasPermission(auth.user, 'stock', 'view_cost_price')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  let id = searchParams.get('id');
  let action = searchParams.get('action');

  let body = null;
  try {
    body = await request.json();
    if (!id && body.id) id = body.id;
    if (!action && body.action) action = body.action;
  } catch (e) {}

  if (!id) return NextResponse.json({ error: 'ID requis' }, { status: 400 });

  try {
    const [rows] = await db.query('SELECT * FROM grouped_discharges WHERE id = ?', [id]);
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Décharge introuvable' }, { status: 404 });
    }

    if (action === 'cancel') {
      await db.query("UPDATE grouped_discharges SET status = 'annule' WHERE id = ?", [id]);
      await logAction(auth.user.id, auth.user.storeId, 'Annulation Décharge Libre (BEG)', { dischargeId: id });
      return NextResponse.json({ success: true });
    }

    if (action === 'update') {
      const { 
        clientId, clientName, partnerId, partnerName, items, notes, customDate, customDocNumber 
      } = body;
      
      const parsedItems = items.map(it => {
        if (it.isMetadata) return it;
        return {
          code: it.code,
          description: it.description,
          refCfao: it.refCfao,
          quantity: parseInt(it.quantity) || 0
        };
      }).filter(it => it.quantity > 0 || it.isMetadata);

      if (parsedItems.filter(it => !it.isMetadata).length === 0) {
        throw new Error('Veuillez spécifier au moins un article avec une quantité positive.');
      }

      const finalDocNumber = customDocNumber || rows[0].discharge_number;

      await db.query(
        `UPDATE grouped_discharges SET 
          client_id = ?, client_name = ?, partner_id = ?, partner_name = ?, 
          items = ?, notes = ?, created_at = ?, discharge_number = ?
         WHERE id = ?`,
        [
          clientId === 'libre' ? null : clientId,
          clientName,
          partnerId || null,
          partnerName || null,
          JSON.stringify(parsedItems),
          notes || null,
          customDate ? new Date(customDate) : new Date(rows[0].created_at),
          finalDocNumber,
          id
        ]
      );

      await logAction(auth.user.id, auth.user.storeId, 'Modification Décharge Libre (BEG)', { dischargeId: id, newNumber: finalDocNumber });
      return NextResponse.json({ success: true, dischargeNumber: finalDocNumber });
    }

    return NextResponse.json({ error: 'Action non reconnue' }, { status: 400 });
  } catch (err) {
    console.error('[GROUPED DISCHARGE PUT ERROR]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH: Mettre à jour une décharge (ex: ajouter une pièce jointe)
export async function PATCH(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) return NextResponse.json({ error: 'ID requis' }, { status: 400 });

  const body = await request.json();
  const { attachment } = body;

  try {
    const [rows] = await db.query('SELECT * FROM grouped_discharges WHERE id = ?', [id]);
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Décharge introuvable' }, { status: 404 });
    }

    await db.query("UPDATE grouped_discharges SET attachment = ? WHERE id = ?", [attachment, id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[GROUPED DISCHARGE PATCH ERROR]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

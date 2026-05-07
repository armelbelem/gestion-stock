import db from '../../../lib/db'; // Trigger reload
import { authenticateToken } from '../../../lib/auth';
import { logAction } from '../../../lib/actions';
import { NextResponse } from 'next/server';

export async function PUT(request, { params }) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const body = await request.json();
  const { 
    name, logo, address, phone, email, bc_prefix, bl_prefix,
    supervisor_name, supervisor_title, stamp_image, signature_image,
    bl_supervisor_name, bl_supervisor_title, bl_stamp_image, bl_signature_image,
    header_text, rccm, nif, my_client_code, bp
  } = body;

  try {
    await db.query(
      `UPDATE contract_partners SET 
        name = ?, logo = ?, address = ?, phone = ?, email = ?, bc_prefix = ?, bl_prefix = ?,
        supervisor_name = ?, supervisor_title = ?, stamp_image = ?, signature_image = ?,
        bl_supervisor_name = ?, bl_supervisor_title = ?, bl_stamp_image = ?, bl_signature_image = ?,
        header_text = ?, rccm = ?, nif = ?, my_client_code = ?, bp = ?
      WHERE id = ?`,
      [
        name, logo, address, phone, email, bc_prefix, bl_prefix,
        supervisor_name, supervisor_title, stamp_image, signature_image,
        bl_supervisor_name, bl_supervisor_title, bl_stamp_image, bl_signature_image,
        header_text, rccm, nif, my_client_code, bp,
        id
      ]
    );

    await logAction(auth.user.id, auth.user.storeId, 'Modification partenaire contrat', { id, name });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;

  try {
    // Check if partner has orders
    const [orders] = await db.query('SELECT id FROM contract_orders WHERE partner_id = ? LIMIT 1', [id]);
    if (orders.length > 0) {
      return NextResponse.json({ error: 'Impossible de supprimer un partenaire ayant des dossiers actifs.' }, { status: 400 });
    }

    await db.query('DELETE FROM contract_partners WHERE id = ?', [id]);
    await logAction(auth.user.id, auth.user.storeId, 'Suppression partenaire contrat', { id });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

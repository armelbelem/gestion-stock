import db from '../../lib/db';
import { authenticateToken } from '../../lib/auth';
import { logAction } from '../../lib/actions';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const [rows] = await db.query('SELECT * FROM contract_partners ORDER BY name ASC');
    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
    const { 
      name, logo, address, phone, email, bc_prefix, bl_prefix,
      supervisor_name, supervisor_title, stamp_image, signature_image,
      bl_supervisor_name, bl_supervisor_title, bl_stamp_image, bl_signature_image,
      header_text, rccm, nif, my_client_code, bp
    } = body;
    
    if (!name) return NextResponse.json({ error: 'Nom requis' }, { status: 400 });
  
    const id = uuidv4();
    try {
      await db.query(
        `INSERT INTO contract_partners (
          id, name, logo, address, phone, email, bc_prefix, bl_prefix,
          supervisor_name, supervisor_title, stamp_image, signature_image,
          bl_supervisor_name, bl_supervisor_title, bl_stamp_image, bl_signature_image,
          header_text, rccm, nif, my_client_code, bp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, name, logo || null, address || null, phone || null, email || null, bc_prefix || 'BON DE COMMANDE', bl_prefix || 'BORDEREAU DE LIVRAISON',
          supervisor_name || null, supervisor_title || null, stamp_image || null, signature_image || null,
          bl_supervisor_name || null, bl_supervisor_title || null, bl_stamp_image || null, bl_signature_image || null,
          header_text || null, rccm || null, nif || null, my_client_code || null, bp || null
        ]
    );

    await logAction(auth.user.id, auth.user.storeId, 'Création partenaire contrat', { id, name });

    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

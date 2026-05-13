import { NextResponse } from 'next/server';
import db from '../../../lib/db';
import { authenticateToken, hasPermission } from '../../../lib/auth';
import { logAction } from '../../../lib/actions';

export async function PUT(request, { params }) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  
  if (!hasPermission(auth.user, 'admin', 'settings')) {
    return NextResponse.json({ error: 'Droits insuffisants' }, { status: 403 });
  }

  const body = await request.json();
  const { 
    companyName, address, phone, email, nif, rccm, logo, currency, footerMessage, receiptFormat,
    supervisorName, supervisorTitle, stampImage, signatureImage, tvaRate,
    website, bankInfo, taxSystem, secondaryAddress, blSupervisorName, blSupervisorTitle,
    blStampImage, blSignatureImage, bcTitlePrefix, blTitlePrefix, bp, division,
    footerLine1, footerLine2, footerLine3, footerLine4
  } = body;

  try {
    await db.query(`
      UPDATE settings SET 
        companyName = ?, address = ?, phone = ?, email = ?, 
        nif = ?, rccm = ?, logo = ?, currency = ?, 
        footerMessage = ?, receiptFormat = ?,
        supervisorName = ?, supervisorTitle = ?, 
        stampImage = ?, signatureImage = ?, tvaRate = ?,
        website = ?, bankInfo = ?, taxSystem = ?, secondaryAddress = ?,
        blSupervisorName = ?, blSupervisorTitle = ?,
        blStampImage = ?, blSignatureImage = ?,
        bcTitlePrefix = ?, blTitlePrefix = ?,
        bp = ?, division = ?,
        footerLine1 = ?, footerLine2 = ?, footerLine3 = ?, footerLine4 = ?
      WHERE id = 1
    `, [
      companyName, address, phone, email, nif, rccm, logo, currency, footerMessage, receiptFormat,
      supervisorName, supervisorTitle, stampImage, signatureImage, tvaRate,
      website, bankInfo, taxSystem, secondaryAddress, blSupervisorName, blSupervisorTitle,
      blStampImage, blSignatureImage, bcTitlePrefix, blTitlePrefix, bp, division,
      footerLine1, footerLine2, footerLine3, footerLine4
    ]);

    await logAction(auth.user.id, auth.user.storeId, 'Mise à jour paramètres', { companyName });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

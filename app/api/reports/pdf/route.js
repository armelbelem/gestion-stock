import { NextResponse } from 'next/server';
import db from '../../../lib/db';
import { authenticateToken } from '../../../lib/auth';
import { getStoreConstraint } from '../../../lib/actions';
import PDFDocument from 'pdfkit';

export async function GET(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const monthStr = searchParams.get('month');
  const storeId = getStoreConstraint(auth.user, searchParams.get('storeId'));

  if (!monthStr) return NextResponse.json({ error: "Mois requis" }, { status: 400 });

  try {
    // 1. Récupération des données
    const querySales = `SELECT s.*, c.name as clientName 
       FROM sales s LEFT JOIN clients c ON s.clientId = c.id 
       WHERE s.date LIKE ? AND s.status != 'annulée' 
       ${storeId && storeId !== 'all' ? 'AND s.storeId = ?' : ''}
       ORDER BY s.date DESC`;
    
    const paramsSales = storeId && storeId !== 'all' ? [monthStr + '%', storeId] : [monthStr + '%'];
    const [sales] = await db.query(querySales, paramsSales);

    const queryPayments = `SELECT p.* 
       FROM payments p
       WHERE p.date LIKE ? 
       ${storeId && storeId !== 'all' ? 'AND p.storeId = ?' : ''}
       ORDER BY p.date DESC`;
    
    const paramsPayments = storeId && storeId !== 'all' ? [monthStr + '%', storeId] : [monthStr + '%'];
    const [payments] = await db.query(queryPayments, paramsPayments);

    const totalRevenue = sales.reduce((acc, s) => acc + Number(s.totalAmount || 0), 0);
    const totalPaid = payments.reduce((acc, p) => acc + Number(p.amount || 0), 0);

    // 2. Création du PDF
    const pdfBuffer = await new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', err => reject(err));

      // Contenu
      doc.fontSize(22).text('MINING AUTOLOG', { align: 'center' });
      doc.fontSize(14).text(`BILAN FINANCIER MENSUEL - ${monthStr}`, { align: 'center' });
      doc.moveDown();
      doc.fontSize(10).text(`Édité le : ${new Date().toLocaleString('fr-FR')}`, { align: 'right' });
      doc.moveDown(2);

      // Résumé encadré
      doc.fillColor('#f0f0f0').rect(50, doc.y, 500, 75).fill();
      doc.fillColor('#000000').fontSize(12);
      const startY = doc.y + 15;
      doc.text(`Chiffre d'Affaires : ${totalRevenue.toLocaleString()} FCFA`, 70, startY);
      doc.text(`Total Encaissé : ${totalPaid.toLocaleString()} FCFA`, 70, startY + 20);
      doc.text(`Balance : ${(totalRevenue - totalPaid).toLocaleString()} FCFA`, 70, startY + 40);
      doc.moveDown(4);

      // Tableau
      doc.fontSize(14).text('DÉTAIL DES VENTES DU MOIS', { underline: true });
      doc.moveDown();
      
      let tableY = doc.y;
      doc.fontSize(10).text('Date', 50, tableY, { bold: true });
      doc.text('Client', 140, tableY);
      doc.text('Montant', 350, tableY);
      doc.text('Statut', 470, tableY);
      doc.moveTo(50, tableY + 15).lineTo(550, tableY + 15).stroke();
      tableY += 25;

      sales.forEach(sale => {
        if (tableY > 750) { doc.addPage(); tableY = 50; }
        doc.text(new Date(sale.date).toLocaleDateString('fr-FR'), 50, tableY);
        doc.text((sale.clientName || 'Client Divers').substring(0, 30), 140, tableY);
        doc.text(Number(sale.totalAmount || 0).toLocaleString(), 350, tableY);
        doc.text(sale.status || 'Payé', 470, tableY);
        tableY += 18;
      });

      doc.end();
    });

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Bilan_${monthStr}.pdf"`,
      },
    });

  } catch (err) {
    console.error('PDF_GENERATION_ERROR:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

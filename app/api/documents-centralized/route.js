import db from '../../lib/db';
import { authenticateToken, hasPermission } from '../../lib/auth';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  // Sécurité : Seuls ceux ayant accès aux stocks ou achats peuvent voir les documents
  if (!hasPermission(auth.user, 'stock', 'view') && !hasPermission(auth.user, 'procurement', 'view')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'all'; // 'all', 'BC', 'BL'
  const partnerId = searchParams.get('partnerId') || 'all';
  const status = searchParams.get('status') || 'all'; // 'all', 'signed', 'pending'
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const search = searchParams.get('search') || '';

  try {
    let allDocuments = [];

    // --- 1. RÉCUPÉRATION DES BONS DE COMMANDE (BC) ---
    if (type === 'all' || type === 'BC') {
      // A. BC Partenaires
      let bcPartenairesQuery = `
        SELECT 
          bc.id,
          'BC' as docType,
          'partenaire' as docSource,
          bc.bc_number as docNumber,
          bc.title as title,
          bc.request_ref as ref,
          bc.items as itemsJson,
          bc.attachment,
          bc.created_at as date,
          bc.partner_id as partnerId,
          p.name as partnerName,
          NULL as supplierName,
          co.orderNumber as folderNumber,
          co.id as folderId
        FROM contract_bc_history bc
        LEFT JOIN contract_partners p ON bc.partner_id = p.id
        LEFT JOIN contract_orders co ON bc.order_id = co.id
        WHERE 1=1
      `;
      const paramsBC = [];
      if (partnerId !== 'all') {
        bcPartenairesQuery += ' AND bc.partner_id = ?';
        paramsBC.push(partnerId);
      }
      if (startDate && endDate) {
        bcPartenairesQuery += ' AND bc.created_at BETWEEN ? AND ?';
        paramsBC.push(`${startDate} 00:00:00`, `${endDate} 23:59:59`);
      }
      bcPartenairesQuery += ' ORDER BY bc.created_at DESC';
      
      const [bcPartenaires] = await db.query(bcPartenairesQuery, paramsBC);

      // Traiter et unifier les BC Partenaires
      const formattedBcPartenaires = bcPartenaires.map(doc => {
        let items = [];
        try {
          items = doc.itemsJson ? (typeof doc.itemsJson === 'string' ? JSON.parse(doc.itemsJson) : doc.itemsJson) : [];
        } catch (e) {
          console.error("Error parsing items for BC:", doc.id, e);
        }

        // Anonymiser les prix si l'utilisateur n'a pas les droits view_cost_price
        const hasPricePermission = hasPermission(auth.user, 'stock', 'view_cost_price');
        const cleanedItems = items.map(item => ({
          description: item.description || item.name || '',
          code: item.code || '',
          refCfao: item.refCfao || item.ref || '',
          quantity: parseInt(item.quantity) || 0,
          purchasePrice: hasPricePermission ? (parseFloat(item.purchasePrice || item.price) || 0) : 0,
          sellPrice: parseFloat(item.sellPrice) || 0
        }));

        return {
          id: doc.id,
          docType: 'BC',
          docSource: 'partenaire',
          docNumber: doc.docNumber,
          title: doc.title || `Bon de Commande N°${doc.docNumber}`,
          ref: doc.ref || '',
          attachment: doc.attachment || null,
          date: doc.date,
          partnerId: doc.partnerId,
          partnerName: doc.partnerName || 'Partenaire Inconnu',
          supplierName: null,
          folderNumber: doc.folderNumber || null,
          folderId: doc.folderId || null,
          items: cleanedItems
        };
      });

      allDocuments.push(...formattedBcPartenaires);

      // B. BC Spéciaux (Commandes Externes)
      // Seuls ceux qui ont accès aux achats externes peuvent voir
      if (hasPermission(auth.user, 'procurement', 'view')) {
        let bcExternesQuery = `
          SELECT 
            eo.id,
            'BC' as docType,
            'externe' as docSource,
            CONCAT('BCE-', UPPER(LEFT(eo.id, 8))) as docNumber,
            'Commande Spéciale' as title,
            NULL as ref,
            NULL as attachment,
            eo.date as date,
            eo.supplierId,
            f.name as supplierName,
            eo.clientId,
            c.name as clientName
          FROM external_orders eo
          LEFT JOIN fournisseurs f ON eo.supplierId = f.id
          LEFT JOIN clients c ON eo.clientId = c.id
          WHERE 1=1
        `;
        const paramsExt = [];
        if (startDate && endDate) {
          bcExternesQuery += ' AND eo.date BETWEEN ? AND ?';
          paramsExt.push(`${startDate} 00:00:00`, `${endDate} 23:59:59`);
        }
        bcExternesQuery += ' ORDER BY eo.date DESC';

        const [bcExternes] = await db.query(bcExternesQuery, paramsExt);

        for (let eo of bcExternes) {
          const [extItems] = await db.query('SELECT description, quantity, purchasePrice, sellPrice FROM external_order_items WHERE externalOrderId = ?', [eo.id]);
          
          const hasPricePermission = hasPermission(auth.user, 'stock', 'view_cost_price');
          const cleanedItems = extItems.map(item => ({
            description: item.description || '',
            quantity: parseInt(item.quantity) || 0,
            purchasePrice: hasPricePermission ? (parseFloat(item.purchasePrice) || 0) : 0,
            sellPrice: parseFloat(item.sellPrice) || 0
          }));

          allDocuments.push({
            id: eo.id,
            docType: 'BC',
            docSource: 'externe',
            docNumber: eo.docNumber,
            title: `Bon de Commande Externe #${eo.docNumber.split('-')[1]}`,
            ref: '',
            attachment: eo.attachment || null,
            date: eo.date,
            partnerId: eo.clientId || null,
            partnerName: eo.clientName || 'Client Inconnu',
            supplierName: eo.supplierName || 'Fournisseur Inconnu',
            folderNumber: null,
            folderId: null,
            items: cleanedItems
          });
        }
      }
    }

    // --- 2. RÉCUPÉRATION DES BONS DE LIVRAISON (BL) ---
    if (type === 'all' || type === 'BL') {
      let blQuery = `
        SELECT 
          d.id,
          'BL' as docType,
          'partenaire' as docSource,
          d.bl_number as docNumber,
          'Bordereau de Livraison' as title,
          d.items as itemsJson,
          d.attachment,
          d.created_at as date,
          p.name as partnerName,
          co.orderNumber as folderNumber,
          co.id as folderId,
          co.partner_id as partnerId
        FROM deliveries d
        LEFT JOIN contract_orders co ON d.order_id = co.id
        LEFT JOIN contract_partners p ON co.partner_id = p.id
        WHERE 1=1
      `;
      const paramsBL = [];
      if (partnerId !== 'all') {
        blQuery += ' AND co.partner_id = ?';
        paramsBL.push(partnerId);
      }
      if (startDate && endDate) {
        blQuery += ' AND d.created_at BETWEEN ? AND ?';
        paramsBL.push(`${startDate} 00:00:00`, `${endDate} 23:59:59`);
      }
      blQuery += ' ORDER BY d.created_at DESC';

      const [blRows] = await db.query(blQuery, paramsBL);

      const formattedBl = blRows.map(doc => {
        let items = [];
        try {
          items = doc.itemsJson ? (typeof doc.itemsJson === 'string' ? JSON.parse(doc.itemsJson) : doc.itemsJson) : [];
        } catch (e) {
          console.error("Error parsing items for BL:", doc.id, e);
        }

        const hasPricePermission = hasPermission(auth.user, 'stock', 'view_cost_price');
        const cleanedItems = items.map(item => ({
          description: item.description || item.name || '',
          code: item.code || '',
          refCfao: item.refCfao || item.ref || '',
          quantity: parseInt(item.quantity) || 0,
          purchasePrice: hasPricePermission ? (parseFloat(item.purchasePrice || item.price || 0)) : 0,
          sellPrice: parseFloat(item.sellPrice || 0)
        }));

        return {
          id: doc.id,
          docType: 'BL',
          docSource: 'partenaire',
          docNumber: doc.docNumber,
          title: `Bordereau de Livraison N°${doc.docNumber}`,
          ref: '',
          attachment: doc.attachment || null,
          date: doc.date,
          partnerId: doc.partnerId,
          partnerName: doc.partnerName || 'Partenaire Inconnu',
          supplierName: null,
          folderNumber: doc.folderNumber || null,
          folderId: doc.folderId || null,
          items: cleanedItems
        };
      });

      allDocuments.push(...formattedBl);
    }

    // --- 3. FILTRAGE PAR STATUT DE PIÈCE JOINTE ---
    if (status === 'signed') {
      allDocuments = allDocuments.filter(doc => doc.attachment !== null && doc.attachment !== '');
    } else if (status === 'pending') {
      allDocuments = allDocuments.filter(doc => doc.attachment === null || doc.attachment === '');
    }

    // --- 4. FILTRAGE PAR TERME DE RECHERCHE INTÉLLIGENT ---
    if (search.trim() !== '') {
      const q = search.toLowerCase();
      allDocuments = allDocuments.filter(doc => {
        // A. Match direct sur les métadonnées principales
        const numMatch = doc.docNumber?.toLowerCase().includes(q);
        const titleMatch = doc.title?.toLowerCase().includes(q);
        const refMatch = doc.ref?.toLowerCase().includes(q);
        const partnerMatch = doc.partnerName?.toLowerCase().includes(q);
        const supplierMatch = doc.supplierName?.toLowerCase().includes(q);
        const folderMatch = doc.folderNumber?.toString().includes(q);

        if (numMatch || titleMatch || refMatch || partnerMatch || supplierMatch || folderMatch) {
          return true;
        }

        // B. Match à l'intérieur des articles (description, code, refCfao)
        const itemsMatch = doc.items.some(item => 
          item.description?.toLowerCase().includes(q) ||
          item.code?.toLowerCase().includes(q) ||
          item.refCfao?.toLowerCase().includes(q)
        );

        return itemsMatch;
      });
    }

    const isPaginated = searchParams.has('page');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // --- 5. TRI FINAL DES RÉSULTATS PAR DATE DESC ---
    allDocuments.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (isPaginated) {
      const total = allDocuments.length;
      const totalPages = Math.ceil(total / limit);
      
      const totalBc = allDocuments.filter(d => d.docType === 'BC').length;
      const totalBl = allDocuments.filter(d => d.docType === 'BL').length;
      const signedDocs = allDocuments.filter(d => d.attachment !== null && d.attachment !== '').length;
      const signedRate = total > 0 ? Math.round((signedDocs / total) * 100) : 0;

      const offset = (page - 1) * limit;
      const paginatedData = allDocuments.slice(offset, offset + limit);

      return NextResponse.json({
        data: paginatedData,
        pagination: { total, totalPages, page, limit },
        summary: { totalBc, totalBl, totalDocs: total, signedDocs, signedRate }
      });
    }

    return NextResponse.json(allDocuments);
  } catch (err) {
    console.error("[DOCUMENTS CENTRALIZED GET ERROR]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

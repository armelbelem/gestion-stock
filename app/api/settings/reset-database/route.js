import { NextResponse } from 'next/server';
import db from '../../../lib/db';
import { authenticateToken } from '../../../lib/auth';
import { logAction } from '../../../lib/actions';

export async function POST(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  
  // SÉCURITÉ : Seuls les administrateurs peuvent réinitialiser la base
  if (auth.user.role !== 'admin') {
    return NextResponse.json({ error: "Action interdite. Droits administrateur requis." }, { status: 403 });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const tablesToClear = [
      'sales',
      'sale_items',
      'mouvements',
      'transfers',
      'external_orders',
      'external_order_items',
      'payments',
      'annual_reports',
      'logs',
      'fiscal_years',
      'contract_orders',
      'contract_order_items',
      'contract_order_history',
      'contract_bc_history',
      'deliveries',
      'contract_special_docs'
    ];

    console.log('Début du reset base de données par admin:', auth.user.username);
    
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    
    for (const table of tablesToClear) {
      await connection.query(`TRUNCATE TABLE ${table}`);
    }
    
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    
    // On garde une trace de cette action de maintenance lourde
    await logAction(auth.user.id, auth.user.storeId, 'RESET_BASE_DE_DONNEES', { 
      details: 'Réinitialisation complète de l\'historique effectuée via l\'interface interface.' 
    });

    await connection.commit();
    return NextResponse.json({ success: true, message: "Base de données réinitialisée avec succès." });
    
  } catch (err) {
    await connection.rollback();
    console.error('Erreur Reset API:', err);
    return NextResponse.json({ error: "Une erreur est survenue lors de la réinitialisation." }, { status: 500 });
  } finally {
    connection.release();
  }
}

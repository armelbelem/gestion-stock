/**
 * SCRIPT DE RÉINITIALISATION DE L'HISTORIQUE (ERP MINING AUTOLOG)
 * 
 * CE QUE FAIT CE SCRIPT :
 * - Vide tout l'historique des transactions (Ventes, Mouvements, Transferts, Commandes Spéciales).
 * - Vide l'historique des paiements et des rapports annuels.
 * - Vide les exercices fiscaux.
 * 
 * CE QUI EST CONSERVÉ :
 * - Articles et Inventaire actuel (Stock).
 * - Clients, Fournisseurs et Magasins.
 * - Utilisateurs et Configuration (Settings).
 * - Catégories.
 */

import mysql from 'mysql2/promise';

// Configuration de la base de données
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gestion_stock_db',
  port: parseInt(process.env.DB_PORT) || 3306,
};

// Liste des tables à vider (Historique uniquement)
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
  'fiscal_years'
];

async function runReset() {
  console.log('--- DÉBUT DU NETTOYAGE DE LA BASE DE DONNÉES ---');
  
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    // 1. Désactiver les contraintes de clés étrangères pour permettre le TRUNCATE
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    console.log('✔ Sécurité des clés étrangères désactivée.');

    // 2. Vider chaque table de la liste
    for (const table of tablesToClear) {
      try {
        await connection.query(`TRUNCATE TABLE ${table}`);
        console.log(`✔ Table "${table}" vidée.`);
      } catch (tableError) {
        console.warn(`✘ Erreur sur la table "${table}" (elle n'existe peut-être pas) :`, tableError.message);
      }
    }

    // 3. Réactiver les contraintes de clés étrangères
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('✔ Sécurité des clés étrangères réactivée.');

    console.log('------------------------------------------------');
    console.log('SUCCÈS : L\'historique a été réinitialisé avec succès.');
    console.log('NOTE : Pensez à recréer un exercice fiscal dans l\'interface.');
    console.log('------------------------------------------------');

  } catch (error) {
    console.error('❌ ERREUR CRITIQUE lors du reset :', error.message);
  } finally {
    if (connection) await connection.end();
  }
}

runReset();

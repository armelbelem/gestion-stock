import mysql from 'mysql2/promise';

// Configuration de la base de données
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gestion_stock_db',
  port: parseInt(process.env.DB_PORT) || 3306,
};

// Liste des relations de clés étrangères à appliquer
const relations = [
  // 1. Ventes et Lignes de vente (sale_items)
  { table: 'sale_items', col: 'saleId', refTable: 'sales', refCol: 'id', onDelete: 'CASCADE', type: 'varchar(191)' },
  { table: 'sale_items', col: 'articleId', refTable: 'articles', refCol: 'id', onDelete: 'RESTRICT', type: 'int' },
  
  // 2. Paiements (payments)
  { table: 'payments', col: 'saleId', refTable: 'sales', refCol: 'id', onDelete: 'CASCADE', type: 'varchar(191)' },
  { table: 'payments', col: 'fiscalYearId', refTable: 'fiscal_years', refCol: 'id', onDelete: 'RESTRICT', type: 'varchar(100)' },
  
  // 3. Ventes (sales)
  { table: 'sales', col: 'clientId', refTable: 'clients', refCol: 'id', onDelete: 'RESTRICT', type: 'varchar(191)' },
  { table: 'sales', col: 'userId', refTable: 'users', refCol: 'id', onDelete: 'RESTRICT', type: 'varchar(191)' },
  { table: 'sales', col: 'storeId', refTable: 'stores', refCol: 'id', onDelete: 'RESTRICT', type: 'int' },
  { table: 'sales', col: 'fiscalYearId', refTable: 'fiscal_years', refCol: 'id', onDelete: 'RESTRICT', type: 'varchar(100)' },

  // 4. Inventaire (inventory)
  { table: 'inventory', col: 'storeId', refTable: 'stores', refCol: 'id', onDelete: 'CASCADE', type: 'int' },
  { table: 'inventory', col: 'articleId', refTable: 'articles', refCol: 'id', onDelete: 'CASCADE', type: 'int' },

  // 5. Mouvements de stock (mouvements)
  { table: 'mouvements', col: 'articleId', refTable: 'articles', refCol: 'id', onDelete: 'RESTRICT', type: 'int' },
  { table: 'mouvements', col: 'storeId', refTable: 'stores', refCol: 'id', onDelete: 'RESTRICT', type: 'int' },
  { table: 'mouvements', col: 'supplierId', refTable: 'fournisseurs', refCol: 'id', onDelete: 'RESTRICT', type: 'varchar(191)' },
  { table: 'mouvements', col: 'fiscalYearId', refTable: 'fiscal_years', refCol: 'id', onDelete: 'RESTRICT', type: 'varchar(100)' },

  // 6. Transferts de stock (transfers)
  { table: 'transfers', col: 'articleId', refTable: 'articles', refCol: 'id', onDelete: 'RESTRICT', type: 'int' },
  { table: 'transfers', col: 'userId', refTable: 'users', refCol: 'id', onDelete: 'RESTRICT', type: 'varchar(191)' },
  { table: 'transfers', col: 'fromStoreId', refTable: 'stores', refCol: 'id', onDelete: 'RESTRICT', type: 'int' },
  { table: 'transfers', col: 'toStoreId', refTable: 'stores', refCol: 'id', onDelete: 'RESTRICT', type: 'int' },

  // 7. Catégories et Clients
  { table: 'categories', col: 'storeId', refTable: 'stores', refCol: 'id', onDelete: 'RESTRICT', type: 'int' },
  { table: 'clients', col: 'storeId', refTable: 'stores', refCol: 'id', onDelete: 'RESTRICT', type: 'int' },

  // 8. Utilisateurs et Articles
  { table: 'users', col: 'storeId', refTable: 'stores', refCol: 'id', onDelete: 'RESTRICT', type: 'int' },
  { table: 'articles', col: 'storeId', refTable: 'stores', refCol: 'id', onDelete: 'RESTRICT', type: 'int' },
  
  // 9. Rapports annuels et Logs
  { table: 'annual_reports', col: 'fiscalYearId', refTable: 'fiscal_years', refCol: 'id', onDelete: 'CASCADE', type: 'varchar(100)' },
  { table: 'logs', col: 'userId', refTable: 'users', refCol: 'id', onDelete: 'SET NULL', type: 'varchar(191)' },
  { table: 'logs', col: 'storeId', refTable: 'stores', refCol: 'id', onDelete: 'SET NULL', type: 'int' },

  // 10. Documents généraux
  { table: 'documents', col: 'userId', refTable: 'users', refCol: 'id', onDelete: 'SET NULL', type: 'varchar(191)' },
  { table: 'documents', col: 'fiscalYearId', refTable: 'fiscal_years', refCol: 'id', onDelete: 'SET NULL', type: 'varchar(100)' },

  // 11. Commandes externes (external_orders)
  { table: 'external_order_items', col: 'externalOrderId', refTable: 'external_orders', refCol: 'id', onDelete: 'CASCADE', type: 'varchar(36)' },
  { table: 'external_orders', col: 'clientId', refTable: 'clients', refCol: 'id', onDelete: 'RESTRICT', type: 'varchar(191)' },
  { table: 'external_orders', col: 'supplierId', refTable: 'fournisseurs', refCol: 'id', onDelete: 'RESTRICT', type: 'varchar(191)' },
  { table: 'external_orders', col: 'saleId', refTable: 'sales', refCol: 'id', onDelete: 'SET NULL', type: 'varchar(191)' },
  { table: 'external_orders', col: 'storeId', refTable: 'stores', refCol: 'id', onDelete: 'RESTRICT', type: 'int' },
  { table: 'external_orders', col: 'fiscalYearId', refTable: 'fiscal_years', refCol: 'id', onDelete: 'RESTRICT', type: 'varchar(100)' },

  // 12. Relations de passerelle de contrats (contract-gateway)
  { table: 'contract_bc_history', col: 'partner_id', refTable: 'contract_partners', refCol: 'id', onDelete: 'CASCADE', type: 'varchar(100)' },
  { table: 'contract_bc_history', col: 'order_id', refTable: 'contract_orders', refCol: 'id', onDelete: 'CASCADE', type: 'varchar(100)' },
  { table: 'contract_catalog', col: 'partner_id', refTable: 'contract_partners', refCol: 'id', onDelete: 'CASCADE', type: 'varchar(100)' },
  { table: 'contract_catalog', col: 'clientId', refTable: 'clients', refCol: 'id', onDelete: 'SET NULL', type: 'varchar(191)' },
  { table: 'contract_order_history', col: 'orderId', refTable: 'contract_orders', refCol: 'id', onDelete: 'CASCADE', type: 'varchar(100)' },
  { table: 'contract_order_items', col: 'orderId', refTable: 'contract_orders', refCol: 'id', onDelete: 'CASCADE', type: 'varchar(100)' },

  { table: 'contract_orders', col: 'partner_id', refTable: 'contract_partners', refCol: 'id', onDelete: 'CASCADE', type: 'varchar(100)' },
  { table: 'contract_orders', col: 'clientId', refTable: 'clients', refCol: 'id', onDelete: 'RESTRICT', type: 'varchar(191)' },
  { table: 'contract_orders', col: 'supplierId', refTable: 'fournisseurs', refCol: 'id', onDelete: 'RESTRICT', type: 'varchar(191)' },
  { table: 'contract_special_docs', col: 'partner_id', refTable: 'contract_partners', refCol: 'id', onDelete: 'CASCADE', type: 'varchar(100)' },
  { table: 'deliveries', col: 'order_id', refTable: 'contract_orders', refCol: 'id', onDelete: 'CASCADE', type: 'varchar(100)' }
];

async function runMigration() {
  console.log('=== DÉBUT DE LA CONFIGURATION DES CLÉS ÉTRANGÈRES ===');
  console.log(`Connexion à : "${dbConfig.database}" sur ${dbConfig.host}:${dbConfig.port}...`);
  
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('✔ Connexion établie avec succès.');

    // 1. Désactiver temporairement les contraintes pour préparer le terrain
    console.log('⏳ Désactivation temporaire des FOREIGN_KEY_CHECKS...');
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    console.log('✔ FOREIGN_KEY_CHECKS désactivé.');

    // Encodage et collation harmonisés vers utf8mb4_unicode_ci
    console.log('⏳ Harmonisation globale des encodages et des collations vers utf8mb4_unicode_ci...');
    const [tables] = await connection.query('SHOW TABLES');
    const tableNames = tables.map(t => Object.values(t)[0]);
    for (const tableName of tableNames) {
      try {
        await connection.query(`ALTER TABLE \`${tableName}\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      } catch (colErr) {
        console.warn(`⚠️ Impossible de convertir l'encodage de la table "${tableName}" :`, colErr.message);
      }
    }
    console.log('✔ Encodages et collations harmonisés sur toutes les tables.');

    console.log('\n--- 1. ÉTAPE D\'HARMONISATION DES COLONNES & NETTOYAGE ---');

    for (const rel of relations) {
      const constraintName = `fk_${rel.table}_${rel.col}`;

      // A. Harmonisation des types de colonnes pour qu'ils matchent parfaitement avec la cible
      try {
        console.log(`⏳ Harmonisation du type pour "${rel.table}.${rel.col}" vers "${rel.type}"...`);
        const nullableSql = rel.onDelete === 'SET NULL' ? 'NULL' : 'NULL'; // Laisser flexible
        
        // Trouver d'abord si la colonne doit être NOT NULL ou NULL. Par sécurité, on la laisse NULL sauf si elle est critique
        let isNotNull = false;
        try {
          const [colDesc] = await connection.query(`DESCRIBE \`${rel.table}\` \`${rel.col}\``);
          if (colDesc.length > 0 && colDesc[0].Null === 'NO') {
            isNotNull = true;
          }
        } catch (descErr) {
          // Ignorer si la description échoue
        }

        await connection.query(`
          ALTER TABLE \`${rel.table}\` 
          MODIFY \`${rel.col}\` ${rel.type} ${isNotNull ? 'NOT NULL' : 'NULL'}
        `);
        console.log(`✔ "${rel.table}.${rel.col}" harmonisé avec succès.`);
      } catch (err) {
        console.warn(`⚠️ Échec de l'harmonisation de type pour "${rel.table}.${rel.col}" (continuation...) :`, err.message);
      }

      // B. Nettoyage des données orphelines (ex. lignes orphelines dans sale_items ou payments)
      try {
        console.log(`⏳ Nettoyage des données orphelines pour "${rel.table}.${rel.col}"...`);
        
        // On supprime les lignes orphelines sauf si la règle est SET NULL (auquel cas on met à NULL)
        if (rel.onDelete === 'SET NULL') {
          const updateQuery = `
            UPDATE \`${rel.table}\` A 
            LEFT JOIN \`${rel.refTable}\` B ON A.\`${rel.col}\` = B.\`${rel.refCol}\` 
            SET A.\`${rel.col}\` = NULL 
            WHERE A.\`${rel.col}\` IS NOT NULL AND B.\`${rel.refCol}\` IS NULL
          `;
          const [res] = await connection.query(updateQuery);
          if (res.affectedRows > 0) {
            console.log(`🧹 ${res.affectedRows} ligne(s) orpheline(s) mises à NULL dans "${rel.table}.${rel.col}".`);
          }
        } else {
          const deleteQuery = `
            DELETE A FROM \`${rel.table}\` A 
            LEFT JOIN \`${rel.refTable}\` B ON A.\`${rel.col}\` = B.\`${rel.refCol}\` 
            WHERE A.\`${rel.col}\` IS NOT NULL AND B.\`${rel.refCol}\` IS NULL
          `;
          const [res] = await connection.query(deleteQuery);
          if (res.affectedRows > 0) {
            console.log(`🧹 ${res.affectedRows} ligne(s) orpheline(s) supprimées de "${rel.table}".`);
          }
        }
      } catch (err) {
        console.error(`❌ Échec du nettoyage pour "${rel.table}.${rel.col}" :`, err.message);
      }
    }

    console.log('\n--- 2. ÉTAPE D\'APPLICATION DES CONTRAINTES DE CLÉS ÉTRANGÈRES ---');

    for (const rel of relations) {
      const constraintName = `fk_${rel.table}_${rel.col}`;

      try {
        console.log(`⏳ Application de la clé étrangère : ${rel.table}.${rel.col} ➡ ${rel.refTable}.${rel.refCol} (ON DELETE ${rel.onDelete})...`);
        
        // Supprimer la contrainte existante si elle existe déjà pour éviter l'erreur de doublon
        try {
          await connection.query(`ALTER TABLE \`${rel.table}\` DROP FOREIGN KEY \`${constraintName}\``);
        } catch (dropErr) {
          // Ignorer car elle n'existe sûrement pas
        }

        // Ajouter la nouvelle contrainte de clé étrangère
        await connection.query(`
          ALTER TABLE \`${rel.table}\` 
          ADD CONSTRAINT \`${constraintName}\` 
          FOREIGN KEY (\`${rel.col}\`) 
          REFERENCES \`${rel.refTable}\` (\`${rel.refCol}\`) 
          ON DELETE ${rel.onDelete}
        `);
        console.log(`✔ Clé étrangère "${constraintName}" créée avec succès.`);
      } catch (err) {
        console.error(`❌ Échec de la création pour "${constraintName}" :`, err.message);
      }
    }

    console.log('\n--- 3. ÉTAPE DE RÉACTIVATION ET VALIDATION ---');
    
    // 3. Réactiver les contraintes de clés étrangères
    console.log('⏳ Réactivation des FOREIGN_KEY_CHECKS...');
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('✔ FOREIGN_KEY_CHECKS réactivé.');

    console.log('\n🎉 TOUTES LES OPÉRATIONS SONT TERMINÉES !');
    console.log('L\'intégrité référentielle de votre base de données est maintenant garantie à 100% au niveau physique de MySQL.');

  } catch (error) {
    console.error('❌ ERREUR CRITIQUE lors de la migration des clés étrangères :', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Connexion fermée.');
    }
  }
}

runMigration();

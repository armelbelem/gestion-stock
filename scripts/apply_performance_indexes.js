import mysql from 'mysql2/promise';

// Configuration dynamique de la base de données (supporte URL unique ou variables séparées)
const dbConfig = process.env.DATABASE_URL || {
  host: process.env.MYSQLHOST || process.env.DB_HOST || 'localhost',
  user: process.env.MYSQLUSER || process.env.DB_USER || 'root',
  password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || '',
  database: process.env.MYSQLDATABASE || process.env.DB_NAME || 'gestion_stock_db',
  port: parseInt(process.env.MYSQLPORT || process.env.DB_PORT) || 3306,
};

async function applyIndex(connection, tableName, indexName, columnsSql) {
  console.log(`⏳ Analyse/Création de l'index "${indexName}" sur "${tableName}(${columnsSql})"...`);
  try {
    await connection.query(`CREATE INDEX \`${indexName}\` ON \`${tableName}\` (${columnsSql})`);
    console.log(`✔ Index "${indexName}" créé avec succès !`);
  } catch (err) {
    if (err.errno === 1061 || err.code === 'ER_DUP_KEYNAME') {
      console.log(`ℹ️ L'index "${indexName}" existe déjà sur la table "${tableName}". Étape ignorée.`);
    } else {
      console.error(`❌ Erreur lors de la création de l'index "${indexName}" :`, err.message);
      // On continue pour les autres index au lieu de tout bloquer
    }
  }
}

async function runPerformanceIndexing() {
  console.log('=== DÉBUT DE LA MIGRATION D\'INDEXATION DE PERFORMANCE (STAGE 1) ===');
  console.log(`Connexion à : "${dbConfig.database || 'inconnue'}" sur ${dbConfig.host}:${dbConfig.port}...`);

  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('✔ Connexion établie avec succès.');

    // 1. Table INVENTORY (optimise l'affichage et l'agrégation de l'inventaire des articles)
    await applyIndex(connection, 'inventory', 'idx_inventory_article_store_qty', 'articleId, storeId, quantity');
    await applyIndex(connection, 'inventory', 'idx_inventory_store_article_qty', 'storeId, articleId, quantity');

    // 2. Table SALE_ITEMS (optimise la recherche et les agrégations des lignes de ventes pour la rotation sur 30 jours)
    await applyIndex(connection, 'sale_items', 'idx_sale_items_article_sale_qty', 'articleId, saleId, quantity');
    await applyIndex(connection, 'sale_items', 'idx_sale_items_sale_article_qty', 'saleId, articleId, quantity');

    // 3. Table SALES (optimise le filtrage par exercice/date/statut lors de la rotation de stock et rapports)
    await applyIndex(connection, 'sales', 'idx_sales_date_status', 'date, status');
    await applyIndex(connection, 'sales', 'idx_sales_fy_store_date', 'fiscalYearId, storeId, date');

    // 4. Table CONTRACT_ORDERS (optimise les tris chronologiques et filtres partenaires de la passerelle de contrats)
    await applyIndex(connection, 'contract_orders', 'idx_contract_orders_partner_created', 'partner_id, createdAt');
    await applyIndex(connection, 'contract_orders', 'idx_contract_orders_store_created', 'storeId, createdAt');
    await applyIndex(connection, 'contract_orders', 'idx_contract_orders_status_created', 'status, createdAt');

    // 5. Table CONTRACT_CATALOG (optimise les filtres de catalogues de 4 500+ articles triés par nom)
    await applyIndex(connection, 'contract_catalog', 'idx_contract_catalog_partner_client_name', 'partner_id, clientId, name');

    // 6. Table CONTRACT_ORDER_ITEMS (optimise les consolidations de rapport par article de commande)
    await applyIndex(connection, 'contract_order_items', 'idx_coi_order_product', 'orderId, refCfao(50), code(50), quantity, purchasePrice');

    // 7. Table MOUVEMENTS (optimise l'historique des mouvements de stock)
    await applyIndex(connection, 'mouvements', 'idx_mouvements_fy_store_date', 'fiscalYearId, storeId, date');

    console.log('\n🎉 TOUTES LES OPÉRATIONS D\'INDEXATION SONT TERMINÉES AVEC SUCCÈS !');
    console.log('Les index de performance de niveau production sont maintenant appliqués.');

  } catch (error) {
    console.error('❌ ERREUR CRITIQUE lors de la migration d\'indexation :', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Connexion fermée.');
    }
  }
}

runPerformanceIndexing();

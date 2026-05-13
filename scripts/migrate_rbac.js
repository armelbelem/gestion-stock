import mysql from 'mysql2/promise';

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gestion_stock_db',
  port: parseInt(process.env.DB_PORT) || 3306,
};

const defaultPermissions = {
  admin: {
    stock: { view: true, create: true, edit: true, delete: true, move: true },
    sales: { create: true, cancel: true, view_prices: true, proforma: true, view_all: true },
    procurement: { view: true, create: true, validate: true },
    finances: { view: true, export: true },
    admin: { users: true, settings: true, logs: true }
  },
  gestionnaire: {
    stock: { view: true, create: true, edit: true, delete: true, move: true },
    sales: { create: true, cancel: true, view_prices: true, proforma: true, view_all: true },
    procurement: { view: true, create: true, validate: true },
    finances: { view: true, export: true },
    admin: { users: false, settings: false, logs: false }
  },
  vendeur: {
    stock: { view: true, create: false, edit: false, delete: false, move: false },
    sales: { create: true, cancel: false, view_prices: false, proforma: false, view_all: false },
    procurement: { view: false, create: false, validate: false },
    finances: { view: false, export: false },
    admin: { users: false, settings: false, logs: false }
  }
};

async function migrate() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('--- MIGRATION : AJOUT DE LA GRILLE DE PERMISSIONS ---');

    // 1. Ajouter la colonne permissions si elle n'existe pas
    const [columns] = await connection.query("SHOW COLUMNS FROM users LIKE 'permissions'");
    if (columns.length === 0) {
      await connection.query("ALTER TABLE users ADD COLUMN permissions JSON NULL");
      console.log('✔ Colonne "permissions" ajoutée à la table users.');
    } else {
      console.log('ℹ La colonne "permissions" existe déjà.');
    }

    // 2. Mettre à jour les permissions par défaut basées sur les rôles actuels
    const [users] = await connection.query("SELECT id, role FROM users");
    for (const user of users) {
      const perms = defaultPermissions[user.role] || defaultPermissions.vendeur;
      await connection.query("UPDATE users SET permissions = ? WHERE id = ?", [JSON.stringify(perms), user.id]);
      console.log(`✔ Permissions initialisées pour l'utilisateur ${user.id} (${user.role}).`);
    }

    console.log('--- MIGRATION TERMINÉE AVEC SUCCÈS ---');
  } catch (err) {
    console.error('❌ ERREUR MIGRATION :', err.message);
  } finally {
    if (connection) await connection.end();
  }
}

migrate();

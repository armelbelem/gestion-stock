import mysql from 'mysql2/promise';

// Support pour l'URL complète (AWS RDS / Railway) ou les variables séparées
const dbConfig = process.env.DATABASE_URL || {
  host: process.env.MYSQLHOST || process.env.DB_HOST || 'localhost',
  user: process.env.MYSQLUSER || process.env.DB_USER || 'root',
  password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || '',
  database: process.env.MYSQLDATABASE || process.env.DB_NAME || 'gestion_stock_db',
  port: process.env.MYSQLPORT || process.env.DB_PORT || 3306,
};

// Utilisation d'un singleton pour le pool de connexions (évite les fuites en développement)
let pool;

if (!global._mysqlPool) {
  global._mysqlPool = mysql.createPool(typeof dbConfig === 'string' ? dbConfig : {
    ...dbConfig,
    waitForConnections: true,
    connectionLimit: 20, // Équilibré à 20 pour allier haute performance et stabilité
    queueLimit: 0,
    dateStrings: true,
    charset: 'utf8mb4'
  });
}
pool = global._mysqlPool;

export default pool;

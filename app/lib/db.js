import mysql from 'mysql2/promise';

// Support pour l'URL complète (AWS RDS / Railway) ou les variables séparées
const dbConfig = process.env.DATABASE_URL || {
  host: process.env.MYSQLHOST || process.env.DB_HOST || 'localhost',
  user: process.env.MYSQLUSER || process.env.DB_USER || 'root',
  password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || '',
  database: process.env.MYSQLDATABASE || process.env.DB_NAME || 'gestion_stock_db',
  port: process.env.MYSQLPORT || process.env.DB_PORT || 3306,
};

const pool = mysql.createPool(typeof dbConfig === 'string' ? dbConfig : {
  ...dbConfig,
  waitForConnections: true,
  connectionLimit: 30,
  queueLimit: 0,
  dateStrings: true,
  charset: 'utf8mb4'
});

export default pool;

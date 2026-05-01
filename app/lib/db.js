import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.MYSQLHOST || process.env.DB_HOST || 'localhost',
  user: process.env.MYSQLUSER || process.env.DB_USER || 'root',
  password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || '',
  database: process.env.MYSQLDATABASE || process.env.DB_NAME || 'gestion_stock_db',
  port: process.env.MYSQLPORT || process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 30,
  queueLimit: 0,
  dateStrings: true,
  charset: 'utf8mb4'
});

export default pool;

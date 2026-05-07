import mysql from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'gestion_stock_db',
  port: 3306,
};

async function migrate() {
  const connection = await mysql.createConnection(dbConfig);
  console.log("Starting migration for multi-partner support...");

  try {
    // 1. Create contract_partners table
    console.log("Creating contract_partners table...");
    await connection.query(`
      CREATE TABLE IF NOT EXISTS contract_partners (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        logo TEXT,
        address TEXT,
        phone VARCHAR(100),
        email VARCHAR(255),
        bc_prefix VARCHAR(255) DEFAULT 'BON DE COMMANDE',
        bl_prefix VARCHAR(255) DEFAULT 'BORDEREAU DE LIVRAISON',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Insert CFAO as first partner if not exists
    const cfaoId = 'cfao-fixed-id-001'; // Fixed ID for initial migration
    const [existing] = await connection.query('SELECT id FROM contract_partners WHERE name = "CFAO"');
    
    if (existing.length === 0) {
      console.log("Inserting CFAO as first partner...");
      await connection.query(
        'INSERT INTO contract_partners (id, name, bc_prefix) VALUES (?, ?, ?)',
        [cfaoId, 'CFAO', 'BON DE COMMANDE N°NSA-CFAO']
      );
    } else {
      console.log("Partner CFAO already exists.");
    }

    const currentPartnerId = existing.length > 0 ? existing[0].id : cfaoId;

    // 3. Add partner_id to contract tables
    const tablesToAlter = [
      'contract_orders',
      'contract_catalog',
      'contract_special_docs',
      'contract_bc_history'
    ];

    for (const table of tablesToAlter) {
      console.log(`Checking table ${table} for partner_id column...`);
      const [columns] = await connection.query(`SHOW COLUMNS FROM ${table} LIKE 'partner_id'`);
      
      if (columns.length === 0) {
        console.log(`Adding partner_id to ${table}...`);
        await connection.query(`ALTER TABLE ${table} ADD COLUMN partner_id VARCHAR(100) AFTER id`);
        
        console.log(`Linking existing records in ${table} to CFAO...`);
        await connection.query(`UPDATE ${table} SET partner_id = ? WHERE partner_id IS NULL`, [currentPartnerId]);
      } else {
        console.log(`Column partner_id already exists in ${table}.`);
      }
    }

    console.log("Migration completed successfully!");
  } catch (err) {
    console.error("Migration failed:", err.message);
  } finally {
    await connection.end();
  }
}

migrate();

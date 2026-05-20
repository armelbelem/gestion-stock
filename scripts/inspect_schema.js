import mysql from 'mysql2/promise';
import fs from 'fs';

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gestion_stock_db',
  port: parseInt(process.env.DB_PORT) || 3306,
};

async function inspect() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('Connected to database!');

    // 1. Get all tables
    const [tables] = await connection.query('SHOW TABLES');
    const tableNames = tables.map(t => Object.values(t)[0]);
    console.log('Tables in database:', tableNames);

    // 2. Describe each table and print column info
    const schema = {};
    for (const tableName of tableNames) {
      const [columns] = await connection.query(`DESCRIBE \`${tableName}\``);
      schema[tableName] = columns.map(c => ({
        Field: c.Field,
        Type: c.Type,
        Null: c.Null,
        Key: c.Key,
        Default: c.Default,
        Extra: c.Extra
      }));
    }

    console.log('SCHEMA_JSON_START');
    const schemaJson = JSON.stringify(schema, null, 2);
    console.log('SCHEMA_JSON_END');

    // Write to file to avoid truncation
    fs.writeFileSync('scripts/db_schema_details.json', schemaJson);
    console.log('Schema saved to scripts/db_schema_details.json');

  } catch (error) {
    console.error('Error during inspection:', error);
  } finally {
    if (connection) await connection.end();
  }
}

inspect();

import pool from '../app/lib/db.js';

async function run() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS document_sequences (
        id varchar(50) NOT NULL,
        doc_type varchar(10) NOT NULL,
        doc_date date NOT NULL,
        last_sequence int(11) NOT NULL DEFAULT 0,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('Table created!');
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

run();

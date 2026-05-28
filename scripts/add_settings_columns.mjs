import pool from '../app/lib/db.js';

async function run() {
  try {
    await pool.query("ALTER TABLE settings ADD COLUMN bcNumberFormat VARCHAR(100) DEFAULT 'BC-{ID}-{DATE}'");
    await pool.query("ALTER TABLE settings ADD COLUMN blNumberFormat VARCHAR(100) DEFAULT 'BL-{ID}-{DATE}'");
    console.log('Columns added!');
  } catch(e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log('Columns already exist.');
    } else {
      console.log(e);
    }
  }
  process.exit(0);
}

run();

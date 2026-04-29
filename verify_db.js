import dbModule from './app/lib/db.js';

async function verify() {
  try {
    const [rows] = await dbModule.query('SELECT COUNT(*) as count FROM articles');
    console.log(`Total articles in DB: ${rows[0].count}`);
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}

verify();

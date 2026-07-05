import { NextResponse } from 'next/server';
import db from '../../../lib/db';
import { authenticateToken } from '../../../lib/auth';

// Helper to ensure the saved_reports table exists
async function ensureTableExists() {
  const query = `
    CREATE TABLE IF NOT EXISTS \`saved_reports\` (
      \`report_type\` VARCHAR(50) NOT NULL,
      \`store_id\` VARCHAR(50) NOT NULL DEFAULT 'all',
      \`file_a_name\` VARCHAR(255) DEFAULT NULL,
      \`file_b_name\` VARCHAR(255) DEFAULT NULL,
      \`report_data\` LONGTEXT NOT NULL,
      \`generated_by\` VARCHAR(255) DEFAULT NULL,
      \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`report_type\`, \`store_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  await db.query(query);

  // Check if store_id column exists, if not, alter table
  const [columns] = await db.query("SHOW COLUMNS FROM `saved_reports` LIKE 'store_id'");
  if (columns.length === 0) {
    try {
      await db.query("ALTER TABLE `saved_reports` DROP PRIMARY KEY");
      await db.query("ALTER TABLE `saved_reports` ADD COLUMN `store_id` VARCHAR(50) NOT NULL DEFAULT 'all'");
      await db.query("ALTER TABLE `saved_reports` ADD PRIMARY KEY (`report_type`, `store_id`)");
    } catch (err) {
      console.error('[MIGRATION ERROR saved_reports]', err);
    }
  }
}

export async function GET(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const storeId = searchParams.get('storeId') || 'all';

  if (!type) {
    return NextResponse.json({ error: 'Le type de rapport est requis.' }, { status: 400 });
  }

  try {
    await ensureTableExists();
    const [rows] = await db.query('SELECT * FROM saved_reports WHERE report_type = ? AND store_id = ?', [type, storeId]);
    if (rows.length === 0) {
      return NextResponse.json(null);
    }
    
    const row = rows[0];
    return NextResponse.json({
      type: row.report_type,
      storeId: row.store_id,
      fileAName: row.file_a_name,
      fileBName: row.file_b_name,
      data: JSON.parse(row.report_data),
      generatedBy: row.generated_by,
      updatedAt: row.updated_at
    });
  } catch (err) {
    console.error('[GET SAVED REPORT ERROR]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await request.json();
    const { type, fileAName, fileBName, data, storeId } = body;

    if (!type || !data) {
      return NextResponse.json({ error: 'Le type et les données du rapport sont requis.' }, { status: 400 });
    }

    const resolvedStoreId = storeId || 'all';

    await ensureTableExists();
    const generatedBy = auth.user?.name || auth.user?.username || 'Système';
    const reportDataStr = JSON.stringify(data);

    await db.query(
      `INSERT INTO saved_reports (report_type, store_id, file_a_name, file_b_name, report_data, generated_by, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         file_a_name = VALUES(file_a_name),
         file_b_name = VALUES(file_b_name),
         report_data = VALUES(report_data),
         generated_by = VALUES(generated_by),
         updated_at = NOW()`,
      [type, resolvedStoreId, fileAName, fileBName, reportDataStr, generatedBy]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[POST SAVED REPORT ERROR]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const storeId = searchParams.get('storeId') || 'all';

  if (!type) {
    return NextResponse.json({ error: 'Le type de rapport est requis.' }, { status: 400 });
  }

  try {
    await ensureTableExists();
    await db.query('DELETE FROM saved_reports WHERE report_type = ? AND store_id = ?', [type, storeId]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE SAVED REPORT ERROR]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

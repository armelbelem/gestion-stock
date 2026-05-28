import { NextResponse } from 'next/server';
import pool from '../../lib/db';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');

  if (!type || (type !== 'BC' && type !== 'BL')) {
    return NextResponse.json({ error: 'Type invalide. Doit être BC ou BL.' }, { status: 400 });
  }

  try {
    const today = new Date();
    // Use local time for the date to match the user's timezone if possible, or just UTC
    // Since this runs on server, let's format it in YYYY-MM-DD
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const dbDate = `${yyyy}-${mm}-${dd}`;
    
    const id = `${type}-${dbDate}`; // e.g. "BC-2026-05-28"

    // Transaction to ensure atomicity
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Insert if not exists with sequence=1, else increment sequence
      await connection.query(`
        INSERT INTO document_sequences (id, doc_type, doc_date, last_sequence)
        VALUES (?, ?, ?, 1)
        ON DUPLICATE KEY UPDATE last_sequence = last_sequence + 1
      `, [id, type, dbDate]);

      // Retrieve the updated sequence
      const [rows] = await connection.query(`
        SELECT last_sequence FROM document_sequences WHERE id = ?
      `, [id]);

      await connection.commit();
      connection.release();

      const sequence = rows[0].last_sequence;
      // Format: 001
      const paddedSequence = String(sequence).padStart(3, '0');
      // Format: DDMM-YYYY
      const formattedDate = `${dd}${mm}-${yyyy}`;

      const documentNumber = `${type}-${paddedSequence}-${formattedDate}`;

      return NextResponse.json({ documentNumber, sequence, type, date: formattedDate });
    } catch (err) {
      await connection.rollback();
      connection.release();
      throw err;
    }
  } catch (error) {
    console.error('Erreur lors de la génération de la séquence:', error);
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}

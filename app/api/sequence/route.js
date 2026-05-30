import { NextResponse } from 'next/server';
import pool from '../../lib/db';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const orderId = searchParams.get('orderId');

  if (!type || (type !== 'BC' && type !== 'BL')) {
    return NextResponse.json({ error: 'Type invalide. Doit être BC ou BL.' }, { status: 400 });
  }

  try {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const dbDate = `${yyyy}-${mm}-${dd}`;
    const formattedDate = `${dd}${mm}-${yyyy}`;

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // --- CAS 1 : Un orderId est fourni ---
      // On cherche si ce dossier a déjà une séquence attribuée
      if (orderId) {
        const orderKey = `ORDER-${orderId}`;
        const [existing] = await connection.query(
          'SELECT last_sequence, doc_date FROM document_sequences WHERE id = ?',
          [orderKey]
        );

        if (existing.length > 0) {
          // Ce dossier a déjà un numéro : on le retourne tel quel (réimpression)
          await connection.commit();
          connection.release();

          const seq = existing[0].last_sequence;
          const storedDate = existing[0].doc_date; // format YYYY-MM-DD
          const [sy, sm, sd] = storedDate.toString().split('T')[0].split('-');
          const storedFormatted = `${sd}${sm}-${sy}`;
          const paddedSeq = String(seq).padStart(3, '0');
          const documentNumber = `${type}-${paddedSeq}-${storedFormatted}`;
          return NextResponse.json({ documentNumber, sequence: seq, type, date: storedFormatted });
        }
      }

      // --- CAS 2 : Première impression pour ce dossier (ou pas d'orderId) ---
      // Générer un nouveau numéro journalier partagé (compteur du jour)
      const dailyKey = `DAILY-${dbDate}`;
      await connection.query(`
        INSERT INTO document_sequences (id, doc_type, doc_date, last_sequence)
        VALUES (?, 'DAILY', ?, 1)
        ON DUPLICATE KEY UPDATE last_sequence = last_sequence + 1
      `, [dailyKey, dbDate]);

      const [dailyRows] = await connection.query(
        'SELECT last_sequence FROM document_sequences WHERE id = ?',
        [dailyKey]
      );
      const sequence = dailyRows[0].last_sequence;

      // Mémoriser ce numéro pour ce dossier (pour les réimpressions futures)
      if (orderId) {
        const orderKey = `ORDER-${orderId}`;
        await connection.query(`
          INSERT INTO document_sequences (id, doc_type, doc_date, last_sequence)
          VALUES (?, 'ORDER', ?, ?)
          ON DUPLICATE KEY UPDATE last_sequence = last_sequence
        `, [orderKey, dbDate, sequence]);
      }

      await connection.commit();
      connection.release();

      const paddedSequence = String(sequence).padStart(3, '0');
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

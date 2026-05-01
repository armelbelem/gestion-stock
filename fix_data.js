import pool from './app/lib/db.js';
import { v4 as uuidv4 } from 'uuid';

async function fix() {
    try {
        console.log('Fixing data after migration...');
        
        // 1. Assign articles to store 1 (MANDA) if they have storeId = 0
        await pool.query('UPDATE articles SET storeId = 1 WHERE storeId = 0');
        console.log('Updated articles storeId.');

        // 2. Fix inventory table
        // First, remove invalid entries (those with 0)
        await pool.query('DELETE FROM inventory WHERE storeId = 0 OR articleId = 0');
        console.log('Cleaned up inventory.');

        // 3. Regenerate inventory for articles that don't have one
        const [articles] = await pool.query('SELECT id, storeId, currentStock, minStock FROM articles');
        let count = 0;
        for (const art of articles) {
            const [existing] = await pool.query('SELECT id FROM inventory WHERE articleId = ? AND storeId = ?', [art.id, art.storeId]);
            if (existing.length === 0) {
                await pool.query('INSERT INTO inventory (id, storeId, articleId, quantity, minStock) VALUES (?, ?, ?, ?, ?)',
                    [uuidv4(), art.storeId, art.id, art.currentStock || 0, art.minStock || 0]);
                count++;
            }
        }
        console.log(`Regenerated ${count} inventory entries.`);

        console.log('Data fix completed.');
    } catch (error) {
        console.error('Fix failed:', error);
    } finally {
        process.exit(0);
    }
}

fix();

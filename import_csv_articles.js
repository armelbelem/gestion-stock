import fs from 'fs';
import pool from './app/lib/db.js';
import { v4 as uuidv4 } from 'uuid';

async function importCSV() {
    const connection = await pool.getConnection();
    try {
        console.log('--- Importation avec nettoyage du format ---');
        const data = fs.readFileSync('articles.csv', 'utf8');
        const lines = data.split('\n');
        
        let headerIndex = -1;
        for(let i=0; i<lines.length; i++) {
            const cleanLine = lines[i].toLowerCase().replace(/"/g, '');
            if (cleanLine.includes('name,price,currentstock')) {
                headerIndex = i;
                break;
            }
        }

        if (headerIndex === -1) {
            throw new Error('Could not find CSV header in articles.csv');
        }

        const linesToProcess = lines.slice(headerIndex + 1);
        let importedCount = 0;
        let skippedCount = 0;

        await connection.beginTransaction();
        await connection.query('SET FOREIGN_KEY_CHECKS = 0');
        await connection.query('TRUNCATE TABLE inventory');
        await connection.query('TRUNCATE TABLE articles');
        await connection.query('SET FOREIGN_KEY_CHECKS = 1');

        for (let i = 0; i < linesToProcess.length; i++) {
            let line = linesToProcess[i].trim();
            if (!line || line === '"","","","","","",""') continue;

            // Découpage CSV intelligent (gère les virgules dans les guillemets pour les prix)
            // Regex améliorée pour capturer les champs entre guillemets ou non
            const values = [];
            let current = '';
            let inQuotes = false;
            
            for (let char of line) {
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    values.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
            values.push(current.trim());

            if (values.length < 2) {
                console.log(`Ligne ${headerIndex + 2 + i} ignorée (format invalide) : ${line}`);
                skippedCount++;
                continue;
            }

            const name = values[0] ? values[0].trim() : 'Sans nom';
            const priceStr = values[1] ? values[1].replace(/,/g, '') : '0';
            const price = parseFloat(priceStr) || 0;
            const currentStock = values[2] ? parseInt(values[2]) || 0 : 0;
            const minStock = values[3] ? parseInt(values[3]) || 0 : 0;
            const barcode = values[4] ? values[4].trim() : null;
            const storeId = values[5] ? parseInt(values[5]) || 4 : 4; 
            const code = values[6] ? values[6].trim() : null;

            const [artResult] = await connection.query(
                'INSERT INTO articles (name, price, currentStock, minStock, barcode, storeId, code) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [name, price, currentStock, minStock, barcode, storeId, code]
            );
            
            const artId = artResult.insertId;

            await connection.query(
                'INSERT INTO inventory (id, storeId, articleId, quantity, minStock) VALUES (?, ?, ?, ?, ?)',
                [uuidv4(), storeId, artId, currentStock, minStock]
            );

            importedCount++;
        }

        await connection.commit();
        console.log('--- Résultat ---');
        console.log(`Articles importés : ${importedCount}`);
        console.log(`Lignes ignorées : ${skippedCount}`);
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Erreur lors de l\'importation :', error);
    } finally {
        if (connection) connection.release();
        process.exit(0);
    }
}

importCSV();

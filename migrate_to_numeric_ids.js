import pool from './app/lib/db.js';

async function migrate() {
    const connection = await pool.getConnection();
    try {
        console.log('Starting migration to numeric IDs for stores and articles...');
        
        // Disable foreign key checks
        await connection.query('SET FOREIGN_KEY_CHECKS = 0');

        // --- STORES MIGRATION ---
        console.log('Migrating STORES...');
        
        // 1. Add temporary numeric ID
        await connection.query('ALTER TABLE stores ADD COLUMN temp_id INT AUTO_INCREMENT UNIQUE');
        
        // 2. Update referencing tables
        const storeRefs = [
            ['articles', 'storeId'],
            ['sales', 'storeId'],
            ['mouvements', 'storeId'],
            ['inventory', 'storeId'],
            ['transfers', 'storeId'],
            ['users', 'storeId'],
            ['annual_reports', 'storeId'],
            ['logs', 'storeId'],
            ['payments', 'storeId'],
            ['external_orders', 'storeId']
        ];

        for (const [table, column] of storeRefs) {
            console.log(`Updating ${table}.${column}...`);
            // Check if table exists first (optional but safer)
            try {
                await connection.query(`
                    UPDATE ${table} t
                    JOIN stores s ON t.${column} = s.id
                    SET t.${column} = CAST(s.temp_id AS CHAR)
                `);
                // Change column type to INT
                await connection.query(`ALTER TABLE ${table} MODIFY COLUMN ${column} INT`);
            } catch (e) {
                console.warn(`Could not update ${table}.${column}: ${e.message}`);
            }
        }

        // 3. Finalize stores table
        await connection.query('ALTER TABLE stores DROP PRIMARY KEY');
        await connection.query('ALTER TABLE stores DROP COLUMN id');
        await connection.query('ALTER TABLE stores CHANGE COLUMN temp_id id INT AUTO_INCREMENT PRIMARY KEY FIRST');

        // --- ARTICLES MIGRATION ---
        console.log('Migrating ARTICLES...');

        // 1. Add temporary numeric ID
        await connection.query('ALTER TABLE articles ADD COLUMN temp_id INT AUTO_INCREMENT UNIQUE');

        // 2. Update referencing tables
        const articleRefs = [
            ['mouvements', 'articleId'],
            ['sale_items', 'articleId'],
            ['inventory', 'articleId'],
            ['external_order_items', 'articleId'],
            ['transfers', 'articleId']
        ];

        for (const [table, column] of articleRefs) {
            console.log(`Updating ${table}.${column}...`);
            try {
                await connection.query(`
                    UPDATE ${table} t
                    JOIN articles a ON t.${column} = a.id
                    SET t.${column} = CAST(a.temp_id AS CHAR)
                `);
                // Change column type to INT
                await connection.query(`ALTER TABLE ${table} MODIFY COLUMN ${column} INT`);
            } catch (e) {
                console.warn(`Could not update ${table}.${column}: ${e.message}`);
            }
        }

        // 3. Finalize articles table
        await connection.query('ALTER TABLE articles DROP PRIMARY KEY');
        await connection.query('ALTER TABLE articles DROP COLUMN id');
        await connection.query('ALTER TABLE articles CHANGE COLUMN temp_id id INT AUTO_INCREMENT PRIMARY KEY FIRST');

        // Re-enable foreign key checks
        await connection.query('SET FOREIGN_KEY_CHECKS = 1');

        console.log('Migration completed successfully!');

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        connection.release();
        process.exit(0);
    }
}

migrate();

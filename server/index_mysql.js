const express = require('express');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('./db_mysql');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const { performBackup } = require('./backup_service');

const JWT_SECRET = 'votre_secret_tres_securise_123';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3001;

// --- FONCTION DE LOGGING D'AUDIT ---
const logAction = async (userId, storeId, action, details = null) => {
  try {
    await db.query(
      'INSERT INTO logs (id, userId, storeId, action, details) VALUES (?, ?, ?, ?, ?)',
      [uuidv4(), userId, storeId, action, details ? JSON.stringify(details) : null]
    );
  } catch (err) {
    console.error('[AUDIT ERROR]', err);
  }
};

// --- AUTHENTICATION ---
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const [users] = await db.query('SELECT u.*, s.name as storeName FROM users u LEFT JOIN stores s ON u.storeId = s.id WHERE u.username = ?', [username]);
    const user = users[0];
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }
    const token = jwt.sign({ 
      id: user.id, 
      username: user.username, 
      role: user.role,
      storeId: user.storeId 
    }, JWT_SECRET, { expiresIn: '24h' });
    
    await logAction(user.id, user.storeId, 'Connexion', { ip: req.ip });

    res.json({ 
      token, 
      user: { id: user.id, username: user.username, role: user.role, storeId: user.storeId, storeName: user.storeName } 
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Accès non autorisé' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Session expirée' });
    req.user = user;
    next();
  });
};

const getStoreConstraint = (req) => {
  if (req.user.role === 'admin') {
    return req.query.storeId || null; 
  }
  return req.user.storeId;
};

app.use(authenticateToken);

// --- STATS (Segmented by Store) ---
app.get('/api/stats', async (req, res) => {
  try {
    const storeId = getStoreConstraint(req);
    const activeYear = await getActiveFiscalYear();
    
    // 1. Chiffre d'Affaires (Sales)
    let salesQuery = 'SELECT SUM(totalAmount) as totalRevenue FROM sales WHERE fiscalYearId = ? AND status != "annulée"';
    let salesParams = [activeYear.id];
    if (storeId) {
      salesQuery += ' AND storeId = ?';
      salesParams.push(storeId);
    }
    const [salesRow] = await db.query(salesQuery, salesParams);
    
    // 2. Valeur du Stock
    let stockQuery = `
      SELECT SUM(i.quantity * a.price) as totalValue 
      FROM inventory i 
      JOIN articles a ON i.articleId = a.id
    `;
    let stockParams = [];
    if (storeId) {
      stockQuery += ' WHERE i.storeId = ?';
      stockParams.push(storeId);
    }
    const [stockRow] = await db.query(stockQuery, stockParams);

    // 3. Ventes des 7 derniers jours
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      
      let dayQuery = 'SELECT SUM(totalAmount) as dayTotal FROM sales WHERE date LIKE ? AND status != "annulée"';
      let dayParams = [dateStr + '%'];
      if (storeId) {
        dayQuery += ' AND storeId = ?';
        dayParams.push(storeId);
      }
      const [dayRow] = await db.query(dayQuery, dayParams);
      
      last7Days.push({
        name: d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
        montant: dayRow[0].dayTotal || 0
      });
    }

    res.json({
      totalRevenue: salesRow[0].totalRevenue || 0,
      totalStockValue: stockRow[0].totalValue || 0,
      salesHistory: last7Days
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- LOGS API (Admin only) ---
app.get('/api/logs', async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Interdit' });
  try {
    const [rows] = await db.query(`
      SELECT l.*, u.username, s.name as storeName
      FROM logs l
      LEFT JOIN users u ON l.userId = u.id
      LEFT JOIN stores s ON l.storeId = s.id
      ORDER BY l.timestamp DESC LIMIT 500
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});



const getActiveFiscalYear = async () => {
  const [rows] = await db.query("SELECT * FROM fiscal_years WHERE status = 'active'");
  return rows[0];
};

// --- STORES ---
app.get('/api/stores', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM stores ORDER BY name ASC');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/stores', async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Interdit' });
  const { name, address } = req.body;
  const id = uuidv4();
  try {
    await db.query('INSERT INTO stores (id, name, address) VALUES (?, ?, ?)', [id, name, address || null]);
    await logAction(req.user.id, null, 'Création magasin', { name });
    res.status(201).json({ id, name, address });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/stores/:id', async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Interdit' });
  const { name, address } = req.body;
  try {
    await db.query('UPDATE stores SET name = ?, address = ? WHERE id = ?', [name, address, req.params.id]);
    await logAction(req.user.id, req.params.id, 'Modification magasin', { name });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/stores/:id', async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Interdit' });
  try {
    // Vérifier s'il y a des articles ou ventes liés (sécurité)
    const [articles] = await db.query('SELECT count(*) as count FROM articles WHERE storeId = ?', [req.params.id]);
    if (articles[0].count > 0) throw new Error('Impossible de supprimer : ce magasin contient des articles.');
    
    await db.query('DELETE FROM stores WHERE id = ?', [req.params.id]);
    await logAction(req.user.id, null, 'Suppression magasin', { id: req.params.id });
    res.json({ success: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// --- CATEGORIES ---
app.get('/api/categories', async (req, res) => {
  try {
    const storeId = getStoreConstraint(req);
    let query = 'SELECT * FROM categories';
    let params = [];
    if (storeId) {
      query += ' WHERE storeId = ? OR storeId IS NULL';
      params.push(storeId);
    }
    query += ' ORDER BY createdAt DESC';
    const [cats] = await db.query(query, params);
    res.json(cats);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/categories', async (req, res) => {
  const { name, description } = req.body;
  const catId = uuidv4();
  const storeId = req.user.role === 'admin' ? (req.body.storeId || req.user.storeId) : req.user.storeId;
  try {
    await db.query('INSERT INTO categories (id, name, description, createdAt, storeId) VALUES (?, ?, ?, ?, ?)', 
      [catId, name, description || null, new Date().toISOString(), storeId]);
    await logAction(req.user.id, storeId, 'Création catégorie', { name });
    const [rows] = await db.query('SELECT * FROM categories WHERE id = ?', [catId]);
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- ARTICLES & STOCK ---
app.get('/api/articles', async (req, res) => {
  try {
    const storeId = getStoreConstraint(req);
    let query = `
      SELECT a.id, a.name, a.categoryId, a.price, a.minStock, a.barcode, a.storeId, a.createdAt,
             s.name as createdInStoreName,
             COALESCE((
               SELECT SUM(quantity) FROM inventory 
               WHERE articleId = a.id 
               ${storeId ? 'AND storeId = ?' : ''}
             ), 0) as currentStock,
             (SELECT JSON_ARRAYAGG(JSON_OBJECT('storeName', s2.name, 'qty', i2.quantity))
              FROM inventory i2 
              JOIN stores s2 ON i2.storeId = s2.id 
              WHERE i2.articleId = a.id) as storeDetails
      FROM articles a
      LEFT JOIN stores s ON a.storeId = s.id
    `;
    
    let params = [];
    if (storeId) {
      // Pour storeId = ? dans le SUM()
      params.push(storeId);
      query += ' WHERE (a.storeId = ? OR a.id IN (SELECT articleId FROM inventory WHERE storeId = ?))';
      // Pour a.storeId = ? et storeId = ? dans le IN
      params.push(storeId, storeId);
    }
    
    query += ' ORDER BY a.createdAt DESC';
    const [articles] = await db.query(query, params);
    res.json(articles);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/articles', async (req, res) => {
  console.log("PAYLOAD REÇU:", req.body);
  const { name, categoryId, price, currentStock, minStock, barcode, storeId: bodyStoreId } = req.body;
  const artId = uuidv4();
  
  // Priorité : 1. Body (choix manuel), 2. User Store (si vendeur), 3. Fallback Admin
  let storeId = bodyStoreId || req.user.storeId;
  
  if (!storeId && req.user.role === 'admin') {
    const [stores] = await db.query('SELECT id FROM stores LIMIT 1');
    if (stores.length > 0) storeId = stores[0].id;
  }
  
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query('INSERT INTO articles (id, name, categoryId, price, currentStock, minStock, barcode, storeId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 
      [artId, name, categoryId, price || 0, currentStock || 0, minStock || 0, barcode || null, storeId]);
    await connection.query('INSERT INTO inventory (id, storeId, articleId, quantity, minStock) VALUES (?, ?, ?, ?, ?)',
      [uuidv4(), storeId, artId, currentStock || 0, minStock || 0]);
    await logAction(req.user.id, storeId, 'Création article', { name, initialStock: currentStock });
    await connection.commit();
    res.status(201).json({ id: artId, name });
  } catch (err) { 
    await connection.rollback(); 
    console.error('Erreur création article:', err);
    res.status(500).json({ error: err.message }); 
  } finally { 
    connection.release(); 
  }
});

app.delete('/api/articles/:id', async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Interdit' });
  const articleId = req.params.id;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    
    // 1. Supprimer le stock physique (inventory)
    await connection.query('DELETE FROM inventory WHERE articleId = ?', [articleId]);
    
    // 2. Supprimer les mouvements de stock
    await connection.query('DELETE FROM mouvements WHERE articleId = ?', [articleId]);
    
    // 3. Enfin supprimer l'article
    await connection.query('DELETE FROM articles WHERE id = ?', [articleId]);
    
    await logAction(req.user.id, null, 'Suppression article', { id: articleId });
    await connection.commit();
    res.json({ success: true });
  } catch (err) { 
    await connection.rollback(); 
    res.status(500).json({ error: err.message }); 
  } finally { 
    connection.release(); 
  }
});

// --- TRANSFERS ---
app.get('/api/transfers', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT t.*, a.name as articleName, 
             s1.name as fromStoreName, s2.name as toStoreName,
             u.username as operatorName
      FROM transfers t
      JOIN articles a ON t.articleId = a.id
      JOIN stores s1 ON t.fromStoreId = s1.id
      JOIN stores s2 ON t.toStoreId = s2.id
      JOIN users u ON t.userId = u.id
      ORDER BY t.date DESC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/transfers', async (req, res) => {
  const { articleId, fromStoreId, toStoreId, quantity, notes } = req.body;
  const id = uuidv4();
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Vérifier le stock source
    const [sourceInv] = await connection.query(
      'SELECT IFNULL(quantity, 0) as quantity FROM inventory WHERE storeId = ? AND articleId = ?', 
      [fromStoreId, articleId]
    );

    const availableQty = sourceInv.length > 0 ? sourceInv[0].quantity : 0;

    if (availableQty < quantity) {
      throw new Error(`Stock insuffisant dans le magasin source (Disponible: ${availableQty}, Demandé: ${quantity})`);
    }

    // 2. Déduire du magasin source
    await connection.query(
      'UPDATE inventory SET quantity = quantity - ? WHERE storeId = ? AND articleId = ?',
      [quantity, fromStoreId, articleId]
    );

    // 3. Ajouter au magasin destination
    const [destInv] = await connection.query(
      'SELECT id FROM inventory WHERE storeId = ? AND articleId = ?',
      [toStoreId, articleId]
    );

    if (destInv.length === 0) {
      await connection.query(
        'INSERT INTO inventory (id, storeId, articleId, quantity) VALUES (?, ?, ?, ?)',
        [uuidv4(), toStoreId, articleId, quantity]
      );
    } else {
      await connection.query(
        'UPDATE inventory SET quantity = quantity + ? WHERE storeId = ? AND articleId = ?',
        [quantity, toStoreId, articleId]
      );
    }

    // 4. Enregistrer le transfert
    await connection.query(
      'INSERT INTO transfers (id, articleId, fromStoreId, toStoreId, quantity, userId, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, articleId, fromStoreId, toStoreId, quantity, req.user.id, notes || null]
    );

    await logAction(req.user.id, fromStoreId, 'Transfert de stock', { articleId, toStoreId, quantity });
    await connection.commit();
    res.status(201).json({ id, success: true });
  } catch (err) {
    await connection.rollback();
    res.status(400).json({ error: err.message });
  } finally {
    connection.release();
  }
});


// --- MOUVEMENTS ---
app.get('/api/mouvements', async (req, res) => {
  try {
    const storeId = getStoreConstraint(req);
    let query = `
      SELECT m.*, a.name as articleName, s.name as storeName 
      FROM mouvements m
      JOIN articles a ON m.articleId = a.id
      LEFT JOIN stores s ON m.storeId = s.id
    `;
    let params = [];
    if (storeId) {
      query += ' WHERE m.storeId = ?';
      params.push(storeId);
    }
    query += ' ORDER BY m.date DESC';
    const [mouv] = await db.query(query, params);
    res.json(mouv);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/mouvements', async (req, res) => {
  const { articleId, type, quantity, notes, supplierId, storeId: bodyStoreId } = req.body;
  const movId = uuidv4();
  const activeYear = await getActiveFiscalYear();
  
  // Si admin, utilise le storeId envoyé ou son propre store, si vendeur utilise son propre storeId
  const storeId = req.user.role === 'admin' ? (bodyStoreId || req.user.storeId) : req.user.storeId;
  
  if (!storeId) return res.status(400).json({ error: "Magasin non spécifié" });

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    
    // Insertion du mouvement
    await connection.query(
      'INSERT INTO mouvements (id, articleId, type, quantity, date, notes, supplierId, fiscalYearId, storeId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', 
      [movId, articleId, type, quantity, new Date().toISOString(), notes || null, supplierId || null, activeYear?.id || null, storeId]
    );
    
    // Mise à jour de l'inventaire spécifique au magasin
    const [inv] = await connection.query('SELECT * FROM inventory WHERE storeId = ? AND articleId = ?', [storeId, articleId]);
    if (inv.length === 0) {
      await connection.query('INSERT INTO inventory (id, storeId, articleId, quantity) VALUES (?, ?, ?, ?)', 
        [uuidv4(), storeId, articleId, type === 'IN' ? quantity : -quantity]);
    } else {
      const op = type === 'IN' ? '+' : '-';
      await connection.query(`UPDATE inventory SET quantity = quantity ${op} ? WHERE storeId = ? AND articleId = ?`, [quantity, storeId, articleId]);
    }

    await logAction(req.user.id, storeId, `Mouvement Stock ${type}`, { articleId, quantity });
    await connection.commit();
    res.status(201).json({ id: movId, success: true });
  } catch (err) { 
    await connection.rollback(); 
    res.status(500).json({ error: err.message }); 
  } finally { 
    connection.release(); 
  }
});

// --- SALES ---
app.get('/api/sales', async (req, res) => {
  try {
    const storeId = getStoreConstraint(req);
    let query = `
      SELECT s.*, c.name as clientName, c.phone as clientPhone, u.username as sellerName 
      FROM sales s
      LEFT JOIN clients c ON s.clientId = c.id
      LEFT JOIN users u ON s.userId = u.id
    `;
    let params = [];
    if (storeId) {
      query += ' WHERE s.storeId = ?';
      params.push(storeId);
    }
    query += ' ORDER BY s.date DESC';
    const [sales] = await db.query(query, params);
    
    // Pour chaque vente, récupérer les items
    for (let sale of sales) {
      const [items] = await db.query(`
        SELECT si.*, a.name as articleName 
        FROM sale_items si
        JOIN articles a ON si.articleId = a.id
        WHERE si.saleId = ?
      `, [sale.id]);
      sale.items = items;
    }
    
    res.json(sales);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/sales', async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const { clientId, items, discount, amountPaid, paymentType, dueDate, notes, storeId: bodyStoreId } = req.body;
    const saleId = uuidv4();
    const storeId = req.user.role === 'admin' ? (bodyStoreId || req.user.storeId) : req.user.storeId;
    
    if (!storeId) throw new Error('Aucun magasin sélectionné pour cette vente.');
    
    let totalAmount = 0;
    
    for (const item of items) {
      const quantity = parseInt(item.quantity);
      const unitPrice = parseFloat(item.unitPrice);
      totalAmount += quantity * unitPrice;
      
      // Vérifier le stock
      const [inv] = await connection.query('SELECT quantity FROM inventory WHERE articleId = ? AND storeId = ?', [item.articleId, storeId]);
      if (inv.length === 0 || inv[0].quantity < quantity) {
        throw new Error(`Stock insuffisant pour l'article ID ${item.articleId}`);
      }
      
      // Déduire le stock
      await connection.query('UPDATE inventory SET quantity = quantity - ? WHERE articleId = ? AND storeId = ?', [quantity, item.articleId, storeId]);
      
      // Mouvement de stock (OUT)
      await connection.query('INSERT INTO mouvements (id, articleId, type, quantity, date, storeId) VALUES (?, ?, ?, ?, ?, ?)', 
        [uuidv4(), item.articleId, 'OUT', quantity, new Date().toISOString(), storeId]);
      
      // Ajouter le sale_item
      await connection.query('INSERT INTO sale_items (id, saleId, articleId, quantity, unitPrice) VALUES (?, ?, ?, ?, ?)', 
        [uuidv4(), saleId, item.articleId, quantity, unitPrice]);
    }
    
    const status = amountPaid >= (totalAmount - discount) ? 'payé' : (amountPaid > 0 ? 'partiel' : 'en_attente');
    
    await connection.query(`
      INSERT INTO sales (id, clientId, userId, totalAmount, discount, amountPaid, paymentType, status, dueDate, notes, date, storeId) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [saleId, clientId, req.user.id, totalAmount - (discount || 0), discount || 0, amountPaid || 0, paymentType || 'complet', status, dueDate || null, notes || null, new Date().toISOString(), storeId]);
    
    if (amountPaid > 0) {
      await connection.query('INSERT INTO payments (id, saleId, amount, date, storeId) VALUES (?, ?, ?, ?, ?)', 
        [uuidv4(), saleId, amountPaid, new Date().toISOString(), storeId]);
    }
    
    await logAction(req.user.id, storeId, 'Nouvelle vente', { saleId, totalAmount });
    await connection.commit();
    res.status(201).json({ id: saleId, success: true });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

app.post('/api/sales/:id/cancel', async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const saleId = req.params.id;
    
    const [sales] = await connection.query('SELECT * FROM sales WHERE id = ?', [saleId]);
    if (sales.length === 0 || sales[0].status === 'annulée') throw new Error('Vente invalide ou déjà annulée');
    const sale = sales[0];
    
    const [items] = await connection.query('SELECT * FROM sale_items WHERE saleId = ?', [saleId]);
    
    for (const item of items) {
      // Restituer le stock
      await connection.query('UPDATE inventory SET quantity = quantity + ? WHERE articleId = ? AND storeId = ?', [item.quantity, item.articleId, sale.storeId]);
      
      // Mouvement de stock (IN) pour annulation
      await connection.query('INSERT INTO mouvements (id, articleId, type, quantity, date, storeId, notes) VALUES (?, ?, ?, ?, ?, ?, ?)', 
        [uuidv4(), item.articleId, 'IN', item.quantity, new Date().toISOString(), sale.storeId, `Annulation Vente #${saleId.substring(0,8)}`]);
    }
    
    await connection.query('UPDATE sales SET status = "annulée" WHERE id = ?', [saleId]);
    await logAction(req.user.id, sale.storeId, 'Annulation vente', { saleId });
    
    await connection.commit();
    res.json({ success: true });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

app.post('/api/sales/:id/payments', async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const saleId = req.params.id;
    const { amount, notes } = req.body;
    
    const [sales] = await connection.query('SELECT * FROM sales WHERE id = ?', [saleId]);
    if (sales.length === 0) throw new Error('Vente introuvable');
    const sale = sales[0];
    
    await connection.query('INSERT INTO payments (id, saleId, amount, date, notes, storeId) VALUES (?, ?, ?, ?, ?, ?)', 
      [uuidv4(), saleId, amount, new Date().toISOString(), notes || null, sale.storeId]);
      
    const newAmountPaid = sale.amountPaid + parseFloat(amount);
    const status = newAmountPaid >= sale.totalAmount ? 'payé' : 'partiel';
    
    await connection.query('UPDATE sales SET amountPaid = ?, status = ? WHERE id = ?', [newAmountPaid, status, saleId]);
    await logAction(req.user.id, sale.storeId, 'Paiement ajouté', { saleId, amount });
    
    await connection.commit();
    res.json({ success: true });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

// --- CLIENTS ---
app.get('/api/clients', async (req, res) => {
  try {
    const storeId = getStoreConstraint(req);
    let query = 'SELECT * FROM clients';
    let params = [];
    if (storeId) {
      query += ' WHERE storeId = ? OR storeId IS NULL';
      params.push(storeId);
    }
    query += ' ORDER BY createdAt DESC';
    const [clients] = await db.query(query, params);
    res.json(clients);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/clients', async (req, res) => {
  const { name, email, phone, address } = req.body;
  const clientId = uuidv4();
  const storeId = req.user.role === 'admin' ? (req.body.storeId || req.user.storeId) : req.user.storeId;
  try {
    await db.query('INSERT INTO clients (id, name, email, phone, address, storeId) VALUES (?, ?, ?, ?, ?, ?)', 
      [clientId, name, email || null, phone || null, address || null, storeId]);
    await logAction(req.user.id, storeId, 'Création client', { name });
    const [rows] = await db.query('SELECT * FROM clients WHERE id = ?', [clientId]);
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/clients/:id', async (req, res) => {
  const { name, email, phone, address } = req.body;
  try {
    await db.query('UPDATE clients SET name = ?, email = ?, phone = ?, address = ? WHERE id = ?', 
      [name, email || null, phone || null, address || null, req.params.id]);
    await logAction(req.user.id, null, 'Modification client', { id: req.params.id, name });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/clients/:id', async (req, res) => {
  try {
    // Vérifier s'il y a des ventes liées (sécurité)
    const [sales] = await db.query('SELECT count(*) as count FROM sales WHERE clientId = ?', [req.params.id]);
    if (sales[0].count > 0) throw new Error('Impossible de supprimer : ce client a des ventes enregistrées.');
    
    await db.query('DELETE FROM clients WHERE id = ?', [req.params.id]);
    await logAction(req.user.id, null, 'Suppression client', { id: req.params.id });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- USERS ---
app.get('/api/users', async (req, res) => {
  try {
    const [users] = await db.query(`
      SELECT u.id, u.username, u.role, u.storeId, s.name as storeName, u.createdAt 
      FROM users u 
      LEFT JOIN stores s ON u.storeId = s.id
    `);
    res.json(users);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/users', async (req, res) => {
  const { username, password, role, storeId } = req.body;
  try {
    const hashedPassword = bcrypt.hashSync(password, 10);
    const id = uuidv4();
    await db.query('INSERT INTO users (id, username, password, role, storeId) VALUES (?, ?, ?, ?, ?)', 
      [id, username, hashedPassword, role, storeId]);
    await logAction(req.user.id, req.user.storeId, 'Création utilisateur', { username, role });
    res.status(201).json({ id, username, role, storeId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- FINANCES & PAYMENTS ---
app.get('/api/payments', async (req, res) => {
  try {
    const storeId = getStoreConstraint(req);
    const { date } = req.query;
    
    let query = `
      SELECT p.*, s.id as saleId, s.date as saleDate, s.status as saleStatus,
             c.name as clientName, s.id as saleRef
      FROM payments p
      JOIN sales s ON p.saleId = s.id
      LEFT JOIN clients c ON s.clientId = c.id
      WHERE 1=1
    `;
    let params = [];
    
    if (date) {
      query += ' AND p.date LIKE ?';
      params.push(date + '%');
    }
    
    if (storeId) {
      query += ' AND p.storeId = ?';
      params.push(storeId);
    }
    
    query += ' ORDER BY p.date DESC';
    const [payments] = await db.query(query, params);
    res.json(payments);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- REPORTS ---
app.get('/api/reports/monthly', async (req, res) => {
  try {
    const storeId = getStoreConstraint(req);
    
    // Aggregation par mois (sur les 12 derniers mois)
    let months = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthStr = d.toISOString().substring(0, 7); // YYYY-MM
      
      // Chiffre d'affaires du mois
      let revQuery = 'SELECT SUM(totalAmount) as total FROM sales WHERE date LIKE ? AND status != "annulée"';
      let revParams = [monthStr + '%'];
      if (storeId) {
        revQuery += ' AND storeId = ?';
        revParams.push(storeId);
      }
      const [revRow] = await db.query(revQuery, revParams);
      
      // Encaissements du mois
      let cashQuery = 'SELECT SUM(amount) as total FROM payments WHERE date LIKE ?';
      let cashParams = [monthStr + '%'];
      if (storeId) {
        cashQuery += ' AND storeId = ?';
        cashParams.push(storeId);
      }
      const [cashRow] = await db.query(cashQuery, cashParams);
      
      months.push({
        month: monthStr,
        revenue: revRow[0].total || 0,
        cash: cashRow[0].total || 0
      });
    }
    
    // Totaux globaux
    let totalRevQuery = 'SELECT SUM(totalAmount) as total FROM sales WHERE status != "annulée"';
    let totalRevParams = [];
    if (storeId) {
      totalRevQuery += ' AND storeId = ?';
      totalRevParams.push(storeId);
    }
    const [totalRevRow] = await db.query(totalRevQuery, totalRevParams);
    
    let totalPaidQuery = 'SELECT SUM(amountPaid) as total FROM sales WHERE status != "annulée"';
    let totalPaidParams = [];
    if (storeId) {
      totalPaidQuery += ' AND storeId = ?';
      totalPaidParams.push(storeId);
    }
    const [totalPaidRow] = await db.query(totalPaidQuery, totalPaidParams);
    
    const totalRevenue = totalRevRow[0].total || 0;
    const totalPaid = totalPaidRow[0].total || 0;
    const totalDebt = totalRevenue - totalPaid;

    res.json({
      months: months,
      totalRevenue: totalRevenue,
      totalDebt: totalDebt
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/reports/pdf', async (req, res) => {
  try {
    console.log('[PDF] Generating report for month:', req.query.month, 'Store:', req.query.storeId);
    const storeId = getStoreConstraint(req);
    const { month } = req.query; // YYYY-MM
    if (!month) return res.status(400).json({ error: "Mois non spécifié" });

    // 1. Fetch data for the specific month
    console.log('[PDF] Fetching revenue...');
    let revQuery = "SELECT SUM(totalAmount) as total FROM sales WHERE DATE_FORMAT(date, '%Y-%m') = ? AND status != 'annulée'";
    let revParams = [month];
    if (storeId) {
      revQuery += ' AND storeId = ?';
      revParams.push(storeId);
    }
    const [revRow] = await db.query(revQuery, revParams);
    const revenue = revRow[0].total || 0;

    console.log('[PDF] Fetching cash...');
    let cashQuery = "SELECT SUM(amount) as total FROM payments WHERE DATE_FORMAT(date, '%Y-%m') = ?";
    let cashParams = [month];
    if (storeId) {
      cashQuery += ' AND storeId = ?';
      cashParams.push(storeId);
    }
    const [cashRow] = await db.query(cashQuery, cashParams);
    const cash = cashRow[0].total || 0;

    console.log('[PDF] Data fetched: Rev=', revenue, 'Cash=', cash);

    // Get store name
    let storeName = 'Tous les Magasins';
    if (storeId) {
      const [s] = await db.query('SELECT name FROM stores WHERE id = ?', [storeId]);
      if (s.length > 0) storeName = s[0].name;
    }

    console.log('[PDF] Starting PDFDoc...');

    // 2. Generate PDF
    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Bilan_${month}.pdf`);
    doc.pipe(res);

    // Header
    doc.fontSize(20).fillColor('#1e293b').text('MINING AUTOLOG', { align: 'center' });
    doc.fontSize(14).fillColor('#64748b').text('RAPPORT FINANCIER MENSUEL', { align: 'center' });
    doc.moveDown();
    doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(50, 100).lineTo(550, 100).stroke();
    doc.moveDown();

    // Info
    doc.fontSize(10).fillColor('#000').text(`Période : ${month}`, 50, 120);
    doc.text(`Magasin : ${storeName}`, 50, 135);
    doc.text(`Généré le : ${new Date().toLocaleString('fr-FR')}`, 50, 150);

    // Summary Boxes
    const boxWidth = 160;
    const startY = 180;

    // CA Box
    doc.rect(50, startY, boxWidth, 60).fillAndStroke('#f1f5f9', '#cbd5e1');
    doc.fillColor('#1e293b').fontSize(8).text('CHIFFRE D\'AFFAIRES (CA)', 60, startY + 10);
    doc.fontSize(12).fillColor('#3b82f6').text(`${revenue.toLocaleString('fr-FR')} FCFA`, 60, startY + 25);

    // Cash Box
    doc.rect(50 + boxWidth + 10, startY, boxWidth, 60).fillAndStroke('#f1f5f9', '#cbd5e1');
    doc.fillColor('#1e293b').fontSize(8).text('ENCAISSEMENTS RÉELS', 60 + boxWidth + 10, startY + 10);
    doc.fontSize(12).fillColor('#10b981').text(`${cash.toLocaleString('fr-FR')} FCFA`, 60 + boxWidth + 10, startY + 25);

    // Debt Box
    doc.rect(50 + (boxWidth + 10) * 2, startY, boxWidth, 60).fillAndStroke('#f1f5f9', '#cbd5e1');
    doc.fillColor('#1e293b').fontSize(8).text('RESTE À RECOUVRER', 60 + (boxWidth + 10) * 2, startY + 10);
    doc.fontSize(12).fillColor('#ef4444').text(`${(revenue - cash).toLocaleString('fr-FR')} FCFA`, 60 + (boxWidth + 10) * 2, startY + 25);

    // Chart Section
    doc.moveDown(6);
    doc.fontSize(12).fillColor('#1e293b').text('Graphique de Performance', 50, startY + 80);
    
    const chartHeight = 150;
    const chartY = startY + 110;
    const maxChartVal = Math.max(revenue, cash, 1);
    
    // Y-Axis
    doc.strokeColor('#94a3b8').lineWidth(1).moveTo(100, chartY).lineTo(100, chartY + chartHeight).stroke();
    // X-Axis
    doc.moveTo(100, chartY + chartHeight).lineTo(400, chartY + chartHeight).stroke();

    // Bars
    const barWidth = 40;
    // Revenue Bar
    const revH = (revenue / maxChartVal) * chartHeight;
    doc.rect(150, chartY + chartHeight - revH, barWidth, revH).fill('#3b82f6');
    doc.fontSize(8).fillColor('#1e293b').text('CA', 150, chartY + chartHeight + 10, { width: barWidth, align: 'center' });

    // Cash Bar
    const cashH = (cash / maxChartVal) * chartHeight;
    doc.rect(250, chartY + chartHeight - cashH, barWidth, cashH).fill('#10b981');
    doc.text('RECU', 250, chartY + chartHeight + 10, { width: barWidth, align: 'center' });

    // Legend
    doc.rect(420, chartY + 20, 10, 10).fill('#3b82f6');
    doc.fillColor('#000').text('Chiffre d\'Affaires', 435, chartY + 22);
    doc.rect(420, chartY + 40, 10, 10).fill('#10b981');
    doc.text('Encaissements', 435, chartY + 42);

    // Footer
    doc.fontSize(8).fillColor('#94a3b8').text('Mining AutoLog ERP - Système de Gestion de Stock et Finances', 50, 750, { align: 'center' });

    doc.end();
  } catch (err) { 
    console.error(err);
    res.status(500).json({ error: err.message }); 
  }
});
// --- PRODUCTION SPA FALLBACK ---
// Si on est en production, on sert l'index.html pour toutes les routes non-API
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server Mining-AutoLog running on port ${PORT}`);
  if (process.env.NODE_ENV !== 'production') {
    performBackup(); // On évite le backup auto sur Render pour économiser des ressources si besoin
  }
});

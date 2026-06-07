import db from './db';
import { v4 as uuidv4 } from 'uuid';

export const logAction = async (userId, storeId, action, details = null) => {
  try {
    await db.query(
      'INSERT INTO logs (id, userId, storeId, action, details) VALUES (?, ?, ?, ?, ?)',
      [uuidv4(), userId, storeId, action, details ? JSON.stringify(details) : null]
    );
  } catch (err) {
    console.error('[AUDIT ERROR]', err);
  }
};

export const getStoreConstraint = (user, queryStoreId) => {
  if (
    user.role === 'admin' || 
    user.role === 'gestionnaire' || 
    user.role === 'gestionnaire2' || 
    user.role === 'gestionnaire 2'
  ) {
    if (!queryStoreId || queryStoreId === 'all') return null;
    return queryStoreId; 
  }
  return user.storeId;
};

export const checkActiveFiscalYear = async () => {
  try {
    const [rows] = await db.query("SELECT id FROM fiscal_years WHERE status = 'active' LIMIT 1");
    return rows.length > 0;
  } catch (err) {
    console.error('[FISCAL CHECK ERROR]', err);
    return false;
  }
};

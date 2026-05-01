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
  if (user.role === 'admin') {
    if (!queryStoreId || queryStoreId === 'all') return null;
    return queryStoreId; 
  }
  return user.storeId;
};

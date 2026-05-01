import { NextResponse } from 'next/server';
import db from '../../../lib/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { logAction } from '../../../lib/actions';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_change_me_in_production';

export async function POST(request) {
  try {
    const { username, password } = await request.json();
    
    const [users] = await db.query(
      'SELECT u.*, s.name as storeName FROM users u LEFT JOIN stores s ON u.storeId = s.id WHERE u.username = ?', 
      [username]
    );
    
    const user = users[0];
    
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return NextResponse.json({ error: 'Identifiants invalides' }, { status: 401 });
    }
    
    const token = jwt.sign({ 
      id: user.id, 
      username: user.username, 
      role: user.role,
      storeId: user.storeId 
    }, JWT_SECRET, { expiresIn: '24h' });
    
    await logAction(user.id, user.storeId, 'Connexion', { ip: 'API-NextJS' });

    return NextResponse.json({ 
      token, 
      user: { 
        id: user.id, 
        username: user.username, 
        role: user.role, 
        storeId: user.storeId, 
        storeName: user.storeName 
      } 
    });
  } catch (err) {
    console.error('Login error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

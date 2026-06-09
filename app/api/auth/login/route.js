import { NextResponse } from 'next/server';
import db from '../../../lib/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { logAction } from '../../../lib/actions';
import { FINAL_JWT_SECRET, checkRateLimit, recordLoginAttempt } from '../../../lib/auth';

export async function POST(request) {
  try {
    const { username, password } = await request.json();
    
    // 1. Vérification du Rate Limit
    const limit = checkRateLimit(username);
    if (limit.blocked) {
      return NextResponse.json({ error: limit.message }, { status: 429 });
    }

    const [users] = await db.query(
      'SELECT u.*, s.name as storeName FROM users u LEFT JOIN stores s ON u.storeId = s.id WHERE u.username = ?', 
      [username]
    );
    
    const user = users[0];
    
    if (!user || !bcrypt.compareSync(password, user.password)) {
      recordLoginAttempt(username, false);
      return NextResponse.json({ error: 'Identifiants invalides' }, { status: 401 });
    }
    
    recordLoginAttempt(username, true);
    
    const token = jwt.sign({ 
      id: user.id, 
      username: user.username, 
      role: user.role,
      storeId: user.storeId,
      permissions: typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions
    }, FINAL_JWT_SECRET, { expiresIn: '8h' });
    
    await logAction(user.id, user.storeId, 'Connexion', { ip: 'API-NextJS' });

    const response = NextResponse.json({ 
      user: { 
        id: user.id, 
        username: user.username, 
        role: user.role, 
        storeId: user.storeId, 
        storeName: user.storeName,
        permissions: typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions
      } 
    });

    // Détection dynamique du protocole sécurisé (HTTPS)
    const isSecure = request.nextUrl.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https';

    response.cookies.set('token', token, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      path: '/',
    });

    return response;
  } catch (err) {
    console.error('Login error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import db from '../../../lib/db';
import { FINAL_JWT_SECRET } from '../../../lib/auth';

/**
 * POST /api/auth/refresh
 * Renouvelle le token JWT si l'utilisateur est actif et que le token est encore valide.
 * Appelé automatiquement par le client avant expiration.
 */
export async function POST(request) {
  try {
    // Lire le token depuis le cookie HttpOnly
    let token = request.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, FINAL_JWT_SECRET);
    } catch (err) {
      return NextResponse.json({ error: 'Token invalide ou expiré' }, { status: 401 });
    }

    // Vérifier que l'utilisateur existe toujours en BD
    const [rows] = await db.query(
      'SELECT u.*, s.name as storeName FROM users u LEFT JOIN stores s ON u.storeId = s.id WHERE u.id = ?',
      [decoded.id]
    );
    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 401 });
    }
    const user = rows[0];

    // Émettre un nouveau token avec les données fraîches de la BD
    const newToken = jwt.sign({
      id: user.id,
      username: user.username,
      role: user.role,
      storeId: user.storeId,
      permissions: typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions
    }, FINAL_JWT_SECRET, { expiresIn: '8h' });

    const isSecure = request.nextUrl.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https';

    const userData = {
      id: user.id,
      username: user.username,
      role: user.role,
      storeId: user.storeId,
      storeName: user.storeName,
      permissions: typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions
    };

    const response = NextResponse.json({ user: userData });

    response.cookies.set('token', newToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      path: '/',
    });

    return response;
  } catch (err) {
    console.error('[REFRESH ERROR]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_change_me_in_production';

export function authenticateToken(request) {
  const authHeader = request.headers.get('authorization');
  let token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    // Essayer de récupérer le token depuis les query params (pour les téléchargements directs)
    token = request.nextUrl.searchParams.get('token');
  }
  
  if (!token) {
    return { error: 'Accès non autorisé', status: 401 };
  }
  
  try {
    const user = jwt.verify(token, JWT_SECRET);
    return { user };
  } catch (err) {
    console.error('[AUTH ERROR]', err.message);
    return { error: `Session expirée ou invalide (${err.message})`, status: 403 };
  }
}
export function isAdmin(user) {
  return user && user.role === 'admin';
}

export function isManager(user) {
  return user && (user.role === 'admin' || user.role === 'manager');
}

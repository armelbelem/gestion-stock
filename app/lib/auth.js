import jwt from 'jsonwebtoken';

const JWT_SECRET = 'votre_secret_tres_securise_123';

export function authenticateToken(request) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return { error: 'Accès non autorisé', status: 401 };
  }
  
  try {
    const user = jwt.verify(token, JWT_SECRET);
    return { user };
  } catch (err) {
    return { error: 'Session expirée', status: 403 };
  }
}

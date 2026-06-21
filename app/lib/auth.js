import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.error('CRITICAL SECURITY ERROR: JWT_SECRET is not defined in production environment!');
    // On pourrait même forcer l'arrêt ou jeter une erreur ici pour empêcher le démarrage non sécurisé
  } else {
    console.warn('WARNING: Using default JWT secret for development. Change this in production.');
  }
}

export const FINAL_JWT_SECRET = JWT_SECRET || 'dev_secret_key_change_me_in_production';

export function authenticateToken(request) {
  let token = request.cookies.get('token')?.value;
  
  if (!token) {
    const authHeader = request.headers.get('authorization');
    token = authHeader && authHeader.split(' ')[1];
  }
  
  if (!token) {
    // Essayer de récupérer le token depuis les query params (pour les téléchargements directs)
    token = request.nextUrl.searchParams.get('token');
  }
  
  if (!token) {
    return { error: 'Accès non autorisé', status: 401 };
  }
  
  try {
    const user = jwt.verify(token, FINAL_JWT_SECRET);
    if (user.role === 'observateur' && request.method && request.method !== 'GET') {
      return { error: 'Action interdite : Mode lecture seule.', status: 403 };
    }
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
  return user && (user.role === 'admin' || user.role === 'gestionnaire');
}

export function hasPermission(user, category, action) {
  if (!user) return false;
  
  // 1. L'administrateur a TOUS les droits
  if (user.role === 'admin') return true;
  
  // 2. Le gestionnaire a accès à tout SAUF à l'administration technique
  if (user.role === 'gestionnaire') {
    if (category === 'admin') return false; // Bloque Utilisateurs, Paramètres, Logs
    return true;
  }
  
  // 2b. Le gestionnaire 2 a accès uniquement à la Décharge Groupée (BL Libre)
  if (user.role === 'gestionnaire2' || user.role === 'gestionnaire 2') {
    if (category === 'procurement') {
      return action === 'view';
    }
    return false;
  }
  
  // 3. Le vendeur a un accès strictement limité aux opérations de vente
  if (user.role === 'vendeur' || user.role === 'vendeurs') {
    // Le vendeur peut VOIR les articles, mais ne peut rien modifier ni faire de mouvements
    if (category === 'stock') {
      return action === 'view'; // Autorise uniquement la lecture de la liste
    }
    
    // Le vendeur peut faire des ventes et voir les clients, mais ne voit pas les prix de vente dans le catalogue
    if (category === 'sales') {
      if (action === 'view_prices') return false;
      return true;
    }
    if (category === 'clients') return false;
    
    return false;
  }
  
  // 4. L'observateur a un accès strictement limité à la lecture
  if (user.role === 'observateur') {
    if (category === 'admin') return false;
    // Bloque formellement toute action de modification au niveau des composants qui utilisent ces flags
    if (action === 'create' || action === 'edit' || action === 'delete') return false;
    return true; // Autorise view, move (pour voir l'historique), etc.
  }
  
  // 5. Le comptable a un accès limité à la lecture des finances, rapports, commandes spéciales et achats
  if (user.role === 'comptable') {
    if (category === 'finances' && (action === 'view' || action === 'view_cost_price')) return true;
    if (category === 'procurement' && action === 'view') return true;
    if (category === 'stock' && action === 'view_cost_price') return true;
    return false;
  }
  
  return false;
}

// --- RATE LIMITING (Simple in-memory for login brute force protection) ---
const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const BAN_TIME = 15 * 60 * 1000; // 15 minutes

export function checkRateLimit(username) {
  const now = Date.now();
  const attempt = loginAttempts.get(username);

  if (attempt) {
    if (attempt.count >= MAX_ATTEMPTS) {
      if (now - attempt.lastAttempt < BAN_TIME) {
        const remainingMinutes = Math.ceil((BAN_TIME - (now - attempt.lastAttempt)) / 60000);
        return { 
          blocked: true, 
          message: `Trop de tentatives. Réessayez dans ${remainingMinutes} minute(s).` 
        };
      } else {
        // Le délai est passé, on réinitialise
        loginAttempts.delete(username);
      }
    }
  }
  return { blocked: false };
}

export function recordLoginAttempt(username, success) {
  if (success) {
    loginAttempts.delete(username);
    return;
  }

  const now = Date.now();
  const attempt = loginAttempts.get(username) || { count: 0 };
  
  loginAttempts.set(username, {
    count: attempt.count + 1,
    lastAttempt: now
  });
}

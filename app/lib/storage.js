const API_URL = '/api';

const notifyStatus = (status) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('api-status-change', { detail: status }));
  }
};

export const storage = {
  get: async (key) => {
    try {
      const selectedStore = localStorage.getItem('selectedStore');
      const url = new URL(`${window.location.origin}${API_URL}/${key}`);
      if (selectedStore && !url.searchParams.has('storeId')) {
        url.searchParams.append('storeId', selectedStore);
      }
      
      // Sécurité Anti-Cache : Ajout d'un timestamp unique
      url.searchParams.append('_t', Date.now());

      const response = await fetch(url.toString(), {
        cache: 'no-store' // Force le navigateur à ne pas utiliser de cache
      });
      if (!response.ok) {
        if (response.status === 401) {
          // Session expirée ou invalide → déconnexion
          if (typeof window !== 'undefined') {
            localStorage.removeItem('user');
            window.location.href = '/login';
          }
          return [];
        }
        const text = await response.text();
        let errorMessage = `Erreur HTTP: ${response.status}`;
        try {
          const errorData = JSON.parse(text);
          if (errorData.error) errorMessage = errorData.error;
        } catch (e) {
          if (text && text.length < 100) errorMessage = text;
        }
        throw new Error(errorMessage);
      }
      const text = await response.text();
      notifyStatus('healthy');
      return text ? JSON.parse(text) : [];
    } catch (error) {
      console.error(`Error fetching ${key}:`, error);
      notifyStatus('error');
      return [];
    }
  },
  
  create: async (key, value) => {
    try {
      const response = await fetch(`${API_URL}/${key}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(value),
      });
      if (!response.ok) {
        if (response.status === 401) {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('user');
            window.location.href = '/login';
          }
        }
        const text = await response.text();
        const errorData = text ? JSON.parse(text) : {};
        throw new Error(errorData.error || `Erreur serveur (${response.status})`);
      }
      const text = await response.text();
      notifyStatus('healthy');
      return text ? JSON.parse(text) : { success: true };
    } catch (error) {
      console.error(`Error creating ${key}:`, error);
      notifyStatus('error');
      throw error;
    }
  },

  update: async (key, id, value) => {
    try {
      const response = await fetch(`${API_URL}/${key}/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(value),
      });
      if (!response.ok) {
        if (response.status === 401) {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('user');
            window.location.href = '/login';
          }
        }
        const text = await response.text();
        const errorData = text ? JSON.parse(text) : {};
        throw new Error(errorData.error || `Erreur serveur (${response.status})`);
      }
      const text = await response.text();
      notifyStatus('healthy');
      return text ? JSON.parse(text) : { success: true };
    } catch (error) {
      console.error(`Error updating ${key}:`, error);
      notifyStatus('error');
      throw error;
    }
  },

  patch: async (path, value) => {
    try {
      const response = await fetch(`${API_URL}/${path}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(value),
      });
      if (!response.ok) {
        const text = await response.text();
        const errorData = text ? JSON.parse(text) : {};
        throw new Error(errorData.error || `Erreur serveur (${response.status})`);
      }
      notifyStatus('healthy');
      return true;
    } catch (error) {
      console.error(`Error patching ${path}:`, error);
      notifyStatus('error');
      throw error;
    }
  },

  remove: async (key, id) => {
    try {
      const selectedStore = localStorage.getItem('selectedStore');
      const url = new URL(`${window.location.origin}${API_URL}/${key}/${id}`);
      if (selectedStore && !url.searchParams.has('storeId')) {
        url.searchParams.append('storeId', selectedStore);
      }

      const response = await fetch(url.toString(), {
        method: 'DELETE'
      });
      if (!response.ok) {
        if (response.status === 401) {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('user');
            window.location.href = '/login';
          }
        }
        const text = await response.text();
        const errorData = text ? JSON.parse(text) : {};
        throw new Error(errorData.error || `Erreur serveur (${response.status})`);
      }
      notifyStatus('healthy');
      return true;
    } catch (error) {
      console.error(`Error deleting ${key}:`, error);
      notifyStatus('error');
      throw error;
    }
  },

  login: async (username, password) => {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Erreur de connexion');
    }
    
    const data = await response.json();
    // Stocker dans localStorage pour persister entre onglets
    localStorage.setItem('user', JSON.stringify(data.user));
    return data;
  },

  logout: async () => {
    try {
      await fetch(`${API_URL}/auth/logout`, { method: 'POST' });
    } catch (e) {
      console.error('Logout error:', e);
    }
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('welcomeShown');
    localStorage.removeItem('user');
    window.location.href = '/login';
  },

  getUser: () => {
    try {
      // Chercher d'abord dans localStorage (persistant), puis sessionStorage (compatibilité)
      const user = localStorage.getItem('user') || sessionStorage.getItem('user');
      return user ? JSON.parse(user) : null;
    } catch (e) {
      return null;
    }
  }
};

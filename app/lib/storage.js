const API_URL = '/api';

export const storage = {
  get: async (key) => {
    try {
      const token = sessionStorage.getItem('token');
      const selectedStore = localStorage.getItem('selectedStore');
      const url = new URL(`${window.location.origin}${API_URL}/${key}`);
      if (selectedStore && !url.searchParams.has('storeId')) {
        url.searchParams.append('storeId', selectedStore);
      }
      
      // Sécurité Anti-Cache : Ajout d'un timestamp unique
      url.searchParams.append('_t', Date.now());

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
        cache: 'no-store' // Force le navigateur à ne pas utiliser de cache
      });
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          sessionStorage.removeItem('token');
          window.location.href = '/login';
          return null; // Arrêter l'exécution ici
        }
        throw new Error(`Erreur HTTP: ${response.status}`);
      }
      const text = await response.text();
      return text ? JSON.parse(text) : [];
    } catch (error) {
      console.error(`Error fetching ${key}:`, error);
      return [];
    }
  },
  
  create: async (key, value) => {
    try {
      const token = sessionStorage.getItem('token');
      const response = await fetch(`${API_URL}/${key}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify(value),
      });
      if (!response.ok) {
        if (response.status === 401) {
          sessionStorage.removeItem('token');
          window.location.href = '/login';
        }
        const text = await response.text();
        const errorData = text ? JSON.parse(text) : {};
        throw new Error(errorData.error || `Erreur serveur (${response.status})`);
      }
      const text = await response.text();
      return text ? JSON.parse(text) : { success: true };
    } catch (error) {
      console.error(`Error creating ${key}:`, error);
      throw error;
    }
  },

  update: async (key, id, value) => {
    try {
      const token = sessionStorage.getItem('token');
      const response = await fetch(`${API_URL}/${key}/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify(value),
      });
      if (!response.ok) {
        if (response.status === 401) {
          sessionStorage.removeItem('token');
          window.location.href = '/login';
        }
        const text = await response.text();
        const errorData = text ? JSON.parse(text) : {};
        throw new Error(errorData.error || `Erreur serveur (${response.status})`);
      }
      const text = await response.text();
      return text ? JSON.parse(text) : { success: true };
    } catch (error) {
      console.error(`Error updating ${key}:`, error);
      throw error;
    }
  },

  patch: async (path, value) => {
    try {
      const token = sessionStorage.getItem('token');
      const response = await fetch(`${API_URL}/${path}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify(value),
      });
      if (!response.ok) {
        const text = await response.text();
        const errorData = text ? JSON.parse(text) : {};
        throw new Error(errorData.error || `Erreur serveur (${response.status})`);
      }
      return true;
    } catch (error) {
      console.error(`Error patching ${path}:`, error);
      throw error;
    }
  },

  remove: async (key, id) => {
    try {
      const token = sessionStorage.getItem('token');
      const selectedStore = localStorage.getItem('selectedStore');
      const url = new URL(`${window.location.origin}${API_URL}/${key}/${id}`);
      if (selectedStore && !url.searchParams.has('storeId')) {
        url.searchParams.append('storeId', selectedStore);
      }

      const response = await fetch(url.toString(), {
        method: 'DELETE',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        }
      });
      if (!response.ok) {
        if (response.status === 401) {
          sessionStorage.removeItem('token');
          window.location.href = '/login';
        }
        const text = await response.text();
        const errorData = text ? JSON.parse(text) : {};
        throw new Error(errorData.error || `Erreur serveur (${response.status})`);
      }
      return true;
    } catch (error) {
      console.error(`Error deleting ${key}:`, error);
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
    sessionStorage.setItem('token', data.token);
    sessionStorage.setItem('user', JSON.stringify(data.user));
    return data;
  },

  logout: () => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    window.location.href = '/login';
  },

  getUser: () => {
    try {
      const user = sessionStorage.getItem('user');
      return user ? JSON.parse(user) : null;
    } catch (e) {
      return null;
    }
  }
};

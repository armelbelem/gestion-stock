const API_URL = '/api';

export const storage = {
  // Using generic names to keep frontend code changes minimal
  get: async (key) => {
    try {
      const token = sessionStorage.getItem('token');
      const selectedStore = localStorage.getItem('selectedStore');
      const url = new URL(`${window.location.origin}${API_URL}/${key}`);
      if (selectedStore) {
        url.searchParams.append('storeId', selectedStore);
      }

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        }
      });
      if (!response.ok) {
        if (response.status === 401) {
          // Token expired or invalid
          sessionStorage.removeItem('token');
          window.location.href = '/login';
        }
        throw new Error('Network response was not ok');
      }
      return await response.json();
    } catch (error) {
      console.error(`Error fetching ${key}:`, error);
      // If it's a TypeError, it's likely a network error (server down)
      if (error instanceof TypeError) {
        console.error("Le serveur backend semble être hors ligne.");
      }
      return [];
    }
  },
  
  // Creates a new entity
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
        const errorData = await response.json();
        throw new Error(errorData.error || 'Network response was not ok');
      }
      return await response.json();
    } catch (error) {
      console.error(`Error creating ${key}:`, error);
      if (error instanceof TypeError) {
        throw new Error("Impossible de contacter le serveur backend. Vérifiez qu'il est bien démarré.");
      }
      throw error;
    }
  },

  // Updates an entity
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
        const errorData = await response.json();
        throw new Error(errorData.error || 'Network response was not ok');
      }
      return await response.json();
    } catch (error) {
      console.error(`Error updating ${key}:`, error);
      if (error instanceof TypeError) {
        throw new Error("Impossible de contacter le serveur backend. Vérifiez qu'il est bien démarré.");
      }
      throw error;
    }
  },

  // Deletes an entity
  remove: async (key, id) => {
    try {
      const token = sessionStorage.getItem('token');
      const response = await fetch(`${API_URL}/${key}/${id}`, {
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
        throw new Error('Network response was not ok');
      }
      return true;
    } catch (error) {
      console.error(`Error deleting ${key}:`, error);
      if (error instanceof TypeError) {
        throw new Error("Impossible de contacter le serveur backend. Vérifiez qu'il est bien démarré.");
      }
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
  }
};

// No longer needed for DB, but kept for App.jsx compatibility if needed
export const initializeData = async () => {
  console.log("Database handles initialization via SQLite.");
};

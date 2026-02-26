// Local authentication mock - stores auth state in localStorage
const STORAGE_KEY = 'garage_sale_user';
const USERS_KEY = 'garage_sale_users';

// Initialize with some mock users
const initializeMockUsers = () => {
  const existingUsers = localStorage.getItem(USERS_KEY);
  if (!existingUsers) {
    const mockUsers = [
      {
        id: '1',
        email: 'buyer@example.com',
        name: 'John Buyer',
        role: 'user',
        password: 'password123'
      },
      {
        id: '2',
        email: 'seller@example.com',
        name: 'Jane Seller',
        role: 'user',
        password: 'password123'
      },
      {
        id: '3',
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'admin',
        password: 'password123'
      }
    ];
    localStorage.setItem(USERS_KEY, JSON.stringify(mockUsers));
  }
};

initializeMockUsers();

export const localAuth = {
  // Check if user is authenticated
  isAuthenticated: () => {
    return !!localStorage.getItem(STORAGE_KEY);
  },

  // Get current user
  getCurrentUser: () => {
    const userStr = localStorage.getItem(STORAGE_KEY);
    return userStr ? JSON.parse(userStr) : null;
  },

  // Login user
  login: (email, password) => {
    const usersStr = localStorage.getItem(USERS_KEY);
    const users = JSON.parse(usersStr || '[]');
    
    const user = users.find(u => u.email === email && u.password === password);
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      return { success: true, user };
    }
    return { success: false, error: 'Invalid email or password' };
  },

  // Logout user
  logout: () => {
    localStorage.removeItem(STORAGE_KEY);
  },

  // Register new user
  register: (email, password, name) => {
    const usersStr = localStorage.getItem(USERS_KEY);
    const users = JSON.parse(usersStr || '[]');
    
    if (users.find(u => u.email === email)) {
      return { success: false, error: 'User already exists' };
    }
    
    const newUser = {
      id: Date.now().toString(),
      email,
      name,
      role: 'user',
      password
    };
    
    users.push(newUser);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
    
    return { success: true, user: newUser };
  },

  // Get user by email (for finding profile)
  getUserByEmail: (email) => {
    const usersStr = localStorage.getItem(USERS_KEY);
    const users = JSON.parse(usersStr || '[]');
    return users.find(u => u.email === email);
  }
};

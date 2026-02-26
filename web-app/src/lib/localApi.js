// Mock API client for local development
import { localAuth } from './localAuth';

// Mock database - store in localStorage
const SALES_KEY = 'garage_sale_listings';
const SAVED_SALES_KEY = 'saved_sales';
const DATA_VERSION_KEY = 'garage_sales_version';
const CURRENT_VERSION = '2.0'; // Bump this to force reset

// Initialize with mock data
const initializeMockData = () => {
  const storedVersion = localStorage.getItem(DATA_VERSION_KEY);
  const existingSales = localStorage.getItem(SALES_KEY);
  
  // Reset if version mismatch or data doesn't exist
  if (storedVersion !== CURRENT_VERSION || !existingSales) {
    localStorage.removeItem(SALES_KEY);
    localStorage.removeItem(DATA_VERSION_KEY);
    const mockSales = [
      {
        id: '1',
        title: 'Amazing Vintage Furniture Sale',
        description: 'Vintage chairs, tables, and cabinets from the 1970s. All in excellent condition.',
        seller_id: '2',
        seller_name: 'Jane Seller',
        address: '123 Oak Street',
        location: '123 Oak Street',
        suburb: 'Melbourne',
        postcode: '3000',
        state: 'VIC',
        latitude: -37.8136,
        longitude: 144.9631,
        start_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        end_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        sale_type: 'garage_sale',
        status: 'active',
        image_url: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&h=300&fit=crop',
        price_range: 'Mixed',
        photos: []
      },
      {
        id: '2',
        title: 'Moving Sale - Everything Must Go',
        description: 'Household items, kitchen equipment, books, and decorations. Priced to sell!',
        seller_id: '2',
        seller_name: 'Jane Seller',
        address: '456 Elm Avenue',
        location: '456 Elm Avenue',
        suburb: 'Fitzroy',
        postcode: '3065',
        state: 'VIC',
        latitude: -37.8021,
        longitude: 144.9842,
        start_date: new Date(Date.now()).toISOString(),
        end_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        sale_type: 'moving_sale',
        status: 'active',
        image_url: 'https://images.unsplash.com/photo-1552053831-71594a27c62d?w=400&h=300&fit=crop',
        price_range: '$1 - $50',
        photos: []
      },
      {
        id: '3',
        title: 'Estate Sale - Antiques & Collectibles',
        description: 'Beautiful antique items, collectible figurines, and rare books.',
        seller_id: '2',
        seller_name: 'Jane Seller',
        address: '789 Queen Street',
        location: '789 Queen Street',
        suburb: 'South Yarra',
        postcode: '3141',
        state: 'VIC',
        latitude: -37.8401,
        longitude: 144.9863,
        start_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        sale_type: 'estate_sale',
        status: 'active',
        image_url: 'https://images.unsplash.com/photo-1578926078328-123456789012?w=400&h=300&fit=crop',
        price_range: '$50 - $500',
        photos: []
      },
      {
        id: '4',
        title: 'Books, Records & Electronics',
        description: 'Large collection of books, vinyl records, and vintage electronics.',
        seller_id: '2',
        seller_name: 'Jane Seller',
        address: '321 High Street',
        location: '321 High Street',
        suburb: 'Prahran',
        postcode: '3181',
        state: 'VIC',
        latitude: -37.8585,
        longitude: 144.9965,
        start_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        end_date: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
        sale_type: 'yard_sale',
        status: 'active',
        image_url: 'https://images.unsplash.com/photo-1507842217343-583f20270319?w=400&h=300&fit=crop',
        price_range: '$0.50 - $100',
        photos: []
      },
      {
        id: '5',
        title: 'Southbank Garage Sale - Furniture & Home Decor',
        description: 'Great selection of furniture, home decor, kitchenware, and garden items. Perfect bargains!',
        seller_id: '2',
        seller_name: 'Jane Seller',
        address: '45 Power Street',
        location: '45 Power Street',
        suburb: 'Southbank',
        postcode: '3226',
        state: 'VIC',
        latitude: -37.8256,
        longitude: 144.9495,
        start_date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
        end_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        sale_type: 'garage_sale',
        status: 'active',
        image_url: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&h=300&fit=crop',
        price_range: '$1 - $200',
        photos: []
      },
      {
        id: 'test1',
        title: 'Test 1',
        description: 'Test listing 1',
        seller_id: '1',
        seller_name: 'Test User',
        address: '100 Test St',
        location: '100 Test St',
        suburb: 'Melbourne',
        postcode: '3000',
        state: 'VIC',
        latitude: -37.8136,
        longitude: 144.9631,
        start_date: new Date(Date.now()).toISOString(),
        end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        sale_type: 'garage_sale',
        status: 'active',
        image_url: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&h=300&fit=crop',
        price_range: 'Mixed',
        photos: []
      },
      {
        id: 'test2',
        title: 'Test 2',
        description: 'Test listing 2',
        seller_id: '1',
        seller_name: 'Test User',
        address: '101 Test St',
        location: '101 Test St',
        suburb: 'Fitzroy',
        postcode: '3065',
        state: 'VIC',
        latitude: -37.8021,
        longitude: 144.9842,
        start_date: new Date(Date.now()).toISOString(),
        end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        sale_type: 'garage_sale',
        status: 'active',
        image_url: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&h=300&fit=crop',
        price_range: 'Mixed',
        photos: []
      },
      {
        id: 'test3',
        title: 'Test 3',
        description: 'Test listing 3',
        seller_id: '1',
        seller_name: 'Test User',
        address: '102 Test St',
        location: '102 Test St',
        suburb: 'South Yarra',
        postcode: '3141',
        state: 'VIC',
        latitude: -37.8401,
        longitude: 144.9863,
        start_date: new Date(Date.now()).toISOString(),
        end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        sale_type: 'garage_sale',
        status: 'active',
        image_url: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&h=300&fit=crop',
        price_range: 'Mixed',
        photos: []
      },
      {
        id: 'test4',
        title: 'Test 4',
        description: 'Test listing 4',
        seller_id: '1',
        seller_name: 'Test User',
        address: '103 Test St',
        location: '103 Test St',
        suburb: 'Prahran',
        postcode: '3181',
        state: 'VIC',
        latitude: -37.8585,
        longitude: 144.9965,
        start_date: new Date(Date.now()).toISOString(),
        end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        sale_type: 'garage_sale',
        status: 'active',
        image_url: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&h=300&fit=crop',
        price_range: 'Mixed',
        photos: []
      },
      {
        id: 'test5',
        title: 'Test 5',
        description: 'Test listing 5',
        seller_id: '1',
        seller_name: 'Test User',
        address: '104 Test St',
        location: '104 Test St',
        suburb: 'Southbank',
        postcode: '3226',
        state: 'VIC',
        latitude: -37.8256,
        longitude: 144.9495,
        start_date: new Date(Date.now()).toISOString(),
        end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        sale_type: 'garage_sale',
        status: 'active',
        image_url: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&h=300&fit=crop',
        price_range: 'Mixed',
        photos: []
      },
      {
        id: 'test6',
        title: 'Test 6',
        description: 'Test listing 6',
        seller_id: '1',
        seller_name: 'Test User',
        address: '105 Test St',
        location: '105 Test St',
        suburb: 'Melbourne',
        postcode: '3000',
        state: 'VIC',
        latitude: -37.8136,
        longitude: 144.9631,
        start_date: new Date(Date.now()).toISOString(),
        end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        sale_type: 'moving_sale',
        status: 'active',
        image_url: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&h=300&fit=crop',
        price_range: 'Mixed',
        photos: []
      },
      {
        id: 'test7',
        title: 'Test 7',
        description: 'Test listing 7',
        seller_id: '1',
        seller_name: 'Test User',
        address: '106 Test St',
        location: '106 Test St',
        suburb: 'Fitzroy',
        postcode: '3065',
        state: 'VIC',
        latitude: -37.8021,
        longitude: 144.9842,
        start_date: new Date(Date.now()).toISOString(),
        end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        sale_type: 'estate_sale',
        status: 'active',
        image_url: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&h=300&fit=crop',
        price_range: 'Mixed',
        photos: []
      },
      {
        id: 'test8',
        title: 'Test 8',
        description: 'Test listing 8',
        seller_id: '1',
        seller_name: 'Test User',
        address: '107 Test St',
        location: '107 Test St',
        suburb: 'South Yarra',
        postcode: '3141',
        state: 'VIC',
        latitude: -37.8401,
        longitude: 144.9863,
        start_date: new Date(Date.now()).toISOString(),
        end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        sale_type: 'yard_sale',
        status: 'active',
        image_url: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&h=300&fit=crop',
        price_range: 'Mixed',
        photos: []
      },
      {
        id: 'test9',
        title: 'Test 9',
        description: 'Test listing 9',
        seller_id: '1',
        seller_name: 'Test User',
        address: '108 Test St',
        location: '108 Test St',
        suburb: 'Prahran',
        postcode: '3181',
        state: 'VIC',
        latitude: -37.8585,
        longitude: 144.9965,
        start_date: new Date(Date.now()).toISOString(),
        end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        sale_type: 'moving_sale',
        status: 'active',
        image_url: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&h=300&fit=crop',
        price_range: 'Mixed',
        photos: []
      }
    ];
    localStorage.setItem(SALES_KEY, JSON.stringify(mockSales));
    localStorage.setItem(DATA_VERSION_KEY, CURRENT_VERSION);
  }
};

initializeMockData();

export const localApi = {
  // Garage Sales
  garage_sales: {
    getAll: () => {
      const sales = localStorage.getItem(SALES_KEY);
      return Promise.resolve(JSON.parse(sales || '[]'));
    },

    getActive: () => {
      const sales = localStorage.getItem(SALES_KEY);
      const allSales = JSON.parse(sales || '[]');
      return Promise.resolve(allSales.filter(s => s.status === 'active'));
    },

    getById: (id) => {
      const sales = localStorage.getItem(SALES_KEY);
      const allSales = JSON.parse(sales || '[]');
      const sale = allSales.find(s => s.id === id);
      return Promise.resolve(sale);
    },

    getByUserId: (userId) => {
      const sales = localStorage.getItem(SALES_KEY);
      const allSales = JSON.parse(sales || '[]');
      return Promise.resolve(allSales.filter(s => s.seller_id === userId));
    },

    create: (saleData) => {
      const user = localAuth.getCurrentUser();
      if (!user) return Promise.reject(new Error('Not authenticated'));

      const sales = localStorage.getItem(SALES_KEY);
      const allSales = JSON.parse(sales || '[]');
      
      const newSale = {
        id: Date.now().toString(),
        ...saleData,
        seller_id: user.id,
        seller_name: user.name,
        created_by: saleData.created_by || user.email,
        // Keep the status from saleData if provided, otherwise default to 'active'
        status: saleData.status || 'active',
        created_at: new Date().toISOString()
      };
      
      allSales.push(newSale);
      localStorage.setItem(SALES_KEY, JSON.stringify(allSales));
      
      return Promise.resolve(newSale);
    },

    update: (id, saleData) => {
      const sales = localStorage.getItem(SALES_KEY);
      const allSales = JSON.parse(sales || '[]');
      
      // Find the sale by ID only (allow updates regardless of seller_id for admin operations)
      const index = allSales.findIndex(s => s.id === id);
      if (index === -1) return Promise.reject(new Error('Sale not found'));
      
      allSales[index] = { ...allSales[index], ...saleData };
      localStorage.setItem(SALES_KEY, JSON.stringify(allSales));
      
      return Promise.resolve(allSales[index]);
    },

    delete: (id) => {
      const sales = localStorage.getItem(SALES_KEY);
      const allSales = JSON.parse(sales || '[]');
      
      // Find the sale by ID only (allow deletes regardless of seller_id for admin operations)
      const index = allSales.findIndex(s => s.id === id);
      if (index === -1) return Promise.reject(new Error('Sale not found'));
      
      allSales.splice(index, 1);
      localStorage.setItem(SALES_KEY, JSON.stringify(allSales));
      
      return Promise.resolve({ success: true });
    }
  },

  // Saved Sales (Favorites)
  saved_sales: {
    getSavedByUser: (userId) => {
      const saved = localStorage.getItem(`${SAVED_SALES_KEY}_${userId}`);
      return Promise.resolve(JSON.parse(saved || '[]'));
    },

    save: (saleId) => {
      const user = localAuth.getCurrentUser();
      if (!user) return Promise.reject(new Error('Not authenticated'));

      const saved = localStorage.getItem(`${SAVED_SALES_KEY}_${user.id}`);
      const savedSales = JSON.parse(saved || '[]');
      
      if (!savedSales.includes(saleId)) {
        savedSales.push(saleId);
        localStorage.setItem(`${SAVED_SALES_KEY}_${user.id}`, JSON.stringify(savedSales));
      }
      
      return Promise.resolve({ success: true });
    },

    unsave: (saleId) => {
      const user = localAuth.getCurrentUser();
      if (!user) return Promise.reject(new Error('Not authenticated'));

      const saved = localStorage.getItem(`${SAVED_SALES_KEY}_${user.id}`);
      const savedSales = JSON.parse(saved || '[]');
      
      const index = savedSales.indexOf(saleId);
      if (index > -1) {
        savedSales.splice(index, 1);
        localStorage.setItem(`${SAVED_SALES_KEY}_${user.id}`, JSON.stringify(savedSales));
      }
      
      return Promise.resolve({ success: true });
    }
  },

  // Users/Profiles
  users: {
    getById: (userId) => {
      const usersStr = localStorage.getItem('garage_sale_users');
      const users = JSON.parse(usersStr || '[]');
      const user = users.find(u => u.id === userId);
      if (user) {
        const { password, ...userWithoutPassword } = user;
        return Promise.resolve(userWithoutPassword);
      }
      return Promise.reject(new Error('User not found'));
    },

    getAll: () => {
      const usersStr = localStorage.getItem('garage_sale_users');
      const users = JSON.parse(usersStr || '[]');
      return Promise.resolve(users.map(u => {
        const { password, ...userWithoutPassword } = u;
        return userWithoutPassword;
      }));
    },

    updateProfile: (userId, updates) => {
      const usersStr = localStorage.getItem('garage_sale_users');
      const users = JSON.parse(usersStr || '[]');
      
      const index = users.findIndex(u => u.id === userId);
      if (index === -1) return Promise.reject(new Error('User not found'));
      
      users[index] = { ...users[index], ...updates };
      localStorage.setItem('garage_sale_users', JSON.stringify(users));
      
      const { password, ...userWithoutPassword } = users[index];
      return Promise.resolve(userWithoutPassword);
    }
  },

  // Payments
  payments: {
    create: (paymentData) => {
      console.log('localApi.payments.create called with:', paymentData);
      const paymentsStr = localStorage.getItem('garage_sale_payments');
      const payments = JSON.parse(paymentsStr || '[]');
      
      const newPayment = {
        id: Date.now().toString(),
        ...paymentData,
        created_date: new Date().toISOString(),
        status: 'completed'
      };
      
      payments.push(newPayment);
      localStorage.setItem('garage_sale_payments', JSON.stringify(payments));
      
      console.log('localApi.payments.create - Payment saved:', newPayment);
      console.log('localApi.payments.create - Total payments in storage:', payments.length);
      
      return Promise.resolve(newPayment);
    },

    getAll: () => {
      const paymentsStr = localStorage.getItem('garage_sale_payments');
      const payments = JSON.parse(paymentsStr || '[]');
      console.log('localApi.payments.getAll - Retrieved payments:', payments);
      return Promise.resolve(payments);
    }
  }
};

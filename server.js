const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Initialize express app
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize database
const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

// JWT Secret
const JWT_SECRET = 'expense-tracker-secret-key-change-in-production';

// Initialize database tables
const initializeDatabase = () => {
  db.serialize(() => {
    // Create users table
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create expenses table
    db.run(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        category TEXT NOT NULL,
        description TEXT,
        date DATE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Create products table
    db.run(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        cost_price DECIMAL(10, 2) NOT NULL,
        selling_price DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create production table
    db.run(`
      CREATE TABLE IF NOT EXISTS production (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        production_date DATE NOT NULL,
        user_id INTEGER NOT NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Create sales table
    db.run(`
      CREATE TABLE IF NOT EXISTS sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        total_amount DECIMAL(10, 2) NOT NULL,
        client_name TEXT NOT NULL,
        sale_date DATE NOT NULL,
        user_id INTEGER NOT NULL,
        notes TEXT,
        status TEXT DEFAULT 'delivered' CHECK(status IN ('delivered', 'cancelled')),
        payment_status TEXT DEFAULT 'not paid' CHECK(payment_status IN ('paid', 'not paid')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Check if users exist, if not create default admin users
    db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
      if (err) {
        console.error("Error checking users:", err);
        return;
      }

      if (row.count === 0) {
        // Create default admin users
        const saltRounds = 10;
        const password = "admin123";

        bcrypt.hash(password, saltRounds, (err, hash) => {
          if (err) {
            console.error("Error hashing password:", err);
            return;
          }

          db.run("INSERT INTO users (username, password) VALUES (?, ?)", ["ILIASS", hash]);
          db.run("INSERT INTO users (username, password) VALUES (?, ?)", ["YASSIR", hash]);
          
          console.log("Default admin users created");
        });
      }
    });

    // Check if products exist, if not create sample products
    db.get("SELECT COUNT(*) as count FROM products", (err, row) => {
      if (err) {
        console.error("Error checking products:", err);
        return;
      }

      if (row.count === 0) {
        // Create sample products
        db.run("INSERT INTO products (name, type, cost_price, selling_price) VALUES (?, ?, ?, ?)", 
          ["Product A", "Type 1", 10.50, 25.00]);
        db.run("INSERT INTO products (name, type, cost_price, selling_price) VALUES (?, ?, ?, ?)", 
          ["Product B", "Type 2", 15.75, 35.50]);
          
        console.log("Sample products created");
      }
    });
  });
};

// Initialize database
initializeDatabase();

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    req.user = user;
    next();
  });
};

// Login route
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    bcrypt.compare(password, user.password, (err, result) => {
      if (err) {
        console.error("Password comparison error:", err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      if (!result) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      // Generate JWT token
      const token = jwt.sign(
        { id: user.id, username: user.username },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        success: true,
        user: { id: user.id, username: user.username },
        token
      });
    });
  });
});

// Get current user
app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// EXPENSES ROUTES

// Get all expenses
app.get('/api/expenses', authenticateToken, (req, res) => {
  const { category, startDate, endDate } = req.query;
  
  // Changed to show all expenses for all users
  let query = 'SELECT expenses.*, users.username FROM expenses JOIN users ON expenses.user_id = users.id WHERE 1=1';
  const params = [];
  
  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }
  
  if (startDate) {
    query += ' AND date >= ?';
    params.push(startDate);
  }
  
  if (endDate) {
    query += ' AND date <= ?';
    params.push(endDate);
  }
  
  query += ' ORDER BY date DESC';
  
  db.all(query, params, (err, expenses) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    res.json(expenses);
  });
});

// Create expense
app.post('/api/expenses', authenticateToken, (req, res) => {
  const { amount, category, description, date } = req.body;
  
  if (!amount || !category || !date) {
    return res.status(400).json({ error: 'Amount, category, and date are required' });
  }
  
  db.run(
    'INSERT INTO expenses (user_id, amount, category, description, date) VALUES (?, ?, ?, ?, ?)',
    [req.user.id, amount, category, description || '', date],
    function(err) {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      res.status(201).json({ success: true, id: this.lastID });
    }
  );
});

// Get expense by ID
app.get('/api/expenses/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  
  db.get(
    'SELECT * FROM expenses WHERE id = ? AND user_id = ?',
    [id, req.user.id],
    (err, expense) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      if (!expense) {
        return res.status(404).json({ error: 'Expense not found' });
      }
      
      res.json(expense);
    }
  );
});

// Update expense
app.put('/api/expenses/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { amount, category, description, date } = req.body;
  
  if (!amount || !category || !date) {
    return res.status(400).json({ error: 'Amount, category, and date are required' });
  }
  
  db.run(
    'UPDATE expenses SET amount = ?, category = ?, description = ?, date = ? WHERE id = ? AND user_id = ?',
    [amount, category, description || '', date, id, req.user.id],
    function(err) {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Expense not found or you do not have permission to update it' });
      }
      
      res.json({ success: true });
    }
  );
});

// Delete expense
app.delete('/api/expenses/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  
  db.run(
    'DELETE FROM expenses WHERE id = ? AND user_id = ?',
    [id, req.user.id],
    function(err) {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Expense not found or you do not have permission to delete it' });
      }
      
      res.json({ success: true });
    }
  );
});

// PRODUCTS ROUTES

// Get all products
app.get('/api/products', authenticateToken, (req, res) => {
  const { type } = req.query;
  
  let query = 'SELECT * FROM products';
  const params = [];
  
  if (type) {
    query += ' WHERE type = ?';
    params.push(type);
  }
  
  query += ' ORDER BY name ASC';
  
  db.all(query, params, (err, products) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    res.json(products);
  });
});

// Create product
app.post('/api/products', authenticateToken, (req, res) => {
  const { name, type, cost_price, selling_price } = req.body;
  
  if (!name || !type || !cost_price || !selling_price) {
    return res.status(400).json({ error: 'Name, type, cost price, and selling price are required' });
  }
  
  db.run(
    'INSERT INTO products (name, type, cost_price, selling_price) VALUES (?, ?, ?, ?)',
    [name, type, cost_price, selling_price],
    function(err) {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      res.status(201).json({ success: true, id: this.lastID });
    }
  );
});

// Get product by ID
app.get('/api/products/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  
  db.get(
    'SELECT * FROM products WHERE id = ?',
    [id],
    (err, product) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }
      
      res.json(product);
    }
  );
});

// Update product
app.put('/api/products/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { name, type, cost_price, selling_price } = req.body;
  
  if (!name || !type || !cost_price || !selling_price) {
    return res.status(400).json({ error: 'Name, type, cost price, and selling price are required' });
  }
  
  db.run(
    'UPDATE products SET name = ?, type = ?, cost_price = ?, selling_price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [name, type, cost_price, selling_price, id],
    function(err) {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Product not found' });
      }
      
      res.json({ success: true });
    }
  );
});

// Delete product
app.delete('/api/products/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  
  // Check if product is referenced in production or sales
  db.get(
    'SELECT COUNT(*) as count FROM production WHERE product_id = ? UNION ALL SELECT COUNT(*) as count FROM sales WHERE product_id = ?',
    [id, id],
    (err, rows) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      if (rows && rows.count > 0) {
        return res.status(400).json({ error: 'Cannot delete product because it is referenced in production or sales records' });
      }
      
      db.run(
        'DELETE FROM products WHERE id = ?',
        [id],
        function(err) {
          if (err) {
            console.error("Database error:", err);
            return res.status(500).json({ error: 'Internal server error' });
          }
          
          if (this.changes === 0) {
            return res.status(404).json({ error: 'Product not found' });
          }
          
          res.json({ success: true });
        }
      );
    }
  );
});

// PRODUCTION ROUTES

// Get all production records
app.get('/api/production', authenticateToken, (req, res) => {
  const { product_id, startDate, endDate } = req.query;
  
  let query = `
    SELECT p.*, pr.name as product_name, pr.type as product_type, u.username
    FROM production p
    JOIN products pr ON p.product_id = pr.id
    JOIN users u ON p.user_id = u.id
    WHERE 1=1
  `;
  const params = [];
  
  if (product_id) {
    query += ' AND p.product_id = ?';
    params.push(product_id);
  }
  
  if (startDate) {
    query += ' AND p.production_date >= ?';
    params.push(startDate);
  }
  
  if (endDate) {
    query += ' AND p.production_date <= ?';
    params.push(endDate);
  }
  
  query += ' ORDER BY p.production_date DESC';
  
  db.all(query, params, (err, production) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    res.json(production);
  });
});

// Create production record
app.post('/api/production', authenticateToken, (req, res) => {
  const { product_id, quantity, production_date, notes } = req.body;
  
  if (!product_id || !quantity || !production_date) {
    return res.status(400).json({ error: 'Product, quantity, and production date are required' });
  }
  
  // Verify product exists
  db.get('SELECT id FROM products WHERE id = ?', [product_id], (err, product) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    db.run(
      'INSERT INTO production (product_id, quantity, production_date, user_id, notes) VALUES (?, ?, ?, ?, ?)',
      [product_id, quantity, production_date, req.user.id, notes || ''],
      function(err) {
        if (err) {
          console.error("Database error:", err);
          return res.status(500).json({ error: 'Internal server error' });
        }
        
        res.status(201).json({ success: true, id: this.lastID });
      }
    );
  });
});

// Get production record by ID
app.get('/api/production/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  
  db.get(
    `SELECT p.*, pr.name as product_name, pr.type as product_type
     FROM production p
     JOIN products pr ON p.product_id = pr.id
     WHERE p.id = ?`,
    [id],
    (err, production) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      if (!production) {
        return res.status(404).json({ error: 'Production record not found' });
      }
      
      res.json(production);
    }
  );
});

// Update production record
app.put('/api/production/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { product_id, quantity, production_date, notes } = req.body;
  
  if (!product_id || !quantity || !production_date) {
    return res.status(400).json({ error: 'Product, quantity, and production date are required' });
  }
  
  // Verify product exists
  db.get('SELECT id FROM products WHERE id = ?', [product_id], (err, product) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    db.run(
      'UPDATE production SET product_id = ?, quantity = ?, production_date = ?, notes = ? WHERE id = ?',
      [product_id, quantity, production_date, notes || '', id],
      function(err) {
        if (err) {
          console.error("Database error:", err);
          return res.status(500).json({ error: 'Internal server error' });
        }
        
        if (this.changes === 0) {
          return res.status(404).json({ error: 'Production record not found' });
        }
        
        res.json({ success: true });
      }
    );
  });
});

// Delete production record
app.delete('/api/production/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  
  db.run(
    'DELETE FROM production WHERE id = ?',
    [id],
    function(err) {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Production record not found' });
      }
      
      res.json({ success: true });
    }
  );
});

// SALES ROUTES

// Get all sales records
app.get('/api/sales', authenticateToken, (req, res) => {
  const { product_id, client_name, startDate, endDate } = req.query;
  
  let query = `
    SELECT s.*, p.name as product_name, p.type as product_type, u.username
    FROM sales s
    JOIN products p ON s.product_id = p.id
    JOIN users u ON s.user_id = u.id
    WHERE 1=1
  `;
  const params = [];
  
  if (product_id) {
    query += ' AND s.product_id = ?';
    params.push(product_id);
  }
  
  if (client_name) {
    query += ' AND s.client_name LIKE ?';
    params.push(`%${client_name}%`);
  }
  
  if (startDate) {
    query += ' AND s.sale_date >= ?';
    params.push(startDate);
  }
  
  if (endDate) {
    query += ' AND s.sale_date <= ?';
    params.push(endDate);
  }
  
  query += ' ORDER BY s.sale_date DESC';
  
  db.all(query, params, (err, sales) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    res.json(sales);
  });
});

// Create sale record
app.post('/api/sales', authenticateToken, (req, res) => {
  const { product_id, quantity, total_amount, client_name, sale_date, notes, status, payment_status } = req.body;
  
  if (!product_id || !quantity || !total_amount || !client_name || !sale_date) {
    return res.status(400).json({ error: 'Product, quantity, total amount, client name, and sale date are required' });
  }
  
  // Verify product exists
  db.get('SELECT id FROM products WHERE id = ?', [product_id], (err, product) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    db.run(
      'INSERT INTO sales (product_id, quantity, total_amount, client_name, sale_date, user_id, notes, status, payment_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [product_id, quantity, total_amount, client_name, sale_date, req.user.id, notes || '', status || 'delivered', payment_status || 'not paid'],
      function(err) {
        if (err) {
          console.error("Database error:", err);
          return res.status(500).json({ error: 'Internal server error' });
        }
        
        res.status(201).json({ success: true, id: this.lastID });
      }
    );
  });
});

// Get sale record by ID
app.get('/api/sales/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  
  db.get(
    `SELECT s.*, p.name as product_name, p.type as product_type
     FROM sales s
     JOIN products p ON s.product_id = p.id
     WHERE s.id = ?`,
    [id],
    (err, sale) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      if (!sale) {
        return res.status(404).json({ error: 'Sale record not found' });
      }
      
      res.json(sale);
    }
  );
});

// Update sale record
app.put('/api/sales/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { product_id, quantity, total_amount, client_name, sale_date, notes, status, payment_status } = req.body;
  
  if (!product_id || !quantity || !total_amount || !client_name || !sale_date) {
    return res.status(400).json({ error: 'Product, quantity, total amount, client name, and sale date are required' });
  }
  
  // Verify product exists
  db.get('SELECT id FROM products WHERE id = ?', [product_id], (err, product) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    db.run(
      'UPDATE sales SET product_id = ?, quantity = ?, total_amount = ?, client_name = ?, sale_date = ?, notes = ?, status = ?, payment_status = ? WHERE id = ?',
      [product_id, quantity, total_amount, client_name, sale_date, notes || '', status || 'delivered', payment_status || 'not paid', id],
      function(err) {
        if (err) {
          console.error("Database error:", err);
          return res.status(500).json({ error: 'Internal server error' });
        }
        
        if (this.changes === 0) {
          return res.status(404).json({ error: 'Sale record not found' });
        }
        
        res.json({ success: true });
      }
    );
  });
});

// Delete sale record
app.delete('/api/sales/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  
  db.run(
    'DELETE FROM sales WHERE id = ?',
    [id],
    function(err) {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Sale record not found' });
      }
      
      res.json({ success: true });
    }
  );
});

// Serve the frontend for any other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

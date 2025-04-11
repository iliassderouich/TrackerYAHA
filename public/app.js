// Global variables
let token = localStorage.getItem('token');
let currentUser = null;

// DOM Elements
const loginPage = document.getElementById('login-page');
const dashboardPage = document.getElementById('dashboard-page');
const modalContainer = document.getElementById('modal-container');
const modalContent = document.getElementById('modal-content');

// Check if user is logged in
function checkAuth() {
    if (token) {
        // Fetch current user
        fetch('/api/auth/me', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Authentication failed');
            }
            return response.json();
        })
        .then(data => {
            currentUser = data.user;
            document.getElementById('user-welcome').textContent = `Welcome, ${currentUser.username}`;
            showDashboard();
            loadDashboardStats();
        })
        .catch(error => {
            console.error('Auth error:', error);
            logout();
        });
    } else {
        showLogin();
    }
}

// Show login page
function showLogin() {
    loginPage.classList.remove('hidden');
    dashboardPage.classList.add('hidden');
}

// Show dashboard
function showDashboard() {
    loginPage.classList.add('hidden');
    dashboardPage.classList.remove('hidden');
    showPage('home');
}

// Login form submission
document.getElementById('login-form').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    fetch('/api/auth/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            document.getElementById('login-error').classList.remove('hidden');
            document.getElementById('login-error-message').textContent = data.error;
        } else {
            token = data.token;
            currentUser = data.user;
            localStorage.setItem('token', token);
            document.getElementById('login-error').classList.add('hidden');
            document.getElementById('user-welcome').textContent = `Welcome, ${currentUser.username}`;
            showDashboard();
            loadDashboardStats();
        }
    })
    .catch(error => {
        console.error('Login error:', error);
        document.getElementById('login-error').classList.remove('hidden');
        document.getElementById('login-error-message').textContent = 'An error occurred during login';
    });
});

// Logout
document.getElementById('logout-btn').addEventListener('click', logout);

function logout() {
    token = null;
    currentUser = null;
    localStorage.removeItem('token');
    showLogin();
}

// Navigation
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', function(e) {
        e.preventDefault();
        const page = this.getAttribute('data-page');
        showPage(page);
    });
});

// Quick actions
document.querySelectorAll('.quick-action').forEach(button => {
    button.addEventListener('click', function() {
        const action = this.getAttribute('data-action');
        
        switch(action) {
            case 'add-expense':
                showPage('expenses');
                showExpenseModal();
                break;
            case 'add-product':
                showPage('products');
                showProductModal();
                break;
            case 'add-production':
                showPage('production');
                showProductionModal();
                break;
            case 'add-sale':
                showPage('sales');
                showSaleModal();
                break;
        }
    });
});

// Show specific page content
function showPage(page) {
    // Hide all page content
    document.querySelectorAll('.page-content').forEach(content => {
        content.classList.add('hidden');
    });
    
    // Show selected page content
    document.getElementById(`${page}-content`).classList.remove('hidden');
    
    // Highlight active nav link
    document.querySelectorAll('.nav-link').forEach(link => {
        if (link.getAttribute('data-page') === page) {
            link.classList.add('bg-gray-200');
        } else {
            link.classList.remove('bg-gray-200');
        }
    });
    
    // Load page data
    switch(page) {
        case 'expenses':
            loadExpenses();
            break;
        case 'products':
            loadProducts();
            break;
        case 'production':
            loadProduction();
            break;
        case 'sales':
            loadSales();
            break;
    }
}

// Load dashboard statistics
function loadDashboardStats() {
    // Fetch counts for dashboard
    Promise.all([
        fetch('/api/expenses', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/products', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/production', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/sales', { headers: { 'Authorization': `Bearer ${token}` } })
    ])
    .then(responses => Promise.all(responses.map(res => res.json())))
    .then(([expenses, products, production, sales]) => {
        // Update counts
        document.getElementById('expenses-count').textContent = expenses.length;
        document.getElementById('products-count').textContent = products.length;
        document.getElementById('production-count').textContent = production.length;
        document.getElementById('sales-count').textContent = sales.length;
        
        // Calculate total expenses
        const totalExpenses = expenses.reduce((sum, expense) => sum + parseFloat(expense.amount), 0);
        document.getElementById('expenses-total').textContent = `${totalExpenses.toFixed(2)} MAD`;
        
        // Calculate earnings (only from paid sales)
        const totalEarnings = sales
            .filter(sale => sale.payment_status === 'paid' && sale.status !== 'cancelled')
            .reduce((sum, sale) => sum + parseFloat(sale.total_amount), 0);
        document.getElementById('earnings-total').textContent = `${totalEarnings.toFixed(2)} MAD`;
        
        // Calculate net profit
        const netProfit = totalEarnings - totalExpenses;
        const netProfitElement = document.getElementById('net-profit');
        netProfitElement.textContent = `${netProfit.toFixed(2)} MAD`;
        
        // Set color based on profit/loss
        if (netProfit > 0) {
            netProfitElement.classList.add('text-green-600');
            netProfitElement.classList.remove('text-red-600');
        } else if (netProfit < 0) {
            netProfitElement.classList.add('text-red-600');
            netProfitElement.classList.remove('text-green-600');
        } else {
            netProfitElement.classList.remove('text-green-600', 'text-red-600');
        }
    })
    .catch(error => {
        console.error('Error loading dashboard stats:', error);
    });
}

// Format date for display
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString();
}

// ==================== EXPENSES ====================

// Load expenses
function loadExpenses() {
    const tableBody = document.getElementById('expenses-table-body');
    const loading = document.getElementById('expenses-loading');
    const error = document.getElementById('expenses-error');
    const empty = document.getElementById('expenses-empty');
    const table = document.getElementById('expenses-table');
    
    // Show loading, hide others
    loading.classList.remove('hidden');
    error.classList.add('hidden');
    empty.classList.add('hidden');
    table.classList.add('hidden');
    
    // Build query parameters
    const category = document.getElementById('expense-filter-category').value;
    const startDate = document.getElementById('expense-filter-start-date').value;
    const endDate = document.getElementById('expense-filter-end-date').value;
    
    let url = '/api/expenses';
    const params = new URLSearchParams();
    
    if (category) params.append('category', category);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    if (params.toString()) {
        url += `?${params.toString()}`;
    }
    
    // Fetch expenses
    fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to fetch expenses');
        }
        return response.json();
    })
    .then(expenses => {
        // Hide loading
        loading.classList.add('hidden');
        
        // Clear table body
        tableBody.innerHTML = '';
        
        if (expenses.length === 0) {
            // Show empty message
            empty.classList.remove('hidden');
        } else {
            // Populate table and show it
            expenses.forEach(expense => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap">${formatDate(expense.date)}</td>
                    <td class="px-6 py-4 whitespace-nowrap">${expense.category}</td>
                    <td class="px-6 py-4">${expense.description || ''}</td>
                    <td class="px-6 py-4 whitespace-nowrap">${parseFloat(expense.amount).toFixed(2)} MAD</td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button class="edit-expense text-indigo-600 hover:text-indigo-900 mr-4" data-id="${expense.id}">
                            Edit
                        </button>
                        <button class="delete-expense text-red-600 hover:text-red-900" data-id="${expense.id}">
                            Delete
                        </button>
                    </td>
                `;
                tableBody.appendChild(row);
            });
            
            // Add event listeners to edit and delete buttons
            document.querySelectorAll('.edit-expense').forEach(button => {
                button.addEventListener('click', function() {
                    const id = this.getAttribute('data-id');
                    showExpenseModal(id);
                });
            });
            
            document.querySelectorAll('.delete-expense').forEach(button => {
                button.addEventListener('click', function() {
                    const id = this.getAttribute('data-id');
                    if (confirm('Are you sure you want to delete this expense?')) {
                        deleteExpense(id);
                    }
                });
            });
            
            table.classList.remove('hidden');
        }
    })
    .catch(err => {
        console.error('Error loading expenses:', err);
        loading.classList.add('hidden');
        error.textContent = err.message;
        error.classList.remove('hidden');
    });
}

// Expense filter form submission
document.getElementById('expense-filter-form').addEventListener('submit', function(e) {
    e.preventDefault();
    loadExpenses();
});

// Add expense button
document.getElementById('add-expense-btn').addEventListener('click', function() {
    showExpenseModal();
});

// Show expense modal (for add or edit)
function showExpenseModal(id = null) {
    const isEdit = id !== null;
    const title = isEdit ? 'Edit Expense' : 'Add New Expense';
    const submitText = isEdit ? 'Update Expense' : 'Save Expense';
    
    // Create modal content
    modalContent.innerHTML = `
        <div class="modal-header flex justify-between items-center mb-4">
            <h3 class="text-lg font-medium">${title}</h3>
            <button id="close-modal" class="text-gray-500 hover:text-gray-700">
                <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
            </button>
        </div>
        <div id="expense-modal-error" class="hidden bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4"></div>
        <form id="expense-form">
            <div class="grid grid-cols-1 gap-4">
                <div>
                    <label for="expense-amount" class="block text-sm font-medium text-gray-700 mb-1">Amount ($) *</label>
                    <input type="number" id="expense-amount" name="amount" step="0.01" required class="w-full border border-gray-300 rounded px-3 py-2" placeholder="0.00">
                </div>
                <div>
                    <label for="expense-category" class="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                    <select id="expense-category" name="category" required class="w-full border border-gray-300 rounded px-3 py-2">
                        <option value="">Select a category</option>
                        <option value="Office">Office</option>
                        <option value="Utilities">Utilities</option>
                        <option value="Supplies">Supplies</option>
                        <option value="Salary">Salary</option>
                        <option value="Equipment">Equipment</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
                <div>
                    <label for="expense-description" class="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea id="expense-description" name="description" class="w-full border border-gray-300 rounded px-3 py-2" rows="3" placeholder="Enter expense description"></textarea>
                </div>
                <div>
                    <label for="expense-date" class="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                    <input type="date" id="expense-date" name="date" required class="w-full border border-gray-300 rounded px-3 py-2">
                </div>
                <div class="flex justify-end space-x-2 pt-4">
                    <button type="button" id="cancel-expense" class="bg-gray-200 text-gray-700 py-2 px-4 rounded hover:bg-gray-300 transition-colors">
                        Cancel
                    </button>
                    <button type="submit" id="submit-expense" class="bg-indigo-600 text-white py-2 px-4 rounded hover:bg-indigo-700 transition-colors">
                        ${submitText}
                    </button>
                </div>
            </div>
        </form>
    `;
    
    // Show modal
    modalContainer.classList.remove('hidden');
    
    // Set default date to today for new expenses
    if (!isEdit) {
        document.getElementById('expense-date').value = new Date().toISOString().split('T')[0];
    }
    
    // If editing, fetch expense data
    if (isEdit) {
        fetch(`/api/expenses/${id}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch expense');
            }
            return response.json();
        })
        .then(expense => {
            document.getElementById('expense-amount').value = expense.amount;
            document.getElementById('expense-category').value = expense.category;
            document.getElementById('expense-description').value = expense.description || '';
            document.getElementById('expense-date').value = expense.date.split('T')[0];
        })
        .catch(error => {
            console.error('Error fetching expense:', error);
            document.getElementById('expense-modal-error').textContent = error.message;
            document.getElementById('expense-modal-error').classList.remove('hidden');
        });
    }
    
    // Close modal
    document.getElementById('close-modal').addEventListener('click', function() {
        modalContainer.classList.add('hidden');
    });
    
    document.getElementById('cancel-expense').addEventListener('click', function() {
        modalContainer.classList.add('hidden');
    });
    
    // Form submission
    document.getElementById('expense-form').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const formData = {
            amount: document.getElementById('expense-amount').value,
            category: document.getElementById('expense-category').value,
            description: document.getElementById('expense-description').value,
            date: document.getElementById('expense-date').value
        };
        
        const url = isEdit ? `/api/expenses/${id}` : '/api/expenses';
        const method = isEdit ? 'PUT' : 'POST';
        
        fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(formData)
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(data => {
                    throw new Error(data.error || 'Failed to save expense');
                });
            }
            return response.json();
        })
        .then(data => {
            modalContainer.classList.add('hidden');
            loadExpenses();
            loadDashboardStats();
        })
        .catch(error => {
            console.error('Error saving expense:', error);
            document.getElementById('expense-modal-error').textContent = error.message;
            document.getElementById('expense-modal-error').classList.remove('hidden');
        });
    });
}

// Delete expense
function deleteExpense(id) {
    fetch(`/api/expenses/${id}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.error || 'Failed to delete expense');
            });
        }
        return response.json();
    })
    .then(data => {
        loadExpenses();
        loadDashboardStats();
    })
    .catch(error => {
        console.error('Error deleting expense:', error);
        alert(error.message);
    });
}

// ==================== PRODUCTS ====================

// Load products
function loadProducts() {
    const tableBody = document.getElementById('products-table-body');
    const loading = document.getElementById('products-loading');
    const error = document.getElementById('products-error');
    const empty = document.getElementById('products-empty');
    const table = document.getElementById('products-table');
    
    // Show loading, hide others
    loading.classList.remove('hidden');
    error.classList.add('hidden');
    empty.classList.add('hidden');
    table.classList.add('hidden');
    
    // Build query parameters
    const type = document.getElementById('product-filter-type').value;
    
    let url = '/api/products';
    if (type) {
        url += `?type=${encodeURIComponent(type)}`;
    }
    
    // Fetch products
    fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to fetch products');
        }
        return response.json();
    })
    .then(products => {
        // Hide loading
        loading.classList.add('hidden');
        
        // Clear table body
        tableBody.innerHTML = '';
        
        if (products.length === 0) {
            // Show empty message
            empty.classList.remove('hidden');
        } else {
            // Populate table and show it
            products.forEach(product => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap">${product.name}</td>
                    <td class="px-6 py-4 whitespace-nowrap">${product.type}</td>
                    <td class="px-6 py-4 whitespace-nowrap">${parseFloat(product.cost_price).toFixed(2)} MAD</td>
                    <td class="px-6 py-4 whitespace-nowrap">${parseFloat(product.selling_price).toFixed(2)} MAD</td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button class="edit-product text-indigo-600 hover:text-indigo-900 mr-4" data-id="${product.id}">
                            Edit
                        </button>
                        <button class="delete-product text-red-600 hover:text-red-900" data-id="${product.id}">
                            Delete
                        </button>
                    </td>
                `;
                tableBody.appendChild(row);
            });
            
            // Add event listeners to edit and delete buttons
            document.querySelectorAll('.edit-product').forEach(button => {
                button.addEventListener('click', function() {
                    const id = this.getAttribute('data-id');
                    showProductModal(id);
                });
            });
            
            document.querySelectorAll('.delete-product').forEach(button => {
                button.addEventListener('click', function() {
                    const id = this.getAttribute('data-id');
                    if (confirm('Are you sure you want to delete this product?')) {
                        deleteProduct(id);
                    }
                });
            });
            
            table.classList.remove('hidden');
        }
        
        // Also update product dropdowns in production and sales forms
        updateProductDropdowns(products);
    })
    .catch(err => {
        console.error('Error loading products:', err);
        loading.classList.add('hidden');
        error.textContent = err.message;
        error.classList.remove('hidden');
    });
}

// Update product dropdowns in production and sales forms
function updateProductDropdowns(products) {
    const productionDropdown = document.getElementById('production-filter-product');
    const salesDropdown = document.getElementById('sales-filter-product');
    
    if (productionDropdown) {
        // Keep the first option (All Products)
        productionDropdown.innerHTML = '<option value="">All Products</option>';
        
        products.forEach(product => {
            const option = document.createElement('option');
            option.value = product.id;
            option.textContent = `${product.name} (${product.type})`;
            productionDropdown.appendChild(option);
        });
    }
    
    if (salesDropdown) {
        // Keep the first option (All Products)
        salesDropdown.innerHTML = '<option value="">All Products</option>';
        
        products.forEach(product => {
            const option = document.createElement('option');
            option.value = product.id;
            option.textContent = `${product.name} (${product.type})`;
            salesDropdown.appendChild(option);
        });
    }
}

// Product filter form submission
document.getElementById('product-filter-form').addEventListener('submit', function(e) {
    e.preventDefault();
    loadProducts();
});

// Add product button
document.getElementById('add-product-btn').addEventListener('click', function() {
    showProductModal();
});

// Show product modal (for add or edit)
function showProductModal(id = null) {
    const isEdit = id !== null;
    const title = isEdit ? 'Edit Product' : 'Add New Product';
    const submitText = isEdit ? 'Update Product' : 'Save Product';
    
    // Create modal content
    modalContent.innerHTML = `
        <div class="modal-header flex justify-between items-center mb-4">
            <h3 class="text-lg font-medium">${title}</h3>
            <button id="close-modal" class="text-gray-500 hover:text-gray-700">
                <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
            </button>
        </div>
        <div id="product-modal-error" class="hidden bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4"></div>
        <form id="product-form">
            <div class="grid grid-cols-1 gap-4">
                <div>
                    <label for="product-name" class="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
                    <input type="text" id="product-name" name="name" required class="w-full border border-gray-300 rounded px-3 py-2" placeholder="Enter product name">
                </div>
                <div>
                    <label for="product-type" class="block text-sm font-medium text-gray-700 mb-1">Product Type *</label>
                    <select id="product-type" name="type" required class="w-full border border-gray-300 rounded px-3 py-2">
                        <option value="">Select a type</option>
                        <option value="Hoodie">Hoodie</option>
                        <option value="Sweatshirt">Sweatshirt</option>
                        <option value="Tshirt">Tshirt</option>
                    </select>
                </div>
                <div>
                    <label for="product-cost-price" class="block text-sm font-medium text-gray-700 mb-1">Cost Price (MAD) *</label>
                    <input type="number" id="product-cost-price" name="cost_price" step="0.01" required class="w-full border border-gray-300 rounded px-3 py-2" placeholder="0.00">
                </div>
                <div>
                    <label for="product-selling-price" class="block text-sm font-medium text-gray-700 mb-1">Selling Price (MAD) *</label>
                    <input type="number" id="product-selling-price" name="selling_price" step="0.01" required class="w-full border border-gray-300 rounded px-3 py-2" placeholder="0.00">
                </div>
                <div class="flex justify-end space-x-2 pt-4">
                    <button type="button" id="cancel-product" class="bg-gray-200 text-gray-700 py-2 px-4 rounded hover:bg-gray-300 transition-colors">
                        Cancel
                    </button>
                    <button type="submit" id="submit-product" class="bg-indigo-600 text-white py-2 px-4 rounded hover:bg-indigo-700 transition-colors">
                        ${submitText}
                    </button>
                </div>
            </div>
        </form>
    `;
    
    // Show modal
    modalContainer.classList.remove('hidden');
    
    // If editing, fetch product data
    if (isEdit) {
        fetch(`/api/products/${id}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch product');
            }
            return response.json();
        })
        .then(product => {
            document.getElementById('product-name').value = product.name;
            document.getElementById('product-type').value = product.type;
            document.getElementById('product-cost-price').value = product.cost_price;
            document.getElementById('product-selling-price').value = product.selling_price;
        })
        .catch(error => {
            console.error('Error fetching product:', error);
            document.getElementById('product-modal-error').textContent = error.message;
            document.getElementById('product-modal-error').classList.remove('hidden');
        });
    }
    
    // Close modal
    document.getElementById('close-modal').addEventListener('click', function() {
        modalContainer.classList.add('hidden');
    });
    
    document.getElementById('cancel-product').addEventListener('click', function() {
        modalContainer.classList.add('hidden');
    });
    
    // Form submission
    document.getElementById('product-form').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const formData = {
            name: document.getElementById('product-name').value,
            type: document.getElementById('product-type').value,
            cost_price: document.getElementById('product-cost-price').value,
            selling_price: document.getElementById('product-selling-price').value
        };
        
        const url = isEdit ? `/api/products/${id}` : '/api/products';
        const method = isEdit ? 'PUT' : 'POST';
        
        fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(formData)
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(data => {
                    throw new Error(data.error || 'Failed to save product');
                });
            }
            return response.json();
        })
        .then(data => {
            modalContainer.classList.add('hidden');
            loadProducts();
            loadDashboardStats();
        })
        .catch(error => {
            console.error('Error saving product:', error);
            document.getElementById('product-modal-error').textContent = error.message;
            document.getElementById('product-modal-error').classList.remove('hidden');
        });
    });
}

// Delete product
function deleteProduct(id) {
    fetch(`/api/products/${id}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.error || 'Failed to delete product');
            });
        }
        return response.json();
    })
    .then(data => {
        loadProducts();
        loadDashboardStats();
    })
    .catch(error => {
        console.error('Error deleting product:', error);
        alert(error.message);
    });
}

// ==================== PRODUCTION ====================

// Load production records
function loadProduction() {
    const tableBody = document.getElementById('production-table-body');
    const loading = document.getElementById('production-loading');
    const error = document.getElementById('production-error');
    const empty = document.getElementById('production-empty');
    const table = document.getElementById('production-table');
    
    // Show loading, hide others
    loading.classList.remove('hidden');
    error.classList.add('hidden');
    empty.classList.add('hidden');
    table.classList.add('hidden');
    
    // Build query parameters
    const productId = document.getElementById('production-filter-product').value;
    const startDate = document.getElementById('production-filter-start-date').value;
    const endDate = document.getElementById('production-filter-end-date').value;
    
    let url = '/api/production';
    const params = new URLSearchParams();
    
    if (productId) params.append('product_id', productId);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    if (params.toString()) {
        url += `?${params.toString()}`;
    }
    
    // Fetch production records
    fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to fetch production records');
        }
        return response.json();
    })
    .then(production => {
        // Hide loading
        loading.classList.add('hidden');
        
        // Clear table body
        tableBody.innerHTML = '';
        
        if (production.length === 0) {
            // Show empty message
            empty.classList.remove('hidden');
        } else {
            // Populate table and show it
            production.forEach(record => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap">${formatDate(record.production_date)}</td>
                    <td class="px-6 py-4 whitespace-nowrap">${record.product_name} (${record.product_type})</td>
                    <td class="px-6 py-4 whitespace-nowrap">${record.quantity}</td>
                    <td class="px-6 py-4 whitespace-nowrap">${record.username}</td>
                    <td class="px-6 py-4">${record.notes || ''}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button class="edit-production text-indigo-600 hover:text-indigo-900 mr-4" data-id="${record.id}">
                            Edit
                        </button>
                        <button class="delete-production text-red-600 hover:text-red-900" data-id="${record.id}">
                            Delete
                        </button>
                    </td>
                `;
                tableBody.appendChild(row);
            });
            
            // Add event listeners to edit and delete buttons
            document.querySelectorAll('.edit-production').forEach(button => {
                button.addEventListener('click', function() {
                    const id = this.getAttribute('data-id');
                    showProductionModal(id);
                });
            });
            
            document.querySelectorAll('.delete-production').forEach(button => {
                button.addEventListener('click', function() {
                    const id = this.getAttribute('data-id');
                    if (confirm('Are you sure you want to delete this production record?')) {
                        deleteProduction(id);
                    }
                });
            });
            
            table.classList.remove('hidden');
        }
    })
    .catch(err => {
        console.error('Error loading production records:', err);
        loading.classList.add('hidden');
        error.textContent = err.message;
        error.classList.remove('hidden');
    });
}

// Production filter form submission
document.getElementById('production-filter-form').addEventListener('submit', function(e) {
    e.preventDefault();
    loadProduction();
});

// Add production button
document.getElementById('add-production-btn').addEventListener('click', function() {
    showProductionModal();
});

// Show production modal (for add or edit)
function showProductionModal(id = null) {
    const isEdit = id !== null;
    const title = isEdit ? 'Edit Production Record' : 'Add Production Record';
    const submitText = isEdit ? 'Update Production Record' : 'Save Production Record';
    
    // Create modal content
    modalContent.innerHTML = `
        <div class="modal-header flex justify-between items-center mb-4">
            <h3 class="text-lg font-medium">${title}</h3>
            <button id="close-modal" class="text-gray-500 hover:text-gray-700">
                <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
            </button>
        </div>
        <div id="production-modal-error" class="hidden bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4"></div>
        <form id="production-form">
            <div class="grid grid-cols-1 gap-4">
                <div>
                    <label for="production-product" class="block text-sm font-medium text-gray-700 mb-1">Product *</label>
                    <select id="production-product" name="product_id" required class="w-full border border-gray-300 rounded px-3 py-2">
                        <option value="">Select a product</option>
                        <!-- Products will be populated here -->
                    </select>
                </div>
                <div>
                    <label for="production-quantity" class="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
                    <input type="number" id="production-quantity" name="quantity" min="1" required class="w-full border border-gray-300 rounded px-3 py-2" placeholder="Enter quantity produced">
                </div>
                <div>
                    <label for="production-date" class="block text-sm font-medium text-gray-700 mb-1">Production Date *</label>
                    <input type="date" id="production-date" name="production_date" required class="w-full border border-gray-300 rounded px-3 py-2">
                </div>
                <div>
                    <label for="production-notes" class="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <textarea id="production-notes" name="notes" class="w-full border border-gray-300 rounded px-3 py-2" rows="3" placeholder="Enter any additional notes"></textarea>
                </div>
                <div class="flex justify-end space-x-2 pt-4">
                    <button type="button" id="cancel-production" class="bg-gray-200 text-gray-700 py-2 px-4 rounded hover:bg-gray-300 transition-colors">
                        Cancel
                    </button>
                    <button type="submit" id="submit-production" class="bg-indigo-600 text-white py-2 px-4 rounded hover:bg-indigo-700 transition-colors">
                        ${submitText}
                    </button>
                </div>
            </div>
        </form>
    `;
    
    // Show modal
    modalContainer.classList.remove('hidden');
    
    // Set default date to today for new production records
    if (!isEdit) {
        document.getElementById('production-date').value = new Date().toISOString().split('T')[0];
    }
    
    // Fetch products for dropdown
    fetch('/api/products', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to fetch products');
        }
        return response.json();
    })
    .then(products => {
        const productDropdown = document.getElementById('production-product');
        
        // Clear dropdown except first option
        productDropdown.innerHTML = '<option value="">Select a product</option>';
        
        // Add products to dropdown
        products.forEach(product => {
            const option = document.createElement('option');
            option.value = product.id;
            option.textContent = `${product.name} (${product.type})`;
            productDropdown.appendChild(option);
        });
        
        // If editing, fetch production record data
        if (isEdit) {
            fetch(`/api/production/${id}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to fetch production record');
                }
                return response.json();
            })
            .then(production => {
                document.getElementById('production-product').value = production.product_id;
                document.getElementById('production-quantity').value = production.quantity;
                document.getElementById('production-date').value = production.production_date.split('T')[0];
                document.getElementById('production-notes').value = production.notes || '';
            })
            .catch(error => {
                console.error('Error fetching production record:', error);
                document.getElementById('production-modal-error').textContent = error.message;
                document.getElementById('production-modal-error').classList.remove('hidden');
            });
        }
    })
    .catch(error => {
        console.error('Error fetching products:', error);
        document.getElementById('production-modal-error').textContent = 'Failed to load products';
        document.getElementById('production-modal-error').classList.remove('hidden');
    });
    
    // Close modal
    document.getElementById('close-modal').addEventListener('click', function() {
        modalContainer.classList.add('hidden');
    });
    
    document.getElementById('cancel-production').addEventListener('click', function() {
        modalContainer.classList.add('hidden');
    });
    
    // Form submission
    document.getElementById('production-form').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const formData = {
            product_id: document.getElementById('production-product').value,
            quantity: document.getElementById('production-quantity').value,
            production_date: document.getElementById('production-date').value,
            notes: document.getElementById('production-notes').value
        };
        
        const url = isEdit ? `/api/production/${id}` : '/api/production';
        const method = isEdit ? 'PUT' : 'POST';
        
        fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(formData)
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(data => {
                    throw new Error(data.error || 'Failed to save production record');
                });
            }
            return response.json();
        })
        .then(data => {
            modalContainer.classList.add('hidden');
            loadProduction();
            loadDashboardStats();
        })
        .catch(error => {
            console.error('Error saving production record:', error);
            document.getElementById('production-modal-error').textContent = error.message;
            document.getElementById('production-modal-error').classList.remove('hidden');
        });
    });
}

// Delete production record
function deleteProduction(id) {
    fetch(`/api/production/${id}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.error || 'Failed to delete production record');
            });
        }
        return response.json();
    })
    .then(data => {
        loadProduction();
        loadDashboardStats();
    })
    .catch(error => {
        console.error('Error deleting production record:', error);
        alert(error.message);
    });
}

// ==================== SALES ====================

// Load sales records
function loadSales() {
    const tableBody = document.getElementById('sales-table-body');
    const loading = document.getElementById('sales-loading');
    const error = document.getElementById('sales-error');
    const empty = document.getElementById('sales-empty');
    const table = document.getElementById('sales-table');
    
    // Show loading, hide others
    loading.classList.remove('hidden');
    error.classList.add('hidden');
    empty.classList.add('hidden');
    table.classList.add('hidden');
    
    // Build query parameters
    const productId = document.getElementById('sales-filter-product').value;
    const clientName = document.getElementById('sales-filter-client').value;
    const startDate = document.getElementById('sales-filter-start-date').value;
    const endDate = document.getElementById('sales-filter-end-date').value;
    
    let url = '/api/sales';
    const params = new URLSearchParams();
    
    if (productId) params.append('product_id', productId);
    if (clientName) params.append('client_name', clientName);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    if (params.toString()) {
        url += `?${params.toString()}`;
    }
    
    // Fetch sales records
    fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to fetch sales records');
        }
        return response.json();
    })
    .then(sales => {
        // Hide loading
        loading.classList.add('hidden');
        
        // Clear table body
        tableBody.innerHTML = '';
        
        if (sales.length === 0) {
            // Show empty message
            empty.classList.remove('hidden');
        } else {
            // Populate table and show it
            sales.forEach(record => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap">${formatDate(record.sale_date)}</td>
                    <td class="px-6 py-4 whitespace-nowrap">${record.client_name}</td>
                    <td class="px-6 py-4 whitespace-nowrap">${record.product_name} (${record.product_type})</td>
                    <td class="px-6 py-4 whitespace-nowrap">${record.quantity}</td>
                    <td class="px-6 py-4 whitespace-nowrap">${parseFloat(record.total_amount).toFixed(2)} MAD</td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${record.status === 'delivered' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                            ${record.status || 'delivered'}
                        </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${record.payment_status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}">
                            ${record.payment_status || 'not paid'}
                        </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">${record.username}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button class="edit-sale text-indigo-600 hover:text-indigo-900 mr-4" data-id="${record.id}">
                            Edit
                        </button>
                        <button class="delete-sale text-red-600 hover:text-red-900" data-id="${record.id}">
                            Delete
                        </button>
                    </td>
                `;
                tableBody.appendChild(row);
            });
            
            // Add event listeners to edit and delete buttons
            document.querySelectorAll('.edit-sale').forEach(button => {
                button.addEventListener('click', function() {
                    const id = this.getAttribute('data-id');
                    showSaleModal(id);
                });
            });
            
            document.querySelectorAll('.delete-sale').forEach(button => {
                button.addEventListener('click', function() {
                    const id = this.getAttribute('data-id');
                    if (confirm('Are you sure you want to delete this sale record?')) {
                        deleteSale(id);
                    }
                });
            });
            
            table.classList.remove('hidden');
        }
    })
    .catch(err => {
        console.error('Error loading sales records:', err);
        loading.classList.add('hidden');
        error.textContent = err.message;
        error.classList.remove('hidden');
    });
}

// Sales filter form submission
document.getElementById('sales-filter-form').addEventListener('submit', function(e) {
    e.preventDefault();
    loadSales();
});

// Add sale button
document.getElementById('add-sale-btn').addEventListener('click', function() {
    showSaleModal();
});

// Show sale modal (for add or edit)
function showSaleModal(id = null) {
    const isEdit = id !== null;
    const title = isEdit ? 'Edit Sale Record' : 'Add Sale Record';
    const submitText = isEdit ? 'Update Sale Record' : 'Save Sale Record';
    
    // Create modal content
    modalContent.innerHTML = `
        <div class="modal-header flex justify-between items-center mb-4">
            <h3 class="text-lg font-medium">${title}</h3>
            <button id="close-modal" class="text-gray-500 hover:text-gray-700">
                <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
            </button>
        </div>
        <div id="sale-modal-error" class="hidden bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4"></div>
        <form id="sale-form">
            <div class="grid grid-cols-1 gap-4">
                <div>
                    <label for="sale-client" class="block text-sm font-medium text-gray-700 mb-1">Client Name *</label>
                    <input type="text" id="sale-client" name="client_name" required class="w-full border border-gray-300 rounded px-3 py-2" placeholder="Enter client name">
                </div>
                <div>
                    <label for="sale-product" class="block text-sm font-medium text-gray-700 mb-1">Product *</label>
                    <select id="sale-product" name="product_id" required class="w-full border border-gray-300 rounded px-3 py-2">
                        <option value="">Select a product</option>
                        <!-- Products will be populated here -->
                    </select>
                </div>
                <div>
                    <label for="sale-quantity" class="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
                    <input type="number" id="sale-quantity" name="quantity" min="1" required class="w-full border border-gray-300 rounded px-3 py-2" placeholder="Enter quantity sold">
                </div>
                <div>
                    <label for="sale-amount" class="block text-sm font-medium text-gray-700 mb-1">Total Amount (MAD) *</label>
                    <input type="number" id="sale-amount" name="total_amount" step="0.01" required class="w-full border border-gray-300 rounded px-3 py-2" placeholder="0.00">
                    <p id="sale-suggested-amount" class="text-sm text-gray-500 mt-1 hidden">
                        Suggested: <span id="sale-suggested-value">0.00</span> MAD
                    </p>
                </div>
                <div>
                    <label for="sale-status" class="block text-sm font-medium text-gray-700 mb-1">Status *</label>
                    <select id="sale-status" name="status" required class="w-full border border-gray-300 rounded px-3 py-2">
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                </div>
                <div>
                    <label for="sale-payment" class="block text-sm font-medium text-gray-700 mb-1">Payment Status *</label>
                    <select id="sale-payment" name="payment_status" required class="w-full border border-gray-300 rounded px-3 py-2">
                        <option value="not paid">Not Paid</option>
                        <option value="paid">Paid</option>
                    </select>
                </div>
                <div>
                    <label for="sale-date" class="block text-sm font-medium text-gray-700 mb-1">Sale Date *</label>
                    <input type="date" id="sale-date" name="sale_date" required class="w-full border border-gray-300 rounded px-3 py-2">
                </div>
                <div>
                    <label for="sale-notes" class="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <textarea id="sale-notes" name="notes" class="w-full border border-gray-300 rounded px-3 py-2" rows="3" placeholder="Enter any additional notes"></textarea>
                </div>
                <div class="flex justify-end space-x-2 pt-4">
                    <button type="button" id="cancel-sale" class="bg-gray-200 text-gray-700 py-2 px-4 rounded hover:bg-gray-300 transition-colors">
                        Cancel
                    </button>
                    <button type="submit" id="submit-sale" class="bg-indigo-600 text-white py-2 px-4 rounded hover:bg-indigo-700 transition-colors">
                        ${submitText}
                    </button>
                </div>
            </div>
        </form>
    `;
    
    // Show modal
    modalContainer.classList.remove('hidden');
    
    // Set default date to today for new sales
    if (!isEdit) {
        document.getElementById('sale-date').value = new Date().toISOString().split('T')[0];
    }
    
    // Fetch products for dropdown
    fetch('/api/products', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to fetch products');
        }
        return response.json();
    })
    .then(products => {
        const productDropdown = document.getElementById('sale-product');
        
        // Clear dropdown except first option
        productDropdown.innerHTML = '<option value="">Select a product</option>';
        
        // Add products to dropdown
        products.forEach(product => {
            const option = document.createElement('option');
            option.value = product.id;
            option.textContent = `${product.name} (${product.type}) - ${parseFloat(product.selling_price).toFixed(2)} MAD`;
            option.dataset.price = product.selling_price;
            productDropdown.appendChild(option);
        });
        
        // Add event listeners for auto-calculating total amount
        document.getElementById('sale-product').addEventListener('change', updateSuggestedAmount);
        document.getElementById('sale-quantity').addEventListener('input', updateSuggestedAmount);
        
        function updateSuggestedAmount() {
            const productSelect = document.getElementById('sale-product');
            const quantityInput = document.getElementById('sale-quantity');
            const suggestedAmount = document.getElementById('sale-suggested-amount');
            const suggestedValue = document.getElementById('sale-suggested-value');
            
            if (productSelect.value && quantityInput.value) {
                const selectedOption = productSelect.options[productSelect.selectedIndex];
                const price = parseFloat(selectedOption.dataset.price);
                const quantity = parseInt(quantityInput.value);
                
                if (!isNaN(price) && !isNaN(quantity)) {
                    const total = (price * quantity).toFixed(2);
                    suggestedValue.textContent = total;
                    suggestedAmount.classList.remove('hidden');
                    
                    // Auto-fill the total amount
                    document.getElementById('sale-amount').value = total;
                } else {
                    suggestedAmount.classList.add('hidden');
                }
            } else {
                suggestedAmount.classList.add('hidden');
            }
        }
        
        // If editing, fetch sale record data
        if (isEdit) {
            fetch(`/api/sales/${id}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to fetch sale record');
                }
                return response.json();
            })
            .then(sale => {
                document.getElementById('sale-client').value = sale.client_name;
                document.getElementById('sale-product').value = sale.product_id;
                document.getElementById('sale-quantity').value = sale.quantity;
                document.getElementById('sale-amount').value = sale.total_amount;
                document.getElementById('sale-date').value = sale.sale_date.split('T')[0];
                document.getElementById('sale-notes').value = sale.notes || '';
                document.getElementById('sale-status').value = sale.status || 'delivered';
                document.getElementById('sale-payment').value = sale.payment_status || 'not paid';
                
                // Update suggested amount
                updateSuggestedAmount();
            })
            .catch(error => {
                console.error('Error fetching sale record:', error);
                document.getElementById('sale-modal-error').textContent = error.message;
                document.getElementById('sale-modal-error').classList.remove('hidden');
            });
        }
    })
    .catch(error => {
        console.error('Error fetching products:', error);
        document.getElementById('sale-modal-error').textContent = 'Failed to load products';
        document.getElementById('sale-modal-error').classList.remove('hidden');
    });
    
    // Close modal
    document.getElementById('close-modal').addEventListener('click', function() {
        modalContainer.classList.add('hidden');
    });
    
    document.getElementById('cancel-sale').addEventListener('click', function() {
        modalContainer.classList.add('hidden');
    });
    
    // Form submission
    document.getElementById('sale-form').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const formData = {
            client_name: document.getElementById('sale-client').value,
            product_id: document.getElementById('sale-product').value,
            quantity: document.getElementById('sale-quantity').value,
            total_amount: document.getElementById('sale-amount').value,
            sale_date: document.getElementById('sale-date').value,
            notes: document.getElementById('sale-notes').value,
            status: document.getElementById('sale-status').value,
            payment_status: document.getElementById('sale-payment').value
        };
        
        const url = isEdit ? `/api/sales/${id}` : '/api/sales';
        const method = isEdit ? 'PUT' : 'POST';
        
        fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(formData)
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(data => {
                    throw new Error(data.error || 'Failed to save sale record');
                });
            }
            return response.json();
        })
        .then(data => {
            modalContainer.classList.add('hidden');
            loadSales();
            loadDashboardStats();
        })
        .catch(error => {
            console.error('Error saving sale record:', error);
            document.getElementById('sale-modal-error').textContent = error.message;
            document.getElementById('sale-modal-error').classList.remove('hidden');
        });
    });
}

// Delete sale record
function deleteSale(id) {
    fetch(`/api/sales/${id}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.error || 'Failed to delete sale record');
            });
        }
        return response.json();
    })
    .then(data => {
        loadSales();
        loadDashboardStats();
    })
    .catch(error => {
        console.error('Error deleting sale record:', error);
        alert(error.message);
    });
}

// Initialize the application
checkAuth();

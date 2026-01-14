const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

// Database file path
const dbPath = path.join(__dirname, '../data/banking.db');

// Create database connection
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        process.exit(1);
    }
    console.log('Connected to SQLite database');
});

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

// Create tables
const createTables = () => {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // Users table
            db.run(`
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT UNIQUE NOT NULL,
                    password TEXT NOT NULL,
                    first_name TEXT NOT NULL,
                    last_name TEXT NOT NULL,
                    phone TEXT,
                    date_of_birth TEXT,
                    address TEXT,
                    city TEXT,
                    state TEXT,
                    zip TEXT,
                    country TEXT DEFAULT 'USA',
                    profile_pic TEXT,
                    security_score INTEGER DEFAULT 0,
                    two_factor_enabled INTEGER DEFAULT 0,
                    biometric_enabled INTEGER DEFAULT 0,
                    is_verified INTEGER DEFAULT 0,
                    is_active INTEGER DEFAULT 1,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) console.error('Error creating users table:', err.message);
            });

            // Accounts table
            db.run(`
                CREATE TABLE IF NOT EXISTS accounts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    account_type TEXT NOT NULL,
                    account_number TEXT UNIQUE NOT NULL,
                    routing_number TEXT DEFAULT '121000248',
                    balance REAL DEFAULT 0.00,
                    available_balance REAL DEFAULT 0.00,
                    currency TEXT DEFAULT 'USD',
                    status TEXT DEFAULT 'active',
                    account_name TEXT,
                    is_primary INTEGER DEFAULT 0,
                    color TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            `, (err) => {
                if (err) console.error('Error creating accounts table:', err.message);
            });

            // Transactions table
            db.run(`
                CREATE TABLE IF NOT EXISTS transactions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    account_id INTEGER NOT NULL,
                    transaction_type TEXT NOT NULL,
                    amount REAL NOT NULL,
                    description TEXT,
                    category TEXT,
                    merchant_name TEXT,
                    reference_number TEXT UNIQUE,
                    status TEXT DEFAULT 'completed',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
                )
            `, (err) => {
                if (err) console.error('Error creating transactions table:', err.message);
            });

            // Transfers table
            db.run(`
                CREATE TABLE IF NOT EXISTS transfers (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    from_account_id INTEGER NOT NULL,
                    to_account_id INTEGER,
                    to_account_number TEXT,
                    to_routing_number TEXT,
                    amount REAL NOT NULL,
                    description TEXT,
                    status TEXT DEFAULT 'pending',
                    scheduled_for TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    completed_at TIMESTAMP,
                    FOREIGN KEY (from_account_id) REFERENCES accounts(id) ON DELETE CASCADE
                )
            `, (err) => {
                if (err) console.error('Error creating transfers table:', err.message);
            });

            // Cards table
            db.run(`
                CREATE TABLE IF NOT EXISTS cards (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    account_id INTEGER NOT NULL,
                    card_number_encrypted TEXT NOT NULL,
                    card_type TEXT DEFAULT 'Debit',
                    card_brand TEXT,
                    expiry_date TEXT NOT NULL,
                    cardholder_name TEXT NOT NULL,
                    cvv TEXT,
                    status TEXT DEFAULT 'active',
                    is_frozen INTEGER DEFAULT 0,
                    daily_limit REAL DEFAULT 500.00,
                    online_enabled INTEGER DEFAULT 1,
                    international_enabled INTEGER DEFAULT 0,
                    atm_enabled INTEGER DEFAULT 1,
                    virtual_card_available INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
                )
            `, (err) => {
                if (err) console.error('Error creating cards table:', err.message);
            });

            // Investments table
            db.run(`
                CREATE TABLE IF NOT EXISTS investments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    investment_type TEXT NOT NULL,
                    symbol TEXT,
                    name TEXT NOT NULL,
                    quantity REAL NOT NULL,
                    average_cost REAL NOT NULL,
                    current_price REAL NOT NULL,
                    current_value REAL NOT NULL,
                    change_percent REAL DEFAULT 0,
                    change_value REAL DEFAULT 0,
                    is_esg INTEGER DEFAULT 0,
                    sector TEXT,
                    asset_class TEXT,
                    risk_level TEXT DEFAULT 'moderate',
                    purchased_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            `, (err) => {
                if (err) console.error('Error creating investments table:', err.message);
            });

            // Savings goals table
            db.run(`
                CREATE TABLE IF NOT EXISTS savings_goals (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    goal_name TEXT NOT NULL,
                    target_amount REAL NOT NULL,
                    current_amount REAL DEFAULT 0,
                    target_date TEXT,
                    status TEXT DEFAULT 'active',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            `, (err) => {
                if (err) console.error('Error creating savings_goals table:', err.message);
            });

            // Statements table
            db.run(`
                CREATE TABLE IF NOT EXISTS statements (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    account_id INTEGER NOT NULL,
                    statement_type TEXT DEFAULT 'monthly',
                    statement_period_start TEXT NOT NULL,
                    statement_period_end TEXT NOT NULL,
                    total_credits REAL DEFAULT 0,
                    total_debits REAL DEFAULT 0,
                    starting_balance REAL DEFAULT 0,
                    ending_balance REAL DEFAULT 0,
                    file_path TEXT,
                    status TEXT DEFAULT 'generated',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
                )
            `, (err) => {
                if (err) console.error('Error creating statements table:', err.message);
            });

            // Notifications table
            db.run(`
                CREATE TABLE IF NOT EXISTS notifications (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    type TEXT NOT NULL,
                    title TEXT NOT NULL,
                    message TEXT NOT NULL,
                    is_read INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            `, (err) => {
                if (err) console.error('Error creating notifications table:', err.message);
            });

            // Security events table
            db.run(`
                CREATE TABLE IF NOT EXISTS security_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    event_type TEXT NOT NULL,
                    description TEXT,
                    severity TEXT DEFAULT 'low',
                    ip_address TEXT,
                    user_agent TEXT,
                    resolved INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            `, (err) => {
                if (err) console.error('Error creating security_events table:', err.message);
            });

            // Login history table
            db.run(`
                CREATE TABLE IF NOT EXISTS login_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    ip_address TEXT,
                    user_agent TEXT,
                    location TEXT,
                    login_method TEXT,
                    success INTEGER,
                    failure_reason TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
                )
            `, (err) => {
                if (err) console.error('Error creating login_history table:', err.message);
            });

            console.log('All tables created successfully');
            resolve();
        });
    });
};

// Create indexes for better performance
const createIndexes = () => {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
            db.run('CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id)');
            db.run('CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id)');
            db.run('CREATE INDEX IF NOT EXISTS idx_transfers_from_account_id ON transfers(from_account_id)');
            db.run('CREATE INDEX IF NOT EXISTS idx_cards_account_id ON cards(account_id)');
            db.run('CREATE INDEX IF NOT EXISTS idx_investments_user_id ON investments(user_id)');
            db.run('CREATE INDEX IF NOT EXISTS idx_savings_goals_user_id ON savings_goals(user_id)');
            db.run('CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)');
            db.run('CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON security_events(user_id)');
            db.run('CREATE INDEX IF NOT EXISTS idx_login_history_user_id ON login_history(user_id)');

            console.log('All indexes created successfully');
            resolve();
        });
    });
};

// Insert demo data
const insertDemoData = async () => {
    try {
        // Create demo user
        const hashedPassword = await bcrypt.hash('Demo123!', 10);

        db.run(`
            INSERT OR IGNORE INTO users 
            (email, password, first_name, last_name, phone, city, state, profile_pic, security_score, is_verified, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, ['demo@securebank.com', hashedPassword, 'John', 'Doe', '555-123-4567', 'San Francisco', 'CA', 'JD', 85, 1, 1], function (err) {
            if (err) console.error('Error inserting demo user:', err.message);
            else console.log('Demo user created: demo@securebank.com / Demo123!');

            const userId = this.lastID;

            // Create demo accounts
            db.run(`
                INSERT INTO accounts (user_id, account_type, account_number, balance, account_name, is_primary, color)
                VALUES (?, 'Checking', '1234567890', 5250.00, 'Primary Checking', 1, 'from-blue-600 to-blue-800')
            `, [userId], function (err) {
                if (err) console.error('Error inserting checking account:', err.message);
                else {
                    const checkingAccountId = this.lastID;

                    // Insert demo transactions for checking account
                    const transactions = [
                        ['credit', 3000.00, 'Salary Deposit', 'Income'],
                        ['debit', 150.00, 'Grocery Store', 'Food'],
                        ['debit', 80.00, 'Gas Station', 'Transportation'],
                        ['debit', 200.00, 'Electric Bill', 'Utilities'],
                        ['debit', 50.00, 'Restaurant', 'Food'],
                        ['credit', 500.00, 'Freelance Payment', 'Income'],
                        ['debit', 120.00, 'Clothing Store', 'Shopping'],
                        ['debit', 45.00, 'Internet Bill', 'Utilities'],
                        ['debit', 300.00, 'Car Insurance', 'Insurance'],
                        ['debit', 60.00, 'Pharmacy', 'Healthcare']
                    ];

                    transactions.forEach((tx, index) => {
                        db.run(`
                            INSERT INTO transactions (account_id, transaction_type, amount, description, category)
                            VALUES (?, ?, ?, ?, ?)
                        `, [checkingAccountId, tx[0], tx[1], tx[2], tx[3]]);
                    });
                }
            });

            db.run(`
                INSERT INTO accounts (user_id, account_type, account_number, balance, account_name, is_primary, color)
                VALUES (?, 'Savings', '0987654321', 15000.00, 'Emergency Fund', 0, 'from-green-600 to-green-800')
            `, [userId], function (err) {
                if (err) console.error('Error inserting savings account:', err.message);
                else {
                    const savingsAccountId = this.lastID;

                    // Insert demo savings goal
                    db.run(`
                        INSERT INTO savings_goals (user_id, goal_name, target_amount, current_amount, target_date)
                        VALUES (?, 'New Car', 20000.00, 15000.00, '2026-12-31')
                    `, [userId]);
                }
            });

            // Create demo card
            db.run(`
                INSERT INTO cards (account_id, card_number_encrypted, card_type, card_brand, expiry_date, cardholder_name, cvv)
                VALUES (?, '4532015112830366', 'Debit', 'Visa', '12/2028', 'John Doe', '123')
            `, [2], function (err) {
                if (err) console.error('Error inserting demo card:', err.message);
            });

            // Create demo investments
            const investments = [
                ['Stock', 'AAPL', 'Apple Inc.', 10, 175.50, 178.25, 'Technology', 'Stock', 'moderate', 1],
                ['ETF', 'VOO', 'Vanguard S&P 500', 25, 420.00, 435.00, 'Technology', 'ETF', 'low', 1],
                ['Stock', 'TSLA', 'Tesla Inc.', 15, 245.00, 238.50, 'Technology', 'Stock', 'high', 0]
            ];

            investments.forEach(inv => {
                const currentPrice = inv[4];
                const currentValue = inv[3] * currentPrice;
                const changePercent = ((currentPrice - inv[4]) / inv[4] * 100);
                const changeValue = (currentPrice - inv[4]) * inv[3];

                db.run(`
                    INSERT INTO investments (user_id, investment_type, symbol, name, quantity, average_cost, current_price, current_value, change_percent, change_value, sector, asset_class, risk_level, is_esg)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [userId, inv[0], inv[1], inv[2], inv[3], inv[4], inv[5], currentValue, changePercent, changeValue, inv[6], inv[7], inv[8], inv[9]]);
            });
        });

        console.log('Demo data inserted successfully');
    } catch (error) {
        console.error('Error inserting demo data:', error.message);
    }
};

// Run initialization
async function initializeDatabase() {
    try {
        await createTables();
        await createIndexes();
        await insertDemoData();

        console.log('\n✓ Database initialization complete!');
        console.log('\nDemo credentials:');
        console.log('  Email: demo@securebank.com');
        console.log('  Password: Demo123!');

        db.close((err) => {
            if (err) {
                console.error('Error closing database:', err.message);
                process.exit(1);
            }
            process.exit(0);
        });
    } catch (error) {
        console.error('Database initialization failed:', error.message);
        process.exit(1);
    }
}

initializeDatabase();

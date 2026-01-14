const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, checkUserStatus } = require('../middleware/auth');
const db = require('../config/database').getDB();

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken, checkUserStatus);

// Get user profile
router.get('/profile', async (req, res) => {
    try {
        const user = await new Promise((resolve, reject) => {
            db.get(`
                SELECT 
                    id,
                    email,
                    first_name,
                    last_name,
                    phone,
                    date_of_birth,
                    address,
                    city,
                    state,
                    zip,
                    country,
                    profile_pic,
                    security_score,
                    two_factor_enabled,
                    biometric_enabled,
                    is_verified,
                    created_at
                FROM users 
                WHERE id = ?
            `, [req.user.userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        res.json({
            success: true,
            user
        });
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Update user profile
router.put('/profile', async (req, res) => {
    try {
        const {
            firstName,
            lastName,
            phone,
            dateOfBirth,
            address,
            city,
            state,
            zip
        } = req.body;

        const updates = [];
        const values = [];

        if (firstName) {
            updates.push('first_name = ?');
            values.push(firstName);
        }
        if (lastName) {
            updates.push('last_name = ?');
            values.push(lastName);
        }
        if (phone) {
            updates.push('phone = ?');
            values.push(phone);
        }
        if (dateOfBirth) {
            updates.push('date_of_birth = ?');
            values.push(dateOfBirth);
        }
        if (address) {
            updates.push('address = ?');
            values.push(address);
        }
        if (city) {
            updates.push('city = ?');
            values.push(city);
        }
        if (state) {
            updates.push('state = ?');
            values.push(state);
        }
        if (zip) {
            updates.push('zip = ?');
            values.push(zip);
        }

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No fields to update'
            });
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        values.push(req.user.userId);

        await new Promise((resolve, reject) => {
            db.run(`
                UPDATE users 
                SET ${updates.join(', ')}
                WHERE id = ?
            `, values, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        const updatedUser = await new Promise((resolve, reject) => {
            db.get(`
                SELECT 
                    id,
                    email,
                    first_name,
                    last_name,
                    phone,
                    date_of_birth,
                    address,
                    city,
                    state,
                    zip,
                    country,
                    profile_pic
                FROM users 
                WHERE id = ?
            `, [req.user.userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        res.json({
            success: true,
            message: 'Profile updated successfully',
            user: updatedUser
        });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Change password
router.post('/change-password', [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 8 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const { currentPassword, newPassword } = req.body;

        // Get current password
        const user = await new Promise((resolve, reject) => {
            db.get('SELECT password FROM users WHERE id = ?', [req.user.userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Verify current password
        const bcrypt = require('bcryptjs');
        const validPassword = await bcrypt.compare(currentPassword, user.password);
        if (!validPassword) {
            return res.status(400).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        await new Promise((resolve, reject) => {
            db.run('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [hashedPassword, req.user.userId], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // Log security event
        await new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO security_events (user_id, event_type, description, severity, resolved)
                VALUES (?, 'password_changed', 'Password changed successfully', 'low', 1)
            `, [req.user.userId], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        res.json({
            success: true,
            message: 'Password changed successfully'
        });
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Update security settings
router.put('/security', async (req, res) => {
    try {
        const { twoFactorEnabled, biometricEnabled } = req.body;

        const updates = [];
        const values = [];

        if (twoFactorEnabled !== undefined) {
            updates.push('two_factor_enabled = ?');
            values.push(twoFactorEnabled ? 1 : 0);
        }
        if (biometricEnabled !== undefined) {
            updates.push('biometric_enabled = ?');
            values.push(biometricEnabled ? 1 : 0);
        }

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No settings to update'
            });
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        values.push(req.user.userId);

        await new Promise((resolve, reject) => {
            db.run(`
                UPDATE users 
                SET ${updates.join(', ')}
                WHERE id = ?
            `, values, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        res.json({
            success: true,
            message: 'Security settings updated successfully'
        });
    } catch (error) {
        console.error('Error updating security settings:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Get security events
router.get('/security-events', async (req, res) => {
    try {
        const { limit = 50 } = req.query;

        const events = await new Promise((resolve, reject) => {
            db.all(`
                SELECT * FROM security_events
                WHERE user_id = ?
                ORDER BY created_at DESC
                LIMIT ?
            `, [req.user.userId, parseInt(limit)], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        res.json({
            success: true,
            events
        });
    } catch (error) {
        console.error('Error fetching security events:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Get notifications
router.get('/notifications', async (req, res) => {
    try {
        const { unread_only } = req.query;

        let sql = 'SELECT * FROM notifications WHERE user_id = ?';
        const params = [req.user.userId];

        if (unread_only === 'true') {
            sql += ' AND is_read = 0';
        }

        sql += ' ORDER BY created_at DESC';

        const notifications = await new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        // Mark all as read
        await new Promise((resolve, reject) => {
            db.run('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user.userId], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        res.json({
            success: true,
            notifications
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Get dashboard summary
router.get('/dashboard', async (req, res) => {
    try {
        // Get accounts summary
        const accounts = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM accounts WHERE user_id = ? AND status = "active"', [req.user.userId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        // Get recent transactions
        const recentTransactions = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    t.*,
                    a.account_number,
                    a.color
                FROM transactions t
                JOIN accounts a ON t.account_id = a.id
                WHERE a.user_id = ?
                ORDER BY t.created_at DESC
                LIMIT 10
            `, [req.user.userId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        // Get pending transfers
        const pendingTransfers = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    t.*,
                    fa.account_number as from_account_number
                FROM transfers t
                JOIN accounts fa ON t.from_account_id = fa.id
                WHERE fa.user_id = ? AND t.status = 'pending'
                ORDER BY t.created_at DESC
            `, [req.user.userId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        // Get unread notifications count
        const unreadCount = await new Promise((resolve, reject) => {
            db.get('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0', [req.user.userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        // Get savings goals
        const savingsGoals = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM savings_goals WHERE user_id = ? AND status = "active"', [req.user.userId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);

        // Calculate total income (credit transactions)
        const totalIncome = recentTransactions
            .filter(tx => tx.transaction_type === 'credit')
            .reduce((sum, tx) => sum + tx.amount, 0);

        // Calculate total expenses (debit transactions)
        const totalExpenses = recentTransactions
            .filter(tx => tx.transaction_type === 'debit')
            .reduce((sum, tx) => sum + tx.amount, 0);

        res.json({
            success: true,
            dashboard: {
                totalBalance,
                totalIncome,
                totalExpenses,
                totalAccounts: accounts.length,
                recentTransactions,
                pendingTransfers,
                unreadNotifications: unreadCount.count,
                savingsGoals
            }
        });
    } catch (error) {
        console.error('Error fetching dashboard:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

module.exports = router;

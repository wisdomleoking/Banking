const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, checkUserStatus } = require('../middleware/auth');
const db = require('../config/database').getDB();

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken, checkUserStatus);

// Get all cards for user
router.get('/', async (req, res) => {
    try {
        const cards = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    c.id,
                    c.account_id,
                    c.card_number_encrypted,
                    SUBSTR(c.card_number_encrypted, -4) as last_four,
                    c.card_type,
                    c.card_brand,
                    c.expiry_date,
                    c.cardholder_name,
                    c.status,
                    c.is_frozen,
                    c.daily_limit,
                    c.online_enabled,
                    c.international_enabled,
                    c.atm_enabled,
                    c.virtual_card_available,
                    c.created_at,
                    a.account_number,
                    a.account_type
                FROM cards c
                JOIN accounts a ON c.account_id = a.id
                WHERE a.user_id = ?
                ORDER BY c.created_at DESC
            `, [req.user.userId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        res.json({
            success: true,
            cards
        });
    } catch (error) {
        console.error('Error fetching cards:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Get card details by ID
router.get('/:cardId', async (req, res) => {
    try {
        const card = await new Promise((resolve, reject) => {
            db.get(`
                SELECT 
                    c.*,
                    a.account_number,
                    a.account_type,
                    a.user_id
                FROM cards c
                JOIN accounts a ON c.account_id = a.id
                WHERE c.id = ? AND a.user_id = ?
            `, [req.params.cardId, req.user.userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!card) {
            return res.status(404).json({
                success: false,
                message: 'Card not found'
            });
        }

        res.json({
            success: true,
            card
        });
    } catch (error) {
        console.error('Error fetching card:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Update card settings
router.put('/:cardId/settings', async (req, res) => {
    try {
        const {
            dailyLimit,
            onlineEnabled,
            internationalEnabled,
            atmEnabled
        } = req.body;

        // Verify card ownership
        const card = await new Promise((resolve, reject) => {
            db.get(`
                SELECT c.id
                FROM cards c
                JOIN accounts a ON c.account_id = a.id
                WHERE c.id = ? AND a.user_id = ?
            `, [req.params.cardId, req.user.userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!card) {
            return res.status(404).json({
                success: false,
                message: 'Card not found'
            });
        }

        const updates = [];
        const values = [];

        if (dailyLimit !== undefined) {
            updates.push('daily_limit = ?');
            values.push(dailyLimit);
        }
        if (onlineEnabled !== undefined) {
            updates.push('online_enabled = ?');
            values.push(onlineEnabled ? 1 : 0);
        }
        if (internationalEnabled !== undefined) {
            updates.push('international_enabled = ?');
            values.push(internationalEnabled ? 1 : 0);
        }
        if (atmEnabled !== undefined) {
            updates.push('atm_enabled = ?');
            values.push(atmEnabled ? 1 : 0);
        }

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No settings to update'
            });
        }

        values.push(req.params.cardId);

        await new Promise((resolve, reject) => {
            db.run(`
                UPDATE cards 
                SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, values, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        res.json({
            success: true,
            message: 'Card settings updated successfully'
        });
    } catch (error) {
        console.error('Error updating card settings:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Freeze/unfreeze card
router.post('/:cardId/freeze', async (req, res) => {
    try {
        const { freeze } = req.body;

        // Verify card ownership
        const card = await new Promise((resolve, reject) => {
            db.get(`
                SELECT c.id, c.is_frozen
                FROM cards c
                JOIN accounts a ON c.account_id = a.id
                WHERE c.id = ? AND a.user_id = ?
            `, [req.params.cardId, req.user.userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!card) {
            return res.status(404).json({
                success: false,
                message: 'Card not found'
            });
        }

        await new Promise((resolve, reject) => {
            db.run(
                'UPDATE cards SET is_frozen = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [freeze ? 1 : 0, req.params.cardId],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        res.json({
            success: true,
            message: freeze ? 'Card frozen successfully' : 'Card unfrozen successfully'
        });
    } catch (error) {
        console.error('Error freezing card:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Report card lost/stolen
router.post('/:cardId/report', async (req, res) => {
    try {
        const { reason } = req.body;

        // Verify card ownership
        const card = await new Promise((resolve, reject) => {
            db.get(`
                SELECT c.id
                FROM cards c
                JOIN accounts a ON c.account_id = a.id
                WHERE c.id = ? AND a.user_id = ?
            `, [req.params.cardId, req.user.userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!card) {
            return res.status(404).json({
                success: false,
                message: 'Card not found'
            });
        }

        // Log security event
        await new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO security_events (user_id, event_type, description, severity, resolved)
                VALUES (?, 'card_reported', ?, 'high', 0)
            `, [req.user.userId, `Card reported: ${reason}`], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // Mark card as inactive
        await new Promise((resolve, reject) => {
            db.run("UPDATE cards SET status = 'inactive', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [req.params.cardId], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        res.json({
            success: true,
            message: 'Card reported successfully. A new card will be issued.'
        });
    } catch (error) {
        console.error('Error reporting card:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Request virtual card
router.post('/virtual', async (req, res) => {
    try {
        const { accountId } = req.body;

        // Verify account ownership
        const account = await new Promise((resolve, reject) => {
            db.get('SELECT id FROM accounts WHERE id = ? AND user_id = ?', [accountId, req.user.userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!account) {
            return res.status(404).json({
                success: false,
                message: 'Account not found'
            });
        }

        // Generate virtual card number
        const cardNumber = '**** **** **** ' + Math.floor(1000 + Math.random() * 9000);
        const expiryDate = `12/${new Date().getFullYear() + 3}`;

        const result = await new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO cards (
                    account_id, card_number_encrypted, card_type, card_brand,
                    expiry_date, cardholder_name, status, is_frozen,
                    daily_limit, online_enabled, international_enabled,
                    atm_enabled, virtual_card_available
                ) VALUES (?, ?, 'Virtual', 'Visa', ?, 'VIRTUAL CARD', 'active', 0, 500.00, 1, 0, 0, 1)
            `, [accountId, cardNumber, expiryDate], function (err) {
                if (err) reject(err);
                else resolve({ id: this.lastID });
            });
        });

        const newCard = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM cards WHERE id = ?', [result.id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        res.status(201).json({
            success: true,
            message: 'Virtual card created successfully',
            card: newCard
        });
    } catch (error) {
        console.error('Error creating virtual card:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

module.exports = router;

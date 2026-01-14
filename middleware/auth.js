const jwt = require('jsonwebtoken');
const db = require('../config/database').getDB();

// Verify JWT token
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Access token is required'
        });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, decoded) => {
        if (err) {
            return res.status(403).json({
                success: false,
                message: 'Invalid or expired token'
            });
        }

        req.user = decoded;
        next();
    });
}

// Check if user exists and is active
async function checkUserStatus(req, res, next) {
    try {
        const user = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM users WHERE id = ? AND is_active = 1', [req.user.userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found or inactive'
            });
        }

        req.userDetails = user;
        next();
    } catch (error) {
        console.error('Error checking user status:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
}

// Verify account ownership
async function verifyAccountOwnership(req, res, next) {
    try {
        const accountId = req.params.accountId || req.body.accountId;

        if (!accountId) {
            return res.status(400).json({
                success: false,
                message: 'Account ID is required'
            });
        }

        const account = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM accounts WHERE id = ? AND user_id = ?', [accountId, req.user.userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!account) {
            return res.status(403).json({
                success: false,
                message: 'Account not found or access denied'
            });
        }

        req.account = account;
        next();
    } catch (error) {
        console.error('Error verifying account ownership:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
}

// Log login attempt
function logLoginAttempt(userId, success, method, ipAddress, userAgent, location, failureReason = null) {
    const sql = `
        INSERT INTO login_history (user_id, ip_address, user_agent, location, login_method, success, failure_reason)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    db.run(sql, [userId, ipAddress, userAgent, location, method, success, failureReason], (err) => {
        if (err) console.error('Error logging login attempt:', err);
    });
}

module.exports = {
    authenticateToken,
    checkUserStatus,
    verifyAccountOwnership,
    logLoginAttempt
};

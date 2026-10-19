
const jwt = require("jsonwebtoken");

function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;
    const token =
        authHeader && authHeader.startsWith("Bearer ")
            ? authHeader.slice(7)
            : null;

    if (!process.env.JWT_SECRET) {
        return res.status(500).json({
            message: "JWT_SECRET is not configured"
        });
    }

    if (!token) {
        return res.status(401).json({
            message: "Login required"
        });
    }

    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch {
        return res.status(401).json({
            message: "Invalid or expired token"
        });
    }
}

function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({
                message: "You do not have permission to perform this action"
            });
        }

        next();
    };
}

module.exports = {
    authenticateToken,
    requireRole
};

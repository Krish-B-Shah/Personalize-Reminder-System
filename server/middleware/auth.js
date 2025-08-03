const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');

// JWT Authentication Middleware
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ 
        error: 'Access denied. No token provided.' 
      });
    }

    // Try JWT first (custom auth)
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      return next();
    } catch (jwtError) {
      // If JWT fails, try Firebase token (for backward compatibility)
      try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        req.user = {
          uid: decodedToken.uid,
          email: decodedToken.email,
          role: decodedToken.role || 'student' // Default role
        };
        return next();
      } catch (firebaseError) {
        return res.status(403).json({ 
          error: 'Invalid token' 
        });
      }
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Server error during authentication' });
  }
};

// Role-Based Access Control Middleware
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required' 
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: `Access denied. Required roles: ${roles.join(', ')}. Your role: ${req.user.role}` 
      });
    }

    next();
  };
};

// Admin-only access
const requireAdmin = authorizeRoles('admin');

// Admin or Recruiter access
const requireAdminOrRecruiter = authorizeRoles('admin', 'recruiter');

// Any authenticated user
const requireAuth = authenticateToken;

module.exports = {
  authenticateToken,
  authorizeRoles,
  requireAdmin,
  requireAdminOrRecruiter,
  requireAuth
};

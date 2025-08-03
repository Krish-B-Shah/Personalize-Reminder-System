const { validationResult } = require('express-validator');

// Error handling middleware
const errorHandler = (error, req, res, next) => {
  console.error('Error:', error);

  // Validation errors
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      details: Object.values(error.errors).map(err => err.message)
    });
  }

  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid token'
    });
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token expired'
    });
  }

  // Firebase errors
  if (error.code && error.code.startsWith('auth/')) {
    return res.status(401).json({
      error: 'Authentication error',
      code: error.code
    });
  }

  // Default server error
  res.status(error.status || 500).json({
    error: error.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
};

// Validation result checker
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

module.exports = {
  errorHandler,
  handleValidationErrors
};

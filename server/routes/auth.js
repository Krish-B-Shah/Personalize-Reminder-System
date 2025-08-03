const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const admin = require('firebase-admin');
const { handleValidationErrors } = require('../middleware/errorHandler');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Validation rules
const registerValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('username').isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('role').optional().isIn(['student', 'recruiter', 'admin']).withMessage('Invalid role')
];

const loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').exists().withMessage('Password is required')
];

// Helper function to generate tokens
const generateTokens = (user) => {
  const accessToken = jwt.sign(
    { 
      uid: user.uid, 
      email: user.email, 
      role: user.role || 'student' 
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );

  const refreshToken = jwt.sign(
    { uid: user.uid },
    process.env.JWT_SECRET + '_refresh',
    { expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d' }
  );

  return { accessToken, refreshToken };
};

// Register with JWT
router.post('/register', registerValidation, handleValidationErrors, async (req, res) => {
  try {
    const { email, password, username, role = 'student' } = req.body;

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Check if Firebase is available
    const { isFirebaseAvailable } = require('../services/firebase');
    
    if (isFirebaseAvailable()) {
      // Create user in Firebase Auth (for compatibility)
      const userRecord = await admin.auth().createUser({
        email,
        password,
        displayName: username
      });

      // Set custom claims for RBAC
      await admin.auth().setCustomUserClaims(userRecord.uid, { role });

      // Create user profile in Firestore
      const db = admin.firestore();
      await db.collection('users').doc(userRecord.uid).set({
        username,
        email,
        role,
        hashedPassword, // Store for JWT auth
        displayName: username,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        authMethod: 'jwt_custom',
        profileComplete: false,
        skills: [],
        preferences: {
          emailNotifications: true,
          reminderFrequency: 'daily'
        }
      });

      // Generate JWT tokens
      const tokens = generateTokens({ uid: userRecord.uid, email, role });

      res.status(201).json({
        message: 'User registered successfully',
        user: {
          uid: userRecord.uid,
          email,
          username,
          role
        },
        tokens
      });
    } else {
      // Pure JWT mode (no Firebase)
      const uid = `jwt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // In a real app, you'd store this in your database
      // For demo purposes, we'll just generate tokens
      const tokens = generateTokens({ uid, email, role });

      res.status(201).json({
        message: 'User registered successfully (Demo Mode)',
        user: {
          uid,
          email,
          username,
          role
        },
        tokens
      });
    }

  } catch (error) {
    console.error('Registration error:', error);
    if (error.code === 'auth/email-already-exists') {
      return res.status(400).json({ error: 'Email already registered' });
    }
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login with JWT
router.post('/login', loginValidation, handleValidationErrors, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if Firebase is available
    const { isFirebaseAvailable } = require('../services/firebase');
    
    if (isFirebaseAvailable()) {
      // Get user from Firebase Auth
      const userRecord = await admin.auth().getUserByEmail(email);
      
      // Get user profile from Firestore
      const db = admin.firestore();
      const userDoc = await db.collection('users').doc(userRecord.uid).get();
      
      if (!userDoc.exists) {
        return res.status(404).json({ error: 'User profile not found' });
      }

      const userData = userDoc.data();

      // Verify password
      const isValidPassword = await bcrypt.compare(password, userData.hashedPassword);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Generate JWT tokens
      const tokens = generateTokens({
        uid: userRecord.uid,
        email: userRecord.email,
        role: userData.role
      });

      // Update last login
      await db.collection('users').doc(userRecord.uid).update({
        lastLogin: admin.firestore.FieldValue.serverTimestamp()
      });

      res.json({
        message: 'Login successful',
        user: {
          uid: userRecord.uid,
          email: userRecord.email,
          username: userData.username,
          role: userData.role
        },
        tokens
      });
    } else {
      // Pure JWT mode (demo mode without Firebase)
      // For demo purposes, we'll allow any email/password combo
      if (email && password && password.length >= 6) {
        const uid = `demo_${Date.now()}`;
        const role = 'student';
        
        const tokens = generateTokens({ uid, email, role });

        res.json({
          message: 'Login successful (Demo Mode)',
          user: {
            uid,
            email,
            username: email.split('@')[0],
            role
          },
          tokens
        });
      } else {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
    }

  } catch (error) {
    console.error('Login error:', error);
    if (error.code === 'auth/user-not-found') {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    res.status(500).json({ error: 'Login failed' });
  }
});

// Refresh token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET + '_refresh');
    
    // Get user data
    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(decoded.uid).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();

    // Generate new tokens
    const tokens = generateTokens({
      uid: decoded.uid,
      email: userData.email,
      role: userData.role
    });

    res.json({ tokens });

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// Get current user profile (protected route)
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(req.user.uid).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    const userData = userDoc.data();
    
    // Remove sensitive data
    delete userData.hashedPassword;
    
    res.json({
      user: {
        uid: req.user.uid,
        ...userData
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get user profile' });
  }
});

// Logout (blacklist token - simplified version)
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // In a production app, you'd add the token to a blacklist in Redis or database
    // For now, we'll just return success
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

module.exports = router;

const express = require('express');
const { body, param, query } = require('express-validator');
const admin = require('firebase-admin');
const { handleValidationErrors } = require('../middleware/errorHandler');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Validation rules
const updateProfileValidation = [
  body('username').optional().isLength({ min: 3 }),
  body('skills').optional().isArray(),
  body('preferences').optional().isObject()
];

const updateRoleValidation = [
  body('role').isIn(['student', 'recruiter', 'admin']),
  param('userId').isString().isLength({ min: 1 })
];

// Get all users (Admin only)
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, role, search } = req.query;
    const db = admin.firestore();
    
    let query = db.collection('users');
    
    // Filter by role
    if (role) {
      query = query.where('role', '==', role);
    }
    
    // Simple search by username or email
    if (search) {
      // Note: Firestore doesn't support full-text search, so this is a simplified version
      query = query.where('username', '>=', search)
                   .where('username', '<=', search + '\uf8ff');
    }
    
    // Pagination
    const offset = (page - 1) * limit;
    query = query.offset(offset).limit(parseInt(limit));
    
    const snapshot = await query.get();
    const users = [];
    
    snapshot.forEach(doc => {
      const userData = doc.data();
      delete userData.hashedPassword; // Remove sensitive data
      users.push({
        uid: doc.id,
        ...userData
      });
    });

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: snapshot.size
      }
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// Get user by ID
router.get('/:userId', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Users can only view their own profile unless they're admin
    if (req.user.uid !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();
    delete userData.hashedPassword; // Remove sensitive data
    
    res.json({
      user: {
        uid: userId,
        ...userData
      }
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Update user profile
router.put('/profile', requireAuth, updateProfileValidation, handleValidationErrors, async (req, res) => {
  try {
    const { username, skills, preferences, bio, phone, linkedin } = req.body;
    const db = admin.firestore();
    
    const updateData = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (username) updateData.username = username;
    if (skills) updateData.skills = skills;
    if (preferences) updateData.preferences = { ...preferences };
    if (bio) updateData.bio = bio;
    if (phone) updateData.phone = phone;
    if (linkedin) updateData.linkedin = linkedin;

    // Mark profile as complete if key fields are provided
    if (username && skills && skills.length > 0) {
      updateData.profileComplete = true;
    }

    await db.collection('users').doc(req.user.uid).update(updateData);

    res.json({ 
      message: 'Profile updated successfully',
      updated: updateData
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Update user role (Admin only)
router.put('/:userId/role', requireAdmin, updateRoleValidation, handleValidationErrors, async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    // Update Firebase Auth custom claims
    await admin.auth().setCustomUserClaims(userId, { role });

    // Update Firestore document
    const db = admin.firestore();
    await db.collection('users').doc(userId).update({
      role,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ 
      message: 'User role updated successfully',
      userId,
      newRole: role
    });

  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// Delete user (Admin only)
router.delete('/:userId', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    // Delete from Firebase Auth
    await admin.auth().deleteUser(userId);

    // Delete from Firestore
    const db = admin.firestore();
    await db.collection('users').doc(userId).delete();

    res.json({ 
      message: 'User deleted successfully',
      userId
    });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Get user statistics (Admin only)
router.get('/stats/overview', requireAdmin, async (req, res) => {
  try {
    const db = admin.firestore();
    
    // Get user counts by role
    const usersSnapshot = await db.collection('users').get();
    const stats = {
      total: 0,
      byRole: {
        student: 0,
        recruiter: 0,
        admin: 0
      },
      profileComplete: 0,
      recentSignups: 0 // Last 30 days
    };

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      stats.total++;
      
      if (userData.role) {
        stats.byRole[userData.role]++;
      }
      
      if (userData.profileComplete) {
        stats.profileComplete++;
      }
      
      if (userData.createdAt && userData.createdAt.toDate() > thirtyDaysAgo) {
        stats.recentSignups++;
      }
    });

    res.json({ stats });

  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to get user statistics' });
  }
});

module.exports = router;

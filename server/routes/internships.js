const express = require('express');
const { body, param, query } = require('express-validator');
const admin = require('firebase-admin');
const { handleValidationErrors } = require('../middleware/errorHandler');
const { requireAuth, requireAdminOrRecruiter } = require('../middleware/auth');

const router = express.Router();

// Validation rules
const createInternshipValidation = [
  body('title').isLength({ min: 5 }).withMessage('Title must be at least 5 characters'),
  body('company').isLength({ min: 2 }).withMessage('Company name required'),
  body('description').isLength({ min: 20 }).withMessage('Description must be at least 20 characters'),
  body('requirements').isArray().withMessage('Requirements must be an array'),
  body('location').isString().withMessage('Location required'),
  body('type').isIn(['remote', 'on-site', 'hybrid']).withMessage('Invalid type'),
  body('duration').isString().withMessage('Duration required'),
  body('stipend').optional().isNumeric(),
  body('applicationDeadline').isISO8601().withMessage('Valid deadline required'),
  body('tags').optional().isArray()
];

const updateInternshipValidation = [
  body('title').optional().isLength({ min: 5 }),
  body('company').optional().isLength({ min: 2 }),
  body('description').optional().isLength({ min: 20 }),
  body('requirements').optional().isArray(),
  body('location').optional().isString(),
  body('type').optional().isIn(['remote', 'on-site', 'hybrid']),
  body('status').optional().isIn(['active', 'closed', 'draft'])
];

// Get all internships with filtering and search
router.get('/', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      search, 
      company, 
      type, 
      location, 
      tags,
      sortBy = 'createdAt',
      order = 'desc'
    } = req.query;

    const db = admin.firestore();
    let query = db.collection('internships').where('status', '==', 'active');

    // Apply filters
    if (company) {
      query = query.where('company', '==', company);
    }
    
    if (type) {
      query = query.where('type', '==', type);
    }

    if (location && location !== 'all') {
      query = query.where('location', '==', location);
    }

    // Tags filter (array-contains)
    if (tags) {
      const tagArray = tags.split(',');
      if (tagArray.length > 0) {
        query = query.where('tags', 'array-contains-any', tagArray);
      }
    }

    // Sorting
    query = query.orderBy(sortBy, order);

    // Pagination
    const offset = (page - 1) * limit;
    query = query.offset(offset).limit(parseInt(limit));

    const snapshot = await query.get();
    const internships = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      internships.push({
        id: doc.id,
        ...data,
        applicationDeadline: data.applicationDeadline?.toDate?.() || data.applicationDeadline,
        createdAt: data.createdAt?.toDate?.() || data.createdAt
      });
    });

    // Simple text search on client side if search term provided
    let filteredInternships = internships;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredInternships = internships.filter(internship => 
        internship.title.toLowerCase().includes(searchLower) ||
        internship.company.toLowerCase().includes(searchLower) ||
        internship.description.toLowerCase().includes(searchLower) ||
        internship.requirements.some(req => req.toLowerCase().includes(searchLower))
      );
    }

    res.json({
      internships: filteredInternships,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: filteredInternships.length
      }
    });

  } catch (error) {
    console.error('Get internships error:', error);
    res.status(500).json({ error: 'Failed to get internships' });
  }
});

// Get internship by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = admin.firestore();
    
    const doc = await db.collection('internships').doc(id).get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Internship not found' });
    }

    const data = doc.data();
    res.json({
      internship: {
        id: doc.id,
        ...data,
        applicationDeadline: data.applicationDeadline?.toDate?.() || data.applicationDeadline,
        createdAt: data.createdAt?.toDate?.() || data.createdAt
      }
    });

  } catch (error) {
    console.error('Get internship error:', error);
    res.status(500).json({ error: 'Failed to get internship' });
  }
});

// Create new internship (Recruiters and Admins only)
router.post('/', requireAdminOrRecruiter, createInternshipValidation, handleValidationErrors, async (req, res) => {
  try {
    const {
      title,
      company,
      description,
      requirements,
      location,
      type,
      duration,
      stipend,
      applicationDeadline,
      tags = []
    } = req.body;

    const db = admin.firestore();
    
    const internshipData = {
      title,
      company,
      description,
      requirements,
      location,
      type,
      duration,
      stipend: stipend || null,
      applicationDeadline: new Date(applicationDeadline),
      tags,
      status: 'active',
      createdBy: req.user.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      applicationsCount: 0,
      viewsCount: 0
    };

    const docRef = await db.collection('internships').add(internshipData);

    res.status(201).json({
      message: 'Internship created successfully',
      internship: {
        id: docRef.id,
        ...internshipData
      }
    });

  } catch (error) {
    console.error('Create internship error:', error);
    res.status(500).json({ error: 'Failed to create internship' });
  }
});

// Update internship
router.put('/:id', requireAdminOrRecruiter, updateInternshipValidation, handleValidationErrors, async (req, res) => {
  try {
    const { id } = req.params;
    const db = admin.firestore();
    
    // Check if internship exists and user has permission
    const doc = await db.collection('internships').doc(id).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Internship not found' });
    }

    const existingData = doc.data();
    
    // Only creator or admin can update
    if (existingData.createdBy !== req.user.uid && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Permission denied' });
    }

    const updateData = {
      ...req.body,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // Convert applicationDeadline if provided
    if (updateData.applicationDeadline) {
      updateData.applicationDeadline = new Date(updateData.applicationDeadline);
    }

    await db.collection('internships').doc(id).update(updateData);

    res.json({
      message: 'Internship updated successfully',
      id,
      updated: updateData
    });

  } catch (error) {
    console.error('Update internship error:', error);
    res.status(500).json({ error: 'Failed to update internship' });
  }
});

// Delete internship
router.delete('/:id', requireAdminOrRecruiter, async (req, res) => {
  try {
    const { id } = req.params;
    const db = admin.firestore();
    
    // Check if internship exists and user has permission
    const doc = await db.collection('internships').doc(id).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Internship not found' });
    }

    const existingData = doc.data();
    
    // Only creator or admin can delete
    if (existingData.createdBy !== req.user.uid && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Permission denied' });
    }

    await db.collection('internships').doc(id).delete();

    res.json({
      message: 'Internship deleted successfully',
      id
    });

  } catch (error) {
    console.error('Delete internship error:', error);
    res.status(500).json({ error: 'Failed to delete internship' });
  }
});

// Apply to internship
router.post('/:id/apply', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { coverLetter, resume } = req.body;
    
    if (!coverLetter || !resume) {
      return res.status(400).json({ error: 'Cover letter and resume are required' });
    }

    const db = admin.firestore();
    
    // Check if internship exists and is active
    const internshipDoc = await db.collection('internships').doc(id).get();
    if (!internshipDoc.exists) {
      return res.status(404).json({ error: 'Internship not found' });
    }

    const internshipData = internshipDoc.data();
    if (internshipData.status !== 'active') {
      return res.status(400).json({ error: 'Internship is not active' });
    }

    // Check if user already applied
    const existingApplication = await db.collection('applications')
      .where('internshipId', '==', id)
      .where('userId', '==', req.user.uid)
      .get();

    if (!existingApplication.empty) {
      return res.status(400).json({ error: 'You have already applied to this internship' });
    }

    // Create application
    const applicationData = {
      internshipId: id,
      userId: req.user.uid,
      coverLetter,
      resume,
      status: 'pending',
      appliedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const applicationRef = await db.collection('applications').add(applicationData);

    // Update internship applications count
    await db.collection('internships').doc(id).update({
      applicationsCount: admin.firestore.FieldValue.increment(1)
    });

    res.status(201).json({
      message: 'Application submitted successfully',
      applicationId: applicationRef.id
    });

  } catch (error) {
    console.error('Apply to internship error:', error);
    res.status(500).json({ error: 'Failed to submit application' });
  }
});

// Get applications for an internship (Creator or Admin only)
router.get('/:id/applications', requireAdminOrRecruiter, async (req, res) => {
  try {
    const { id } = req.params;
    const db = admin.firestore();
    
    // Check if user has permission to view applications
    const internshipDoc = await db.collection('internships').doc(id).get();
    if (!internshipDoc.exists) {
      return res.status(404).json({ error: 'Internship not found' });
    }

    const internshipData = internshipDoc.data();
    if (internshipData.createdBy !== req.user.uid && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Permission denied' });
    }

    // Get applications
    const applicationsSnapshot = await db.collection('applications')
      .where('internshipId', '==', id)
      .orderBy('appliedAt', 'desc')
      .get();

    const applications = [];
    for (const doc of applicationsSnapshot.docs) {
      const appData = doc.data();
      
      // Get user profile
      const userDoc = await db.collection('users').doc(appData.userId).get();
      const userData = userDoc.exists ? userDoc.data() : {};
      
      applications.push({
        id: doc.id,
        ...appData,
        appliedAt: appData.appliedAt?.toDate?.() || appData.appliedAt,
        user: {
          uid: appData.userId,
          username: userData.username,
          email: userData.email,
          skills: userData.skills || []
        }
      });
    }

    res.json({ applications });

  } catch (error) {
    console.error('Get applications error:', error);
    res.status(500).json({ error: 'Failed to get applications' });
  }
});

module.exports = router;

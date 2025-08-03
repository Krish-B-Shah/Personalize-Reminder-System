const express = require('express');
const { body, param, query } = require('express-validator');
const admin = require('firebase-admin');
const { handleValidationErrors } = require('../middleware/errorHandler');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Validation rules
const createReminderValidation = [
  body('title').isLength({ min: 5 }).withMessage('Title must be at least 5 characters'),
  body('description').optional().isLength({ max: 500 }),
  body('reminderDate').isISO8601().withMessage('Valid reminder date required'),
  body('type').isIn(['application_deadline', 'interview', 'follow_up', 'custom']),
  body('priority').optional().isIn(['low', 'medium', 'high']),
  body('internshipId').optional().isString()
];

// Get user's reminders
router.get('/', requireAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, type, priority, upcoming } = req.query;
    const db = admin.firestore();
    
    let query = db.collection('reminders').where('userId', '==', req.user.uid);

    // Filter by type
    if (type) {
      query = query.where('type', '==', type);
    }

    // Filter by priority
    if (priority) {
      query = query.where('priority', '==', priority);
    }

    // Filter upcoming reminders (next 7 days)
    if (upcoming === 'true') {
      const now = new Date();
      const nextWeek = new Date();
      nextWeek.setDate(now.getDate() + 7);
      
      query = query.where('reminderDate', '>=', now)
                   .where('reminderDate', '<=', nextWeek);
    }

    // Sort by reminder date
    query = query.orderBy('reminderDate', 'asc');

    // Pagination
    const offset = (page - 1) * limit;
    query = query.offset(offset).limit(parseInt(limit));

    const snapshot = await query.get();
    const reminders = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const reminder = {
        id: doc.id,
        ...data,
        reminderDate: data.reminderDate?.toDate?.() || data.reminderDate,
        createdAt: data.createdAt?.toDate?.() || data.createdAt
      };

      // Add internship details if linked
      if (data.internshipId) {
        try {
          const internshipDoc = await db.collection('internships').doc(data.internshipId).get();
          if (internshipDoc.exists) {
            const internshipData = internshipDoc.data();
            reminder.internship = {
              id: data.internshipId,
              title: internshipData.title,
              company: internshipData.company
            };
          }
        } catch (error) {
          console.error('Error fetching internship for reminder:', error);
        }
      }

      reminders.push(reminder);
    }

    res.json({
      reminders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: snapshot.size
      }
    });

  } catch (error) {
    console.error('Get reminders error:', error);
    res.status(500).json({ error: 'Failed to get reminders' });
  }
});

// Create reminder
router.post('/', requireAuth, createReminderValidation, handleValidationErrors, async (req, res) => {
  try {
    const {
      title,
      description,
      reminderDate,
      type,
      priority = 'medium',
      internshipId,
      emailNotification = true
    } = req.body;

    const db = admin.firestore();
    
    const reminderData = {
      userId: req.user.uid,
      title,
      description: description || '',
      reminderDate: new Date(reminderDate),
      type,
      priority,
      internshipId: internshipId || null,
      emailNotification,
      status: 'pending',
      completed: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection('reminders').add(reminderData);

    // Schedule email notification if enabled
    if (emailNotification) {
      await scheduleReminderNotification(docRef.id, reminderData);
    }

    res.status(201).json({
      message: 'Reminder created successfully',
      reminder: {
        id: docRef.id,
        ...reminderData
      }
    });

  } catch (error) {
    console.error('Create reminder error:', error);
    res.status(500).json({ error: 'Failed to create reminder' });
  }
});

// Update reminder
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const db = admin.firestore();
    
    // Check if reminder exists and belongs to user
    const doc = await db.collection('reminders').doc(id).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Reminder not found' });
    }

    const existingData = doc.data();
    if (existingData.userId !== req.user.uid) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    const updateData = {
      ...req.body,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // Convert reminderDate if provided
    if (updateData.reminderDate) {
      updateData.reminderDate = new Date(updateData.reminderDate);
    }

    await db.collection('reminders').doc(id).update(updateData);

    res.json({
      message: 'Reminder updated successfully',
      id,
      updated: updateData
    });

  } catch (error) {
    console.error('Update reminder error:', error);
    res.status(500).json({ error: 'Failed to update reminder' });
  }
});

// Mark reminder as completed
router.patch('/:id/complete', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const db = admin.firestore();
    
    // Check if reminder exists and belongs to user
    const doc = await db.collection('reminders').doc(id).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Reminder not found' });
    }

    const existingData = doc.data();
    if (existingData.userId !== req.user.uid) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    await db.collection('reminders').doc(id).update({
      completed: true,
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'completed',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({
      message: 'Reminder marked as completed',
      id
    });

  } catch (error) {
    console.error('Complete reminder error:', error);
    res.status(500).json({ error: 'Failed to complete reminder' });
  }
});

// Delete reminder
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const db = admin.firestore();
    
    // Check if reminder exists and belongs to user
    const doc = await db.collection('reminders').doc(id).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Reminder not found' });
    }

    const existingData = doc.data();
    if (existingData.userId !== req.user.uid) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    await db.collection('reminders').doc(id).delete();

    res.json({
      message: 'Reminder deleted successfully',
      id
    });

  } catch (error) {
    console.error('Delete reminder error:', error);
    res.status(500).json({ error: 'Failed to delete reminder' });
  }
});

// Get reminder statistics
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const db = admin.firestore();
    
    const remindersSnapshot = await db.collection('reminders')
      .where('userId', '==', req.user.uid)
      .get();

    const stats = {
      total: 0,
      completed: 0,
      pending: 0,
      overdue: 0,
      byType: {
        application_deadline: 0,
        interview: 0,
        follow_up: 0,
        custom: 0
      },
      byPriority: {
        low: 0,
        medium: 0,
        high: 0
      }
    };

    const now = new Date();

    remindersSnapshot.forEach(doc => {
      const data = doc.data();
      stats.total++;

      // Status counts
      if (data.completed) {
        stats.completed++;
      } else {
        stats.pending++;
        
        // Check if overdue
        const reminderDate = data.reminderDate?.toDate?.() || new Date(data.reminderDate);
        if (reminderDate < now) {
          stats.overdue++;
        }
      }

      // Type counts
      if (data.type && stats.byType.hasOwnProperty(data.type)) {
        stats.byType[data.type]++;
      }

      // Priority counts
      if (data.priority && stats.byPriority.hasOwnProperty(data.priority)) {
        stats.byPriority[data.priority]++;
      }
    });

    res.json({ stats });

  } catch (error) {
    console.error('Get reminder stats error:', error);
    res.status(500).json({ error: 'Failed to get reminder statistics' });
  }
});

// Helper function to schedule reminder notification
async function scheduleReminderNotification(reminderId, reminderData) {
  try {
    const db = admin.firestore();
    
    // Create a scheduled notification record
    await db.collection('scheduled_notifications').add({
      type: 'reminder',
      reminderId,
      userId: reminderData.userId,
      scheduledFor: reminderData.reminderDate,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      metadata: {
        title: reminderData.title,
        description: reminderData.description,
        priority: reminderData.priority
      }
    });

  } catch (error) {
    console.error('Error scheduling notification:', error);
  }
}

module.exports = router;

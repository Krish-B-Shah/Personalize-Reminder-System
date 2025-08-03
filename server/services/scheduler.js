const cron = require('node-cron');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

let schedulerInitialized = false;

// Email transporter setup
const createEmailTransporter = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('⚠️ Email credentials not configured. Email notifications will be disabled.');
    return null;
  }

  return nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

const emailTransporter = createEmailTransporter();

// Initialize scheduler for reminder notifications
const initializeScheduler = () => {
  if (schedulerInitialized) {
    console.log('Scheduler already initialized');
    return;
  }

  // Run every 15 minutes to check for pending reminders
  cron.schedule('*/15 * * * *', async () => {
    await processReminderNotifications();
  });

  // Run daily at 9 AM to send daily digest
  cron.schedule('0 9 * * *', async () => {
    await sendDailyDigest();
  });

  // Run weekly on Monday at 8 AM for weekly summary
  cron.schedule('0 8 * * 1', async () => {
    await sendWeeklyDigest();
  });

  // Cleanup old logs every day at midnight
  cron.schedule('0 0 * * *', async () => {
    await cleanupOldLogs();
  });

  schedulerInitialized = true;
  console.log('✅ Scheduler initialized with reminder and digest jobs');
};

// Process pending reminder notifications
const processReminderNotifications = async () => {
  try {
    if (!emailTransporter) {
      return; // Skip if email not configured
    }

    const db = admin.firestore();
    const now = new Date();
    const fifteenMinutesFromNow = new Date(now.getTime() + 15 * 60 * 1000);

    console.log('🔍 Checking for pending reminder notifications...');

    // Get pending notifications that should be sent in the next 15 minutes
    const notificationsSnapshot = await db.collection('scheduled_notifications')
      .where('status', '==', 'pending')
      .where('scheduledFor', '<=', fifteenMinutesFromNow)
      .get();

    let processedCount = 0;

    for (const doc of notificationsSnapshot.docs) {
      const notificationData = doc.data();
      
      try {
        // Get user details
        const userDoc = await db.collection('users').doc(notificationData.userId).get();
        if (!userDoc.exists) {
          console.warn(`User ${notificationData.userId} not found for notification ${doc.id}`);
          continue;
        }

        const userData = userDoc.data();
        
        // Check if user has email notifications enabled
        if (!userData.preferences?.emailNotifications) {
          await doc.ref.update({ 
            status: 'skipped', 
            processedAt: admin.firestore.FieldValue.serverTimestamp(),
            reason: 'User has email notifications disabled'
          });
          continue;
        }

        // Send email notification
        const emailSent = await sendReminderEmail(userData, notificationData);
        
        if (emailSent) {
          // Mark as sent
          await doc.ref.update({ 
            status: 'sent', 
            sentAt: admin.firestore.FieldValue.serverTimestamp() 
          });
          
          // Log the activity
          await logActivity({
            type: 'email_notification',
            userId: notificationData.userId,
            description: `Reminder notification sent: ${notificationData.metadata.title}`,
            metadata: {
              notificationId: doc.id,
              reminderTitle: notificationData.metadata.title
            }
          });
          
          processedCount++;
        } else {
          // Mark as failed
          await doc.ref.update({ 
            status: 'failed', 
            processedAt: admin.firestore.FieldValue.serverTimestamp(),
            reason: 'Email sending failed'
          });
        }

      } catch (error) {
        console.error(`Error processing notification ${doc.id}:`, error);
        
        // Mark as failed
        await doc.ref.update({ 
          status: 'failed', 
          processedAt: admin.firestore.FieldValue.serverTimestamp(),
          error: error.message
        });
      }
    }

    if (processedCount > 0) {
      console.log(`📧 Processed ${processedCount} reminder notifications`);
    }

  } catch (error) {
    console.error('Error processing reminder notifications:', error);
  }
};

// Send reminder email
const sendReminderEmail = async (userData, notificationData) => {
  try {
    if (!emailTransporter) {
      return false;
    }

    const { title, description, priority } = notificationData.metadata;
    const priorityColors = {
      low: '#10B981',
      medium: '#F59E0B',
      high: '#EF4444'
    };

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: userData.email,
      subject: `🔔 Reminder: ${title}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">Personalized Reminder System</h1>
          </div>
          
          <div style="padding: 30px; background: #f9fafb;">
            <h2 style="color: #1f2937; margin-bottom: 20px;">Hi ${userData.username || userData.displayName}!</h2>
            
            <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 20px;">
              <div style="display: flex; align-items: center; margin-bottom: 15px;">
                <div style="width: 4px; height: 40px; background: ${priorityColors[priority] || '#6B7280'}; margin-right: 15px; border-radius: 2px;"></div>
                <div>
                  <h3 style="margin: 0; color: #1f2937;">${title}</h3>
                  <span style="background: ${priorityColors[priority] || '#6B7280'}; color: white; padding: 4px 8px; border-radius: 12px; font-size: 12px; text-transform: uppercase;">${priority} Priority</span>
                </div>
              </div>
              
              ${description ? `<p style="color: #6b7280; margin: 15px 0;">${description}</p>` : ''}
              
              <p style="color: #374151; margin: 15px 0;">
                <strong>Scheduled for:</strong> ${new Date(notificationData.scheduledFor.toDate()).toLocaleString()}
              </p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="http://localhost:3000/dashboard" style="background: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                View Dashboard
              </a>
            </div>
            
            <p style="color: #9ca3af; font-size: 14px; text-align: center;">
              You're receiving this because you have email notifications enabled. 
              <a href="http://localhost:3000/settings" style="color: #4f46e5;">Update preferences</a>
            </p>
          </div>
        </div>
      `
    };

    await emailTransporter.sendMail(mailOptions);
    return true;

  } catch (error) {
    console.error('Error sending reminder email:', error);
    return false;
  }
};

// Send daily digest
const sendDailyDigest = async () => {
  try {
    if (!emailTransporter) {
      return;
    }

    console.log('📅 Sending daily digest emails...');
    
    const db = admin.firestore();
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    // Get users who have email notifications enabled
    const usersSnapshot = await db.collection('users')
      .where('preferences.emailNotifications', '==', true)
      .where('preferences.dailyDigest', '==', true)
      .get();

    let sentCount = 0;

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      
      // Get user's upcoming reminders for tomorrow
      const remindersSnapshot = await db.collection('reminders')
        .where('userId', '==', userDoc.id)
        .where('completed', '==', false)
        .where('reminderDate', '>=', today)
        .where('reminderDate', '<', tomorrow)
        .orderBy('reminderDate', 'asc')
        .get();

      if (remindersSnapshot.empty) {
        continue; // No reminders for tomorrow
      }

      const reminders = [];
      remindersSnapshot.forEach(doc => {
        reminders.push({ id: doc.id, ...doc.data() });
      });

      const emailSent = await sendDailyDigestEmail(userData, reminders);
      if (emailSent) {
        sentCount++;
      }
    }

    console.log(`📧 Sent ${sentCount} daily digest emails`);

  } catch (error) {
    console.error('Error sending daily digest:', error);
  }
};

const sendDailyDigestEmail = async (userData, reminders) => {
  try {
    const remindersList = reminders.map(reminder => `
      <li style="margin-bottom: 10px; padding: 10px; background: #f3f4f6; border-radius: 4px;">
        <strong>${reminder.title}</strong>
        <br>
        <small style="color: #6b7280;">${new Date(reminder.reminderDate.toDate()).toLocaleTimeString()}</small>
      </li>
    `).join('');

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: userData.email,
      subject: `📅 Daily Digest: ${reminders.length} reminder${reminders.length > 1 ? 's' : ''} for tomorrow`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">Your Daily Digest</h1>
          </div>
          
          <div style="padding: 30px; background: #f9fafb;">
            <h2 style="color: #1f2937;">Good evening, ${userData.username || userData.displayName}!</h2>
            
            <p style="color: #374151;">You have ${reminders.length} reminder${reminders.length > 1 ? 's' : ''} scheduled for tomorrow:</p>
            
            <ul style="list-style: none; padding: 0;">
              ${remindersList}
            </ul>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="http://localhost:3000/dashboard" style="background: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
                View Dashboard
              </a>
            </div>
          </div>
        </div>
      `
    };

    await emailTransporter.sendMail(mailOptions);
    return true;

  } catch (error) {
    console.error('Error sending daily digest email:', error);
    return false;
  }
};

// Send weekly digest (placeholder)
const sendWeeklyDigest = async () => {
  try {
    console.log('📊 Processing weekly digest...');
    // Implementation for weekly stats and insights
  } catch (error) {
    console.error('Error sending weekly digest:', error);
  }
};

// Log activity
const logActivity = async (activityData) => {
  try {
    const db = admin.firestore();
    await db.collection('activity_logs').add({
      ...activityData,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error('Error logging activity:', error);
  }
};

// Cleanup old logs (keep last 30 days)
const cleanupOldLogs = async () => {
  try {
    console.log('🧹 Cleaning up old logs...');
    
    const db = admin.firestore();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Delete old activity logs
    const oldLogsSnapshot = await db.collection('activity_logs')
      .where('timestamp', '<', thirtyDaysAgo)
      .get();

    const batch = db.batch();
    oldLogsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    
    console.log(`🗑️ Cleaned up ${oldLogsSnapshot.size} old log entries`);

  } catch (error) {
    console.error('Error cleaning up logs:', error);
  }
};

module.exports = {
  initializeScheduler,
  processReminderNotifications,
  sendDailyDigest,
  logActivity
};

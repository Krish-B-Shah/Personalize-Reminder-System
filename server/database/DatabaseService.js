const { Pool } = require('pg');
const admin = require('firebase-admin');

class DatabaseService {
  constructor() {
    this.dbType = process.env.DB_TYPE || 'firestore';
    this.pgPool = null;
    
    if (this.dbType === 'postgresql') {
      this.initializePostgreSQL();
    }
  }

  initializePostgreSQL() {
    try {
      this.pgPool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'personalized_reminder_system',
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

      console.log('✅ PostgreSQL connection pool initialized');
    } catch (error) {
      console.error('❌ Error initializing PostgreSQL:', error);
      throw error;
    }
  }

  // Generic database operations that work with both Firestore and PostgreSQL
  async createUser(userData) {
    if (this.dbType === 'postgresql') {
      return this.createUserPG(userData);
    } else {
      return this.createUserFirestore(userData);
    }
  }

  async getUser(userId) {
    if (this.dbType === 'postgresql') {
      return this.getUserPG(userId);
    } else {
      return this.getUserFirestore(userId);
    }
  }

  async updateUser(userId, updateData) {
    if (this.dbType === 'postgresql') {
      return this.updateUserPG(userId, updateData);
    } else {
      return this.updateUserFirestore(userId, updateData);
    }
  }

  async createInternship(internshipData) {
    if (this.dbType === 'postgresql') {
      return this.createInternshipPG(internshipData);
    } else {
      return this.createInternshipFirestore(internshipData);
    }
  }

  async getInternships(filters = {}) {
    if (this.dbType === 'postgresql') {
      return this.getInternshipsPG(filters);
    } else {
      return this.getInternshipsFirestore(filters);
    }
  }

  // PostgreSQL implementations
  async createUserPG(userData) {
    const query = `
      INSERT INTO users (uid, email, username, role, hashed_password, display_name, created_at, profile_complete, skills, preferences)
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $8, $9)
      RETURNING *
    `;
    
    const values = [
      userData.uid,
      userData.email,
      userData.username,
      userData.role || 'student',
      userData.hashedPassword,
      userData.displayName || userData.username,
      userData.profileComplete || false,
      JSON.stringify(userData.skills || []),
      JSON.stringify(userData.preferences || {})
    ];

    const result = await this.pgPool.query(query, values);
    return result.rows[0];
  }

  async getUserPG(userId) {
    const query = 'SELECT * FROM users WHERE uid = $1';
    const result = await this.pgPool.query(query, [userId]);
    
    if (result.rows.length === 0) {
      return null;
    }

    const user = result.rows[0];
    // Parse JSON fields
    user.skills = JSON.parse(user.skills || '[]');
    user.preferences = JSON.parse(user.preferences || '{}');
    
    return user;
  }

  async updateUserPG(userId, updateData) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updateData).forEach(key => {
      if (key === 'skills' || key === 'preferences') {
        fields.push(`${key} = $${paramCount}`);
        values.push(JSON.stringify(updateData[key]));
      } else if (key !== 'uid') {
        fields.push(`${key} = $${paramCount}`);
        values.push(updateData[key]);
      }
      paramCount++;
    });

    fields.push(`updated_at = NOW()`);
    values.push(userId);

    const query = `
      UPDATE users 
      SET ${fields.join(', ')}
      WHERE uid = $${paramCount}
      RETURNING *
    `;

    const result = await this.pgPool.query(query, values);
    return result.rows[0];
  }

  async createInternshipPG(internshipData) {
    const query = `
      INSERT INTO internships (
        title, company, description, requirements, location, type, duration, 
        stipend, application_deadline, tags, status, created_by, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
      RETURNING *
    `;

    const values = [
      internshipData.title,
      internshipData.company,
      internshipData.description,
      JSON.stringify(internshipData.requirements || []),
      internshipData.location,
      internshipData.type,
      internshipData.duration,
      internshipData.stipend,
      internshipData.applicationDeadline,
      JSON.stringify(internshipData.tags || []),
      internshipData.status || 'active',
      internshipData.createdBy
    ];

    const result = await this.pgPool.query(query, values);
    const internship = result.rows[0];
    
    // Parse JSON fields
    internship.requirements = JSON.parse(internship.requirements || '[]');
    internship.tags = JSON.parse(internship.tags || '[]');
    
    return internship;
  }

  async getInternshipsPG(filters = {}) {
    let query = 'SELECT * FROM internships WHERE 1=1';
    const values = [];
    let paramCount = 1;

    // Apply filters
    if (filters.status) {
      query += ` AND status = $${paramCount}`;
      values.push(filters.status);
      paramCount++;
    }

    if (filters.company) {
      query += ` AND company ILIKE $${paramCount}`;
      values.push(`%${filters.company}%`);
      paramCount++;
    }

    if (filters.type) {
      query += ` AND type = $${paramCount}`;
      values.push(filters.type);
      paramCount++;
    }

    if (filters.search) {
      query += ` AND (title ILIKE $${paramCount} OR description ILIKE $${paramCount} OR company ILIKE $${paramCount})`;
      values.push(`%${filters.search}%`);
      paramCount++;
    }

    // Pagination
    const limit = filters.limit || 20;
    const offset = filters.offset || 0;
    
    query += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    values.push(limit, offset);

    const result = await this.pgPool.query(query, values);
    
    // Parse JSON fields for each internship
    const internships = result.rows.map(internship => ({
      ...internship,
      requirements: JSON.parse(internship.requirements || '[]'),
      tags: JSON.parse(internship.tags || '[]')
    }));

    return internships;
  }

  // Firestore implementations (fallback)
  async createUserFirestore(userData) {
    const db = admin.firestore();
    await db.collection('users').doc(userData.uid).set({
      ...userData,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return userData;
  }

  async getUserFirestore(userId) {
    const db = admin.firestore();
    const doc = await db.collection('users').doc(userId).get();
    
    if (!doc.exists) {
      return null;
    }

    return { uid: userId, ...doc.data() };
  }

  async updateUserFirestore(userId, updateData) {
    const db = admin.firestore();
    await db.collection('users').doc(userId).update({
      ...updateData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return updateData;
  }

  async createInternshipFirestore(internshipData) {
    const db = admin.firestore();
    const docRef = await db.collection('internships').add({
      ...internshipData,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { id: docRef.id, ...internshipData };
  }

  async getInternshipsFirestore(filters = {}) {
    const db = admin.firestore();
    let query = db.collection('internships');

    if (filters.status) {
      query = query.where('status', '==', filters.status);
    }

    if (filters.company) {
      query = query.where('company', '==', filters.company);
    }

    if (filters.type) {
      query = query.where('type', '==', filters.type);
    }

    const limit = filters.limit || 20;
    const offset = filters.offset || 0;

    query = query.orderBy('createdAt', 'desc').offset(offset).limit(limit);

    const snapshot = await query.get();
    const internships = [];

    snapshot.forEach(doc => {
      internships.push({ id: doc.id, ...doc.data() });
    });

    return internships;
  }

  // Migration utilities
  async migrateFromFirestoreToPostgreSQL() {
    if (this.dbType !== 'postgresql') {
      throw new Error('Migration only available when using PostgreSQL');
    }

    console.log('🔄 Starting migration from Firestore to PostgreSQL...');

    try {
      // Migrate users
      await this.migrateUsers();
      
      // Migrate internships
      await this.migrateInternships();
      
      // Migrate applications
      await this.migrateApplications();
      
      // Migrate reminders
      await this.migrateReminders();

      console.log('✅ Migration completed successfully');

    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }

  async migrateUsers() {
    const db = admin.firestore();
    const usersSnapshot = await db.collection('users').get();

    console.log(`📊 Migrating ${usersSnapshot.size} users...`);

    for (const doc of usersSnapshot.docs) {
      const userData = doc.data();
      try {
        await this.createUserPG({
          uid: doc.id,
          ...userData
        });
      } catch (error) {
        console.error(`Error migrating user ${doc.id}:`, error);
      }
    }

    console.log('✅ Users migration completed');
  }

  async migrateInternships() {
    const db = admin.firestore();
    const internshipsSnapshot = await db.collection('internships').get();

    console.log(`📊 Migrating ${internshipsSnapshot.size} internships...`);

    for (const doc of internshipsSnapshot.docs) {
      const internshipData = doc.data();
      try {
        await this.createInternshipPG({
          id: doc.id,
          ...internshipData
        });
      } catch (error) {
        console.error(`Error migrating internship ${doc.id}:`, error);
      }
    }

    console.log('✅ Internships migration completed');
  }

  async migrateApplications() {
    // Implementation for applications migration
    console.log('✅ Applications migration completed (placeholder)');
  }

  async migrateReminders() {
    // Implementation for reminders migration
    console.log('✅ Reminders migration completed (placeholder)');
  }

  // Database cleanup
  async close() {
    if (this.pgPool) {
      await this.pgPool.end();
      console.log('PostgreSQL connection pool closed');
    }
  }
}

module.exports = { DatabaseService };

const { DatabaseService } = require('./DatabaseService');
const fs = require('fs').promises;
const path = require('path');

class MigrationService {
  constructor() {
    this.dbService = new DatabaseService();
  }

  // Run migration from Firestore to PostgreSQL
  async runMigration() {
    try {
      console.log('🚀 Starting database migration process...');
      
      // Check if PostgreSQL is configured
      if (this.dbService.dbType !== 'postgresql') {
        throw new Error('PostgreSQL must be configured to run migration');
      }

      // Create tables if they don't exist
      await this.createTables();
      
      // Migrate data
      await this.dbService.migrateFromFirestoreToPostgreSQL();
      
      console.log('✅ Database migration completed successfully');
      
      // Generate migration report
      await this.generateMigrationReport();

    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }

  // Create PostgreSQL tables
  async createTables() {
    try {
      console.log('📊 Creating PostgreSQL tables...');
      
      const schemaPath = path.join(__dirname, 'schema.sql');
      const schema = await fs.readFile(schemaPath, 'utf8');
      
      // Split schema into individual statements
      const statements = schema
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0);

      // Execute each statement
      for (const statement of statements) {
        try {
          await this.dbService.pgPool.query(statement);
        } catch (error) {
          // Ignore errors for statements that might already exist
          if (!error.message.includes('already exists')) {
            console.warn('Warning executing statement:', error.message);
          }
        }
      }

      console.log('✅ PostgreSQL tables created successfully');

    } catch (error) {
      console.error('❌ Error creating tables:', error);
      throw error;
    }
  }

  // Generate migration report
  async generateMigrationReport() {
    try {
      console.log('📈 Generating migration report...');

      const report = {
        timestamp: new Date().toISOString(),
        source: 'Firestore',
        destination: 'PostgreSQL',
        tables: {}
      };

      // Count records in each table
      const tables = ['users', 'internships', 'applications', 'reminders'];
      
      for (const table of tables) {
        try {
          const result = await this.dbService.pgPool.query(`SELECT COUNT(*) FROM ${table}`);
          report.tables[table] = parseInt(result.rows[0].count);
        } catch (error) {
          report.tables[table] = 'Error: ' + error.message;
        }
      }

      // Write report to file
      const reportPath = path.join(__dirname, 'migration-report.json');
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

      console.log('📋 Migration report generated:', reportPath);
      console.log('📊 Migration Summary:');
      console.table(report.tables);

    } catch (error) {
      console.error('❌ Error generating migration report:', error);
    }
  }

  // Validate data integrity after migration
  async validateMigration() {
    try {
      console.log('🔍 Validating migration data integrity...');

      const issues = [];

      // Check for orphaned records
      const orphanedApplications = await this.dbService.pgPool.query(`
        SELECT COUNT(*) FROM applications a 
        LEFT JOIN users u ON a.user_id = u.uid 
        LEFT JOIN internships i ON a.internship_id = i.id 
        WHERE u.uid IS NULL OR i.id IS NULL
      `);

      if (parseInt(orphanedApplications.rows[0].count) > 0) {
        issues.push(`Found ${orphanedApplications.rows[0].count} orphaned applications`);
      }

      // Check for orphaned reminders
      const orphanedReminders = await this.dbService.pgPool.query(`
        SELECT COUNT(*) FROM reminders r 
        LEFT JOIN users u ON r.user_id = u.uid 
        WHERE u.uid IS NULL
      `);

      if (parseInt(orphanedReminders.rows[0].count) > 0) {
        issues.push(`Found ${orphanedReminders.rows[0].count} orphaned reminders`);
      }

      // Check for invalid JSON data
      const invalidUserSkills = await this.dbService.pgPool.query(`
        SELECT COUNT(*) FROM users 
        WHERE skills IS NULL OR NOT jsonb_typeof(skills) = 'array'
      `);

      if (parseInt(invalidUserSkills.rows[0].count) > 0) {
        issues.push(`Found ${invalidUserSkills.rows[0].count} users with invalid skills data`);
      }

      if (issues.length === 0) {
        console.log('✅ Migration validation passed - no issues found');
      } else {
        console.log('⚠️  Migration validation found issues:');
        issues.forEach(issue => console.log(`  - ${issue}`));
      }

      return issues;

    } catch (error) {
      console.error('❌ Error validating migration:', error);
      throw error;
    }
  }

  // Rollback migration (switch back to Firestore)
  async rollbackMigration() {
    try {
      console.log('🔄 Rolling back to Firestore...');
      
      // Update environment variable
      process.env.DB_TYPE = 'firestore';
      
      // Reinitialize database service
      this.dbService = new DatabaseService();
      
      console.log('✅ Rollback completed - now using Firestore');

    } catch (error) {
      console.error('❌ Rollback failed:', error);
      throw error;
    }
  }

  // Export data to CSV for backup
  async exportToCSV() {
    try {
      console.log('📤 Exporting data to CSV...');

      const tables = ['users', 'internships', 'applications', 'reminders'];
      const exportDir = path.join(__dirname, 'exports');
      
      // Create exports directory
      try {
        await fs.mkdir(exportDir, { recursive: true });
      } catch (error) {
        // Directory might already exist
      }

      for (const table of tables) {
        try {
          const result = await this.dbService.pgPool.query(`SELECT * FROM ${table}`);
          
          if (result.rows.length === 0) {
            console.log(`⚠️  No data to export for table: ${table}`);
            continue;
          }

          // Convert to CSV
          const headers = Object.keys(result.rows[0]);
          const csvRows = [headers.join(',')];
          
          result.rows.forEach(row => {
            const values = headers.map(header => {
              const value = row[header];
              // Handle JSON fields and escape commas
              if (typeof value === 'object' && value !== null) {
                return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
              }
              return `"${String(value || '').replace(/"/g, '""')}"`;
            });
            csvRows.push(values.join(','));
          });

          const csvContent = csvRows.join('\n');
          const csvPath = path.join(exportDir, `${table}_${new Date().toISOString().split('T')[0]}.csv`);
          
          await fs.writeFile(csvPath, csvContent);
          console.log(`✅ Exported ${result.rows.length} records from ${table} to ${csvPath}`);

        } catch (error) {
          console.error(`❌ Error exporting ${table}:`, error);
        }
      }

      console.log('📤 CSV export completed');

    } catch (error) {
      console.error('❌ CSV export failed:', error);
      throw error;
    }
  }

  // Clean up resources
  async close() {
    if (this.dbService) {
      await this.dbService.close();
    }
  }
}

module.exports = { MigrationService };

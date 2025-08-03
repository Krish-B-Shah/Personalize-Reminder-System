const { MigrationService } = require('./database/MigrationService');
const { DatabaseService } = require('./database/DatabaseService');

// Command line utility for database operations
const args = process.argv.slice(2);
const command = args[0];

async function main() {
  let migrationService, dbService;

  try {
    switch (command) {
      case 'migrate':
        console.log('🚀 Starting migration from Firestore to PostgreSQL...');
        migrationService = new MigrationService();
        await migrationService.runMigration();
        break;

      case 'validate':
        console.log('🔍 Validating migration...');
        migrationService = new MigrationService();
        await migrationService.validateMigration();
        break;

      case 'rollback':
        console.log('🔄 Rolling back to Firestore...');
        migrationService = new MigrationService();
        await migrationService.rollbackMigration();
        break;

      case 'export':
        console.log('📤 Exporting data to CSV...');
        migrationService = new MigrationService();
        await migrationService.exportToCSV();
        break;

      case 'test-connection':
        console.log('🔌 Testing database connection...');
        dbService = new DatabaseService();
        
        if (dbService.dbType === 'postgresql') {
          const result = await dbService.pgPool.query('SELECT NOW() as current_time');
          console.log('✅ PostgreSQL connection successful:', result.rows[0].current_time);
        } else {
          console.log('✅ Using Firestore (no connection test needed)');
        }
        break;

      case 'setup-pg':
        console.log('🛠️  Setting up PostgreSQL database...');
        migrationService = new MigrationService();
        await migrationService.createTables();
        break;

      default:
        console.log(`
🗄️  Database Management Utility

Usage: node dbUtil.js <command>

Commands:
  migrate          - Migrate data from Firestore to PostgreSQL
  validate         - Validate migration data integrity
  rollback         - Switch back to using Firestore
  export           - Export data to CSV files
  test-connection  - Test database connection
  setup-pg         - Create PostgreSQL tables only

Environment Variables Required:
  - DB_TYPE=postgresql (for PostgreSQL operations)
  - DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD (for PostgreSQL)

Examples:
  node dbUtil.js migrate
  node dbUtil.js validate
  node dbUtil.js export
        `);
        break;
    }

  } catch (error) {
    console.error('❌ Operation failed:', error);
    process.exit(1);
  } finally {
    // Clean up connections
    if (migrationService) {
      await migrationService.close();
    }
    if (dbService) {
      await dbService.close();
    }
    process.exit(0);
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\n🛑 Process interrupted, cleaning up...');
  process.exit(0);
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled promise rejection:', error);
  process.exit(1);
});

main();

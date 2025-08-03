# Enhanced Personalized Reminder System - Backend

This is a professional-grade Express.js backend with advanced features including JWT authentication, RBAC, ML-powered recommendations, scheduled notifications, and dual database support (Firestore + PostgreSQL).

## 🚀 Features Implemented

### 1. **Real Auth Security Layer with JWT + RBAC**
- Custom JWT-based authentication (not just Firebase Auth)
- Role-Based Access Control (admin, recruiter, student)
- Password hashing with bcrypt
- Token refresh mechanism
- Backward compatibility with Firebase Auth

### 2. **Express REST API Gateway**
- Complete REST API for all resources
- Input validation with express-validator
- Comprehensive error handling
- Rate limiting and security middleware (helmet)
- Structured route organization

### 3. **Advanced Scheduler & Queue System**
- Automated email reminder notifications
- Daily and weekly digest emails
- Cron-based job scheduling with node-cron
- Activity logging system
- Email templates with HTML formatting

### 4. **ML-Powered Internship Matcher**
- Cosine similarity-based skill matching
- Multi-factor scoring algorithm (skills, location, work type, interests)
- Personalized recommendations API
- Skill gap analysis and suggestions
- Collaborative filtering foundation

### 5. **Dual Database Support (Firestore + PostgreSQL)**
- Abstracted database service layer
- Complete PostgreSQL schema with indexes
- Data migration utilities from Firestore to SQL
- CSV export functionality
- Data integrity validation

## 🛠️ Installation & Setup

### Prerequisites
```bash
# Install dependencies
npm install

# Required environment variables (create .env file)
cp .env.example .env
```

### Environment Configuration
```env
# Server Configuration
PORT=5000
NODE_ENV=development

# JWT Configuration
JWT_SECRET=your-super-secure-jwt-secret-key
JWT_EXPIRE=7d
JWT_REFRESH_EXPIRE=30d

# Database Configuration
DB_TYPE=firestore  # or 'postgresql'

# For PostgreSQL (optional)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=personalized_reminder_system
DB_USER=your_db_user
DB_PASSWORD=your_db_password

# Firebase Admin SDK
GOOGLE_APPLICATION_CREDENTIALS=./firebase-admin-key.json

# Email Configuration
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Running the Server
```bash
# Development mode with auto-restart
npm run dev

# Production mode
npm start

# Test database connection
node dbUtil.js test-connection
```

## 📊 Database Management

### PostgreSQL Setup (Optional)
```bash
# 1. Install PostgreSQL locally or use cloud service

# 2. Create database
createdb personalized_reminder_system

# 3. Setup tables
node dbUtil.js setup-pg

# 4. Migrate from Firestore (optional)
node dbUtil.js migrate

# 5. Validate migration
node dbUtil.js validate
```

### Database Utilities
```bash
# Export data to CSV
node dbUtil.js export

# Switch back to Firestore
node dbUtil.js rollback

# Test connection
node dbUtil.js test-connection
```

## 🔒 API Endpoints

### Authentication
- `POST /api/auth/register` - Register with JWT
- `POST /api/auth/login` - Login with JWT
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/profile` - Get current user profile
- `POST /api/auth/logout` - Logout

### Users (Protected)
- `GET /api/users` - Get all users (Admin only)
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/profile` - Update own profile
- `PUT /api/users/:id/role` - Update user role (Admin only)
- `DELETE /api/users/:id` - Delete user (Admin only)
- `GET /api/users/stats/overview` - User statistics (Admin only)

### Internships
- `GET /api/internships` - Get internships (with filters)
- `GET /api/internships/:id` - Get internship by ID
- `POST /api/internships` - Create internship (Recruiter/Admin)
- `PUT /api/internships/:id` - Update internship
- `DELETE /api/internships/:id` - Delete internship
- `POST /api/internships/:id/apply` - Apply to internship
- `GET /api/internships/:id/applications` - Get applications (Creator/Admin)

### Reminders (Protected)
- `GET /api/reminders` - Get user's reminders
- `POST /api/reminders` - Create reminder
- `PUT /api/reminders/:id` - Update reminder
- `PATCH /api/reminders/:id/complete` - Mark as completed
- `DELETE /api/reminders/:id` - Delete reminder
- `GET /api/reminders/stats` - Reminder statistics

### ML Recommendations (Protected)
- `GET /api/ml/recommendations` - Get personalized recommendations
- `GET /api/ml/match/:internshipId` - Get match score for internship
- `POST /api/ml/bulk-match` - Bulk match analysis
- `PUT /api/ml/profile/skills` - Update skills for better matching
- `GET /api/ml/insights` - Get matching insights and analytics

### Health & Monitoring
- `GET /api/health` - Health check
- `GET /api/hello` - Basic endpoint test

## 🤖 ML Recommendation Algorithm

### Scoring Factors
1. **Skills Match (40% weight)**
   - Direct skill matches
   - Partial matches (e.g., "React.js" ↔ "React")
   - Related skills (e.g., "JavaScript" → "React")

2. **Location Preference (20% weight)**
   - Remote vs on-site vs hybrid preference
   - Geographic location matching

3. **Work Type Preference (15% weight)**
   - Remote, hybrid, or on-site preference

4. **Interest Alignment (15% weight)**
   - User interests vs internship tags/description

5. **Company Preference (10% weight)**
   - Industry preference
   - Company size preference

### Features
- Personalized recommendations based on user profile
- Skill gap analysis with learning suggestions
- Match explanations and reasons
- Bulk matching for multiple internships
- Continuous learning from user applications

## 📧 Automated Notification System

### Email Features
- Reminder notifications (15-minute intervals)
- Daily digest emails (9 AM daily)
- Weekly summary emails (Monday 8 AM)
- Professional HTML email templates
- User preference controls

### Scheduling
- Cron-based job scheduling
- Automatic retry mechanism
- Email delivery status tracking
- Activity logging for all notifications

## 🔐 Security Features

### Authentication & Authorization
- JWT with RS256 signing
- Password hashing with bcrypt (12 rounds)
- Role-based access control
- Token refresh mechanism
- Session management

### Security Middleware
- Helmet.js for security headers
- Rate limiting (100 requests/15 minutes)
- CORS configuration
- Input validation and sanitization
- SQL injection prevention

## 📈 Performance Optimizations

### Database
- Proper indexing strategy
- Connection pooling
- Query optimization
- JSON field handling for flexible data

### Caching & Performance
- Database connection reuse
- Efficient batch operations
- Pagination for large datasets
- Background job processing

## 🧪 Testing & Development

### Development Tools
```bash
# Run with nodemon for auto-restart
npm run dev

# Database utilities
node dbUtil.js <command>

# Environment checks
npm run test  # (to be implemented)
```

### API Testing
Use Postman, Insomnia, or curl to test endpoints:

```bash
# Register user
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","username":"testuser"}'

# Get recommendations
curl -X GET http://localhost:5000/api/ml/recommendations \
  -H "Authorization: Bearer <your-jwt-token>"
```

## 🚀 Deployment

### Environment Setup
1. Set `NODE_ENV=production`
2. Configure production database
3. Set up proper JWT secrets
4. Configure email service
5. Set up SSL certificates

### Database Migration for Production
1. Set up PostgreSQL instance
2. Run `node dbUtil.js setup-pg`
3. Migrate data: `node dbUtil.js migrate`
4. Validate: `node dbUtil.js validate`

## 📚 API Documentation

For detailed API documentation with request/response examples, see the `/docs` folder or use tools like Swagger/OpenAPI (to be implemented).

## 🤝 Contributing

1. Follow the existing code structure
2. Add proper error handling
3. Include input validation
4. Update documentation
5. Test with both Firestore and PostgreSQL

## 📝 License

This project is for educational/portfolio purposes. Please ensure you have proper licenses for production use.

---

## 🎯 Why This Impresses Recruiters

### For Capital One & FinTech
- **JWT Authentication**: Shows understanding of secure token-based auth
- **RBAC Implementation**: Demonstrates enterprise security concepts
- **SQL Database**: Shows ability to work with relational databases
- **API Design**: REST best practices and proper error handling

### For Tech Companies
- **ML Algorithm**: Custom recommendation engine with similarity calculations
- **Microservices Architecture**: Modular, scalable backend design
- **Automation**: Scheduled jobs and email notifications
- **Database Abstraction**: Shows architectural thinking and flexibility

### For Quant Dev Roles
- **Mathematical Models**: Cosine similarity, weighted scoring algorithms
- **Data Analysis**: User behavior analysis and insights
- **Performance Optimization**: Efficient algorithms and database queries
- **System Design**: Scalable, maintainable codebase structure

This backend demonstrates production-ready skills that go far beyond typical student projects!

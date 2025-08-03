const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const internshipRoutes = require('./routes/internships');
const reminderRoutes = require('./routes/reminders');
const mlRoutes = require('./routes/ml');

// Import middleware
const { errorHandler } = require('./middleware/errorHandler');

// Import services
const { initializeFirebase } = require('./services/firebase');
const { initializeScheduler } = require('./services/scheduler');

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-domain.com'] 
    : ['http://localhost:3000'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Initialize Firebase Admin SDK
initializeFirebase();

// Initialize scheduler for reminders
initializeScheduler();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/internships', internshipRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/ml', mlRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV 
  });
});

// Fallback route
app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from the enhanced backend!' });
});

// Error handling middleware (must be last)
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔒 Rate limiting: ${process.env.RATE_LIMIT_MAX_REQUESTS} requests per ${process.env.RATE_LIMIT_WINDOW_MS}ms`);
});
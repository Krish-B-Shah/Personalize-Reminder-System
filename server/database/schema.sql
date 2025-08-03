-- PostgreSQL Database Schema for Personalized Reminder System

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    uid VARCHAR(128) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) NOT NULL,
    display_name VARCHAR(100),
    role VARCHAR(20) DEFAULT 'student' CHECK (role IN ('student', 'recruiter', 'admin')),
    hashed_password TEXT,
    auth_method VARCHAR(20) DEFAULT 'jwt_custom',
    profile_complete BOOLEAN DEFAULT FALSE,
    skills JSONB DEFAULT '[]',
    preferences JSONB DEFAULT '{}',
    bio TEXT,
    phone VARCHAR(20),
    linkedin VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE
);

-- Internships table
CREATE TABLE internships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    company VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    requirements JSONB DEFAULT '[]',
    location VARCHAR(255),
    type VARCHAR(20) CHECK (type IN ('remote', 'on-site', 'hybrid')),
    duration VARCHAR(100),
    stipend DECIMAL(10,2),
    application_deadline TIMESTAMP WITH TIME ZONE,
    tags JSONB DEFAULT '[]',
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'closed', 'draft')),
    created_by VARCHAR(128) REFERENCES users(uid) ON DELETE CASCADE,
    applications_count INTEGER DEFAULT 0,
    views_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Applications table
CREATE TABLE applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    internship_id UUID REFERENCES internships(id) ON DELETE CASCADE,
    user_id VARCHAR(128) REFERENCES users(uid) ON DELETE CASCADE,
    cover_letter TEXT NOT NULL,
    resume TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')),
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    UNIQUE(internship_id, user_id)
);

-- Reminders table
CREATE TABLE reminders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(128) REFERENCES users(uid) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    reminder_date TIMESTAMP WITH TIME ZONE NOT NULL,
    type VARCHAR(30) CHECK (type IN ('application_deadline', 'interview', 'follow_up', 'custom')),
    priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    internship_id UUID REFERENCES internships(id) ON DELETE SET NULL,
    email_notification BOOLEAN DEFAULT TRUE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Scheduled notifications table
CREATE TABLE scheduled_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(20) NOT NULL,
    reminder_id UUID REFERENCES reminders(id) ON DELETE CASCADE,
    user_id VARCHAR(128) REFERENCES users(uid) ON DELETE CASCADE,
    scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
    sent_at TIMESTAMP WITH TIME ZONE,
    processed_at TIMESTAMP WITH TIME ZONE,
    reason TEXT,
    error TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activity logs table
CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(128) REFERENCES users(uid) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Skills lookup table (for better normalization and analytics)
CREATE TABLE skills (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    category VARCHAR(50),
    popularity_score INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User skills junction table
CREATE TABLE user_skills (
    user_id VARCHAR(128) REFERENCES users(uid) ON DELETE CASCADE,
    skill_id INTEGER REFERENCES skills(id) ON DELETE CASCADE,
    proficiency_level VARCHAR(20) DEFAULT 'beginner' CHECK (proficiency_level IN ('beginner', 'intermediate', 'advanced', 'expert')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, skill_id)
);

-- Internship skills junction table
CREATE TABLE internship_skills (
    internship_id UUID REFERENCES internships(id) ON DELETE CASCADE,
    skill_id INTEGER REFERENCES skills(id) ON DELETE CASCADE,
    importance VARCHAR(20) DEFAULT 'required' CHECK (importance IN ('required', 'preferred', 'nice_to_have')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (internship_id, skill_id)
);

-- ML recommendations table (for caching and analytics)
CREATE TABLE ml_recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(128) REFERENCES users(uid) ON DELETE CASCADE,
    internship_id UUID REFERENCES internships(id) ON DELETE CASCADE,
    overall_score INTEGER NOT NULL,
    skills_score INTEGER,
    location_score INTEGER,
    work_type_score INTEGER,
    interest_score INTEGER,
    company_score INTEGER,
    matched_skills JSONB DEFAULT '[]',
    skills_gap JSONB DEFAULT '[]',
    reasons JSONB DEFAULT '[]',
    algorithm_version VARCHAR(10) DEFAULT '1.0',
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, internship_id, algorithm_version)
);

-- Indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_skills ON users USING GIN(skills);
CREATE INDEX idx_users_created_at ON users(created_at);

CREATE INDEX idx_internships_status ON internships(status);
CREATE INDEX idx_internships_company ON internships(company);
CREATE INDEX idx_internships_type ON internships(type);
CREATE INDEX idx_internships_location ON internships(location);
CREATE INDEX idx_internships_deadline ON internships(application_deadline);
CREATE INDEX idx_internships_created_by ON internships(created_by);
CREATE INDEX idx_internships_requirements ON internships USING GIN(requirements);
CREATE INDEX idx_internships_tags ON internships USING GIN(tags);

CREATE INDEX idx_applications_user_id ON applications(user_id);
CREATE INDEX idx_applications_internship_id ON applications(internship_id);
CREATE INDEX idx_applications_status ON applications(status);
CREATE INDEX idx_applications_applied_at ON applications(applied_at);

CREATE INDEX idx_reminders_user_id ON reminders(user_id);
CREATE INDEX idx_reminders_date ON reminders(reminder_date);
CREATE INDEX idx_reminders_type ON reminders(type);
CREATE INDEX idx_reminders_status ON reminders(status);
CREATE INDEX idx_reminders_internship_id ON reminders(internship_id);

CREATE INDEX idx_notifications_scheduled_for ON scheduled_notifications(scheduled_for);
CREATE INDEX idx_notifications_status ON scheduled_notifications(status);
CREATE INDEX idx_notifications_user_id ON scheduled_notifications(user_id);

CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_type ON activity_logs(type);
CREATE INDEX idx_activity_logs_timestamp ON activity_logs(timestamp);

CREATE INDEX idx_skills_name ON skills(name);
CREATE INDEX idx_skills_category ON skills(category);
CREATE INDEX idx_skills_popularity ON skills(popularity_score DESC);

CREATE INDEX idx_ml_recommendations_user_id ON ml_recommendations(user_id);
CREATE INDEX idx_ml_recommendations_score ON ml_recommendations(overall_score DESC);
CREATE INDEX idx_ml_recommendations_generated_at ON ml_recommendations(generated_at);

-- Functions and triggers for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_internships_updated_at BEFORE UPDATE ON internships
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reminders_updated_at BEFORE UPDATE ON reminders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Sample data for skills table
INSERT INTO skills (name, category, popularity_score) VALUES
('JavaScript', 'Programming Languages', 95),
('Python', 'Programming Languages', 90),
('React', 'Frontend Frameworks', 85),
('Node.js', 'Backend Technologies', 80),
('SQL', 'Databases', 85),
('HTML', 'Web Technologies', 90),
('CSS', 'Web Technologies', 88),
('Git', 'Development Tools', 92),
('AWS', 'Cloud Platforms', 75),
('Docker', 'DevOps', 70),
('Java', 'Programming Languages', 80),
('Spring Boot', 'Backend Frameworks', 65),
('MongoDB', 'Databases', 70),
('Express.js', 'Backend Frameworks', 75),
('TypeScript', 'Programming Languages', 78),
('Angular', 'Frontend Frameworks', 70),
('Vue.js', 'Frontend Frameworks', 65),
('PostgreSQL', 'Databases', 75),
('Redis', 'Databases', 60),
('Kubernetes', 'DevOps', 65),
('Machine Learning', 'AI/ML', 70),
('Data Science', 'AI/ML', 68),
('TensorFlow', 'AI/ML', 60),
('Pandas', 'Data Analysis', 65),
('NumPy', 'Data Analysis', 62),
('React Native', 'Mobile Development', 55),
('Flutter', 'Mobile Development', 50),
('Swift', 'Mobile Development', 45),
('Kotlin', 'Mobile Development', 40),
('GraphQL', 'APIs', 55);

-- Views for common queries
CREATE VIEW active_internships AS
SELECT * FROM internships 
WHERE status = 'active' AND application_deadline > NOW();

CREATE VIEW user_application_summary AS
SELECT 
    u.uid,
    u.username,
    u.email,
    COUNT(a.id) as total_applications,
    COUNT(CASE WHEN a.status = 'pending' THEN 1 END) as pending_applications,
    COUNT(CASE WHEN a.status = 'accepted' THEN 1 END) as accepted_applications,
    COUNT(CASE WHEN a.status = 'rejected' THEN 1 END) as rejected_applications
FROM users u
LEFT JOIN applications a ON u.uid = a.user_id
GROUP BY u.uid, u.username, u.email;

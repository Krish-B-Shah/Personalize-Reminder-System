const express = require('express');
const { body, query } = require('express-validator');
const admin = require('firebase-admin');
const { handleValidationErrors } = require('../middleware/errorHandler');
const { requireAuth } = require('../middleware/auth');
const { calculateInternshipMatch, generateRecommendations } = require('../services/mlMatcher');

const router = express.Router();

// Get personalized internship recommendations
router.get('/recommendations', requireAuth, async (req, res) => {
  try {
    const { limit = 10, includeApplied = false } = req.query;
    const db = admin.firestore();
    
    // Get user profile
    const userDoc = await db.collection('users').doc(req.user.uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    const userData = userDoc.data();
    
    if (!userData.skills || userData.skills.length === 0) {
      return res.status(400).json({ 
        error: 'Please update your skills in your profile to get personalized recommendations' 
      });
    }

    // Get user's applications if not including applied internships
    let appliedInternshipIds = [];
    if (!includeApplied) {
      const applicationsSnapshot = await db.collection('applications')
        .where('userId', '==', req.user.uid)
        .get();
      
      appliedInternshipIds = applicationsSnapshot.docs.map(doc => doc.data().internshipId);
    }

    // Get active internships
    let internshipsQuery = db.collection('internships').where('status', '==', 'active');
    const internshipsSnapshot = await internshipsQuery.get();

    const internships = [];
    internshipsSnapshot.forEach(doc => {
      const data = doc.data();
      const internshipId = doc.id;
      
      // Skip if user already applied (unless includeApplied is true)
      if (!includeApplied && appliedInternshipIds.includes(internshipId)) {
        return;
      }

      internships.push({
        id: internshipId,
        ...data
      });
    });

    // Generate recommendations using ML algorithm
    const recommendations = await generateRecommendations(userData, internships, parseInt(limit));

    res.json({
      recommendations,
      userProfile: {
        skills: userData.skills,
        preferences: userData.preferences || {}
      },
      metadata: {
        totalInternships: internships.length,
        algorithmVersion: '1.0',
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Get recommendations error:', error);
    res.status(500).json({ error: 'Failed to generate recommendations' });
  }
});

// Get match score for a specific internship
router.get('/match/:internshipId', requireAuth, async (req, res) => {
  try {
    const { internshipId } = req.params;
    const db = admin.firestore();
    
    // Get user profile
    const userDoc = await db.collection('users').doc(req.user.uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    const userData = userDoc.data();
    
    // Get internship
    const internshipDoc = await db.collection('internships').doc(internshipId).get();
    if (!internshipDoc.exists) {
      return res.status(404).json({ error: 'Internship not found' });
    }

    const internshipData = { id: internshipId, ...internshipDoc.data() };
    
    // Calculate match score
    const matchResult = calculateInternshipMatch(userData, internshipData);

    res.json({
      match: matchResult,
      internship: {
        id: internshipId,
        title: internshipData.title,
        company: internshipData.company
      },
      user: {
        skills: userData.skills || []
      }
    });

  } catch (error) {
    console.error('Get match score error:', error);
    res.status(500).json({ error: 'Failed to calculate match score' });
  }
});

// Bulk match analysis for multiple internships
router.post('/bulk-match', requireAuth, async (req, res) => {
  try {
    const { internshipIds } = req.body;
    
    if (!Array.isArray(internshipIds) || internshipIds.length === 0) {
      return res.status(400).json({ error: 'internshipIds array is required' });
    }

    if (internshipIds.length > 50) {
      return res.status(400).json({ error: 'Maximum 50 internships allowed per request' });
    }

    const db = admin.firestore();
    
    // Get user profile
    const userDoc = await db.collection('users').doc(req.user.uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    const userData = userDoc.data();
    
    // Get all requested internships
    const matches = [];
    for (const internshipId of internshipIds) {
      try {
        const internshipDoc = await db.collection('internships').doc(internshipId).get();
        if (internshipDoc.exists) {
          const internshipData = { id: internshipId, ...internshipDoc.data() };
          const matchResult = calculateInternshipMatch(userData, internshipData);
          
          matches.push({
            internshipId,
            title: internshipData.title,
            company: internshipData.company,
            ...matchResult
          });
        }
      } catch (error) {
        console.error(`Error processing internship ${internshipId}:`, error);
      }
    }

    // Sort by match score
    matches.sort((a, b) => b.overallScore - a.overallScore);

    res.json({
      matches,
      metadata: {
        requested: internshipIds.length,
        processed: matches.length,
        algorithmVersion: '1.0'
      }
    });

  } catch (error) {
    console.error('Bulk match error:', error);
    res.status(500).json({ error: 'Failed to process bulk match request' });
  }
});

// Update user skills and preferences for better matching
router.put('/profile/skills', requireAuth, async (req, res) => {
  try {
    const { skills, preferences, interests } = req.body;
    
    if (!Array.isArray(skills)) {
      return res.status(400).json({ error: 'Skills must be an array' });
    }

    const db = admin.firestore();
    
    const updateData = {
      skills,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (preferences) {
      updateData.preferences = { ...preferences };
    }

    if (interests) {
      updateData.interests = interests;
    }

    await db.collection('users').doc(req.user.uid).update(updateData);

    // Generate fresh recommendations with updated profile
    const userDoc = await db.collection('users').doc(req.user.uid).get();
    const userData = userDoc.data();
    
    // Get sample internships for quick recommendations
    const internshipsSnapshot = await db.collection('internships')
      .where('status', '==', 'active')
      .limit(20)
      .get();
    
    const internships = [];
    internshipsSnapshot.forEach(doc => {
      internships.push({ id: doc.id, ...doc.data() });
    });

    const quickRecommendations = await generateRecommendations(userData, internships, 5);

    res.json({
      message: 'Skills and preferences updated successfully',
      updatedProfile: {
        skills: userData.skills,
        preferences: userData.preferences
      },
      quickRecommendations
    });

  } catch (error) {
    console.error('Update skills error:', error);
    res.status(500).json({ error: 'Failed to update skills and preferences' });
  }
});

// Get matching statistics and insights
router.get('/insights', requireAuth, async (req, res) => {
  try {
    const db = admin.firestore();
    
    // Get user profile
    const userDoc = await db.collection('users').doc(req.user.uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    const userData = userDoc.data();
    
    // Get user's applications with match scores
    const applicationsSnapshot = await db.collection('applications')
      .where('userId', '==', req.user.uid)
      .get();

    const applicationInsights = [];
    let totalScore = 0;
    let highMatches = 0;

    for (const appDoc of applicationsSnapshot.docs) {
      const appData = appDoc.data();
      
      try {
        const internshipDoc = await db.collection('internships').doc(appData.internshipId).get();
        if (internshipDoc.exists) {
          const internshipData = { id: appData.internshipId, ...internshipDoc.data() };
          const matchResult = calculateInternshipMatch(userData, internshipData);
          
          applicationInsights.push({
            internshipId: appData.internshipId,
            title: internshipData.title,
            company: internshipData.company,
            appliedAt: appData.appliedAt?.toDate?.() || appData.appliedAt,
            status: appData.status,
            matchScore: matchResult.overallScore,
            skillsMatch: matchResult.skillsScore
          });

          totalScore += matchResult.overallScore;
          if (matchResult.overallScore >= 75) highMatches++;
        }
      } catch (error) {
        console.error('Error calculating match for application:', error);
      }
    }

    const insights = {
      profile: {
        skills: userData.skills || [],
        skillsCount: (userData.skills || []).length,
        profileCompleteness: userData.profileComplete ? 100 : 60
      },
      applications: {
        total: applicationInsights.length,
        averageMatchScore: applicationInsights.length > 0 ? Math.round(totalScore / applicationInsights.length) : 0,
        highMatches,
        applicationHistory: applicationInsights.sort((a, b) => new Date(b.appliedAt) - new Date(a.appliedAt))
      },
      recommendations: {
        skillGaps: await identifySkillGaps(userData),
        suggestedSkills: await getSuggestedSkills(userData)
      }
    };

    res.json({ insights });

  } catch (error) {
    console.error('Get insights error:', error);
    res.status(500).json({ error: 'Failed to generate insights' });
  }
});

// Helper function to identify skill gaps
async function identifySkillGaps(userData) {
  try {
    const db = admin.firestore();
    const userSkills = userData.skills || [];
    
    // Get top skills from active internships
    const internshipsSnapshot = await db.collection('internships')
      .where('status', '==', 'active')
      .limit(50)
      .get();

    const skillFrequency = {};
    
    internshipsSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.requirements) {
        data.requirements.forEach(skill => {
          const normalizedSkill = skill.toLowerCase().trim();
          skillFrequency[normalizedSkill] = (skillFrequency[normalizedSkill] || 0) + 1;
        });
      }
    });

    // Find skills user doesn't have that are in high demand
    const userSkillsLower = userSkills.map(skill => skill.toLowerCase());
    const skillGaps = Object.entries(skillFrequency)
      .filter(([skill, frequency]) => 
        !userSkillsLower.includes(skill) && frequency >= 3
      )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([skill, frequency]) => ({
        skill: skill.charAt(0).toUpperCase() + skill.slice(1),
        demand: frequency,
        priority: frequency >= 10 ? 'high' : frequency >= 5 ? 'medium' : 'low'
      }));

    return skillGaps;

  } catch (error) {
    console.error('Error identifying skill gaps:', error);
    return [];
  }
}

// Helper function to get suggested skills
async function getSuggestedSkills(userData) {
  const userSkills = userData.skills || [];
  
  // Simple skill clustering based on common combinations
  const skillClusters = {
    'web-development': ['React', 'Node.js', 'JavaScript', 'HTML', 'CSS', 'MongoDB', 'Express'],
    'data-science': ['Python', 'Pandas', 'NumPy', 'Scikit-learn', 'TensorFlow', 'SQL', 'Matplotlib'],
    'mobile-development': ['React Native', 'Flutter', 'Swift', 'Kotlin', 'iOS', 'Android'],
    'devops': ['Docker', 'Kubernetes', 'AWS', 'Git', 'CI/CD', 'Linux', 'Terraform'],
    'ai-ml': ['Python', 'TensorFlow', 'PyTorch', 'OpenCV', 'NLP', 'Deep Learning']
  };

  const suggestions = [];
  
  Object.entries(skillClusters).forEach(([cluster, skills]) => {
    const userHasSkills = skills.filter(skill => 
      userSkills.some(userSkill => 
        userSkill.toLowerCase().includes(skill.toLowerCase())
      )
    );

    if (userHasSkills.length >= 2) {
      const missingSkills = skills.filter(skill =>
        !userSkills.some(userSkill =>
          userSkill.toLowerCase().includes(skill.toLowerCase())
        )
      );

      if (missingSkills.length > 0) {
        suggestions.push({
          cluster: cluster.replace('-', ' ').toUpperCase(),
          suggestedSkills: missingSkills.slice(0, 3),
          reason: `You have ${userHasSkills.length} skills in this area`
        });
      }
    }
  });

  return suggestions.slice(0, 3);
}

module.exports = router;

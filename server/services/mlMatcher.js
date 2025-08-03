const { Matrix } = require('ml-matrix');

// Main function to generate personalized recommendations
const generateRecommendations = async (userProfile, internships, limit = 10) => {
  try {
    const recommendations = [];
    
    for (const internship of internships) {
      const matchResult = calculateInternshipMatch(userProfile, internship);
      
      recommendations.push({
        internship: {
          id: internship.id,
          title: internship.title,
          company: internship.company,
          location: internship.location,
          type: internship.type,
          requirements: internship.requirements || [],
          tags: internship.tags || [],
          description: internship.description,
          applicationDeadline: internship.applicationDeadline
        },
        match: matchResult,
        reasons: generateMatchReasons(userProfile, internship, matchResult)
      });
    }

    // Sort by overall score and return top recommendations
    recommendations.sort((a, b) => b.match.overallScore - a.match.overallScore);
    
    return recommendations.slice(0, limit);

  } catch (error) {
    console.error('Error generating recommendations:', error);
    throw error;
  }
};

// Calculate match score between user and internship
const calculateInternshipMatch = (userProfile, internship) => {
  const userSkills = userProfile.skills || [];
  const internshipRequirements = internship.requirements || [];
  const internshipTags = internship.tags || [];
  const userPreferences = userProfile.preferences || {};
  const userInterests = userProfile.interests || [];

  // 1. Skills Match Score (40% weight)
  const skillsScore = calculateSkillsMatch(userSkills, internshipRequirements);
  
  // 2. Location Preference Score (20% weight)
  const locationScore = calculateLocationMatch(userPreferences, internship);
  
  // 3. Work Type Preference Score (15% weight)
  const workTypeScore = calculateWorkTypeMatch(userPreferences, internship);
  
  // 4. Interest Alignment Score (15% weight)
  const interestScore = calculateInterestMatch(userInterests, internshipTags, internship);
  
  // 5. Company Size/Type Preference (10% weight)
  const companyScore = calculateCompanyMatch(userPreferences, internship);

  // Calculate weighted overall score
  const overallScore = Math.round(
    (skillsScore * 0.4) +
    (locationScore * 0.2) +
    (workTypeScore * 0.15) +
    (interestScore * 0.15) +
    (companyScore * 0.1)
  );

  return {
    overallScore,
    breakdown: {
      skillsScore,
      locationScore,
      workTypeScore,
      interestScore,
      companyScore
    },
    skillsMatched: getMatchedSkills(userSkills, internshipRequirements),
    skillsGap: getSkillsGap(userSkills, internshipRequirements)
  };
};

// Calculate skills match using cosine similarity
const calculateSkillsMatch = (userSkills, requirements) => {
  if (!userSkills.length || !requirements.length) {
    return 0;
  }

  // Normalize skills to lowercase for comparison
  const normalizedUserSkills = userSkills.map(skill => skill.toLowerCase().trim());
  const normalizedRequirements = requirements.map(req => req.toLowerCase().trim());

  // Direct matches
  const directMatches = normalizedRequirements.filter(req => 
    normalizedUserSkills.includes(req)
  ).length;

  // Partial matches (e.g., "React.js" matches "React")
  let partialMatches = 0;
  normalizedRequirements.forEach(req => {
    if (!normalizedUserSkills.includes(req)) {
      normalizedUserSkills.forEach(userSkill => {
        if (userSkill.includes(req) || req.includes(userSkill)) {
          partialMatches += 0.7; // Partial match worth 70% of full match
        }
      });
    }
  });

  // Related skills matching (simplified)
  const relatedMatches = calculateRelatedSkillsMatch(normalizedUserSkills, normalizedRequirements);

  const totalMatches = directMatches + partialMatches + relatedMatches;
  const matchPercentage = Math.min((totalMatches / normalizedRequirements.length) * 100, 100);

  return Math.round(matchPercentage);
};

// Calculate related skills match
const calculateRelatedSkillsMatch = (userSkills, requirements) => {
  const skillRelations = {
    'javascript': ['react', 'node.js', 'vue', 'angular', 'express'],
    'python': ['django', 'flask', 'pandas', 'numpy', 'scikit-learn'],
    'java': ['spring', 'hibernate', 'maven', 'gradle'],
    'react': ['javascript', 'jsx', 'redux', 'next.js'],
    'node.js': ['javascript', 'express', 'mongodb', 'npm'],
    'sql': ['mysql', 'postgresql', 'database', 'oracle'],
    'aws': ['cloud', 'ec2', 's3', 'lambda', 'devops'],
    'docker': ['kubernetes', 'devops', 'containerization'],
    'git': ['github', 'version control', 'gitlab', 'bitbucket']
  };

  let relatedMatches = 0;

  requirements.forEach(req => {
    if (!userSkills.includes(req)) {
      userSkills.forEach(userSkill => {
        const relations = skillRelations[userSkill] || [];
        if (relations.includes(req)) {
          relatedMatches += 0.5; // Related skill match worth 50%
        }
      });
    }
  });

  return relatedMatches;
};

// Calculate location preference match
const calculateLocationMatch = (userPreferences, internship) => {
  const preferredLocation = userPreferences.location;
  const internshipLocation = internship.location;
  const workType = internship.type;

  // If user prefers remote and internship is remote
  if (preferredLocation === 'remote' && workType === 'remote') {
    return 100;
  }

  // If user prefers specific city and it matches
  if (preferredLocation && preferredLocation !== 'remote') {
    if (internshipLocation && internshipLocation.toLowerCase().includes(preferredLocation.toLowerCase())) {
      return 100;
    }
    // If internship is hybrid and location matches
    if (workType === 'hybrid' && internshipLocation && 
        internshipLocation.toLowerCase().includes(preferredLocation.toLowerCase())) {
      return 85;
    }
  }

  // If no location preference, neutral score
  if (!preferredLocation) {
    return 70;
  }

  // If preferences don't match but internship is remote/hybrid, still decent score
  if (workType === 'remote') {
    return 60;
  }
  if (workType === 'hybrid') {
    return 50;
  }

  return 30; // Poor location match
};

// Calculate work type preference match
const calculateWorkTypeMatch = (userPreferences, internship) => {
  const preferredWorkType = userPreferences.workType;
  const internshipType = internship.type;

  if (!preferredWorkType) {
    return 70; // Neutral if no preference
  }

  if (preferredWorkType === internshipType) {
    return 100;
  }

  // Partial matches
  if (preferredWorkType === 'hybrid' && (internshipType === 'remote' || internshipType === 'on-site')) {
    return 75;
  }

  return 40; // Poor work type match
};

// Calculate interest alignment
const calculateInterestMatch = (userInterests, internshipTags, internship) => {
  if (!userInterests || !userInterests.length) {
    return 60; // Neutral if no interests specified
  }

  const allInternshipKeywords = [
    ...(internshipTags || []),
    internship.title,
    internship.company,
    internship.description || ''
  ].join(' ').toLowerCase();

  let matchCount = 0;
  userInterests.forEach(interest => {
    if (allInternshipKeywords.includes(interest.toLowerCase())) {
      matchCount++;
    }
  });

  const matchPercentage = (matchCount / userInterests.length) * 100;
  return Math.min(Math.round(matchPercentage), 100);
};

// Calculate company preference match
const calculateCompanyMatch = (userPreferences, internship) => {
  const preferredCompanySize = userPreferences.companySize;
  const preferredIndustry = userPreferences.industry;

  let score = 70; // Base score

  // This would typically require company data that we might not have
  // For now, we'll use heuristics based on company name and description

  if (preferredIndustry) {
    const companyInfo = (internship.company + ' ' + (internship.description || '')).toLowerCase();
    const industryKeywords = {
      'technology': ['tech', 'software', 'ai', 'ml', 'data', 'cloud'],
      'finance': ['bank', 'finance', 'fintech', 'trading', 'investment'],
      'healthcare': ['health', 'medical', 'pharma', 'biotech'],
      'education': ['education', 'learning', 'university', 'school'],
      'ecommerce': ['ecommerce', 'retail', 'marketplace', 'shopping']
    };

    const keywords = industryKeywords[preferredIndustry.toLowerCase()] || [];
    const hasIndustryMatch = keywords.some(keyword => companyInfo.includes(keyword));
    
    if (hasIndustryMatch) {
      score += 20;
    }
  }

  return Math.min(score, 100);
};

// Get matched skills between user and internship
const getMatchedSkills = (userSkills, requirements) => {
  const normalizedUserSkills = userSkills.map(skill => skill.toLowerCase().trim());
  const normalizedRequirements = requirements.map(req => req.toLowerCase().trim());

  const matched = [];
  normalizedRequirements.forEach(req => {
    const directMatch = normalizedUserSkills.find(skill => skill === req);
    if (directMatch) {
      matched.push(userSkills[normalizedUserSkills.indexOf(directMatch)]);
    } else {
      // Check for partial matches
      const partialMatch = normalizedUserSkills.find(skill => 
        skill.includes(req) || req.includes(skill)
      );
      if (partialMatch) {
        matched.push(userSkills[normalizedUserSkills.indexOf(partialMatch)]);
      }
    }
  });

  return [...new Set(matched)]; // Remove duplicates
};

// Get skills gap (required skills user doesn't have)
const getSkillsGap = (userSkills, requirements) => {
  const normalizedUserSkills = userSkills.map(skill => skill.toLowerCase().trim());
  const normalizedRequirements = requirements.map(req => req.toLowerCase().trim());

  const gap = [];
  normalizedRequirements.forEach((req, index) => {
    const hasDirectMatch = normalizedUserSkills.includes(req);
    const hasPartialMatch = normalizedUserSkills.some(skill => 
      skill.includes(req) || req.includes(skill)
    );

    if (!hasDirectMatch && !hasPartialMatch) {
      gap.push(requirements[index]);
    }
  });

  return gap;
};

// Generate human-readable reasons for the match
const generateMatchReasons = (userProfile, internship, matchResult) => {
  const reasons = [];

  // Skills-based reasons
  if (matchResult.skillsMatched.length > 0) {
    if (matchResult.skillsMatched.length === 1) {
      reasons.push(`You have the required skill: ${matchResult.skillsMatched[0]}`);
    } else {
      reasons.push(`You have ${matchResult.skillsMatched.length} matching skills: ${matchResult.skillsMatched.slice(0, 3).join(', ')}`);
    }
  }

  // Location-based reasons
  const userLocation = userProfile.preferences?.location;
  if (userLocation === 'remote' && internship.type === 'remote') {
    reasons.push('Matches your remote work preference');
  } else if (userLocation && internship.location && 
             internship.location.toLowerCase().includes(userLocation.toLowerCase())) {
    reasons.push(`Located in your preferred area: ${internship.location}`);
  }

  // Work type reasons
  const userWorkType = userProfile.preferences?.workType;
  if (userWorkType && userWorkType === internship.type) {
    reasons.push(`Matches your ${internship.type} work preference`);
  }

  // Skill gap suggestions
  if (matchResult.skillsGap.length > 0 && matchResult.skillsGap.length <= 2) {
    reasons.push(`Consider learning: ${matchResult.skillsGap.join(', ')} to be a perfect match`);
  }

  // Overall score reasons
  if (matchResult.overallScore >= 90) {
    reasons.unshift('Excellent match for your profile!');
  } else if (matchResult.overallScore >= 75) {
    reasons.unshift('Great match for your skills and preferences');
  } else if (matchResult.overallScore >= 60) {
    reasons.unshift('Good opportunity to expand your skills');
  }

  return reasons.slice(0, 4); // Limit to top 4 reasons
};

// Advanced ML feature: Collaborative filtering (simplified)
const collaborativeFiltering = async (userId, userProfile, allInternships) => {
  // This would implement user-based collaborative filtering
  // For now, returning empty array as it requires user interaction data
  return [];
};

// Content-based filtering using TF-IDF (simplified)
const contentBasedFiltering = (userProfile, internships) => {
  // This would implement TF-IDF for content similarity
  // For now, using the basic matching algorithm
  return internships.map(internship => ({
    internship,
    score: calculateInternshipMatch(userProfile, internship).overallScore
  }));
};

module.exports = {
  generateRecommendations,
  calculateInternshipMatch,
  getMatchedSkills,
  getSkillsGap
};

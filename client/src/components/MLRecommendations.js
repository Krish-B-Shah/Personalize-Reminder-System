import React, { useState, useEffect } from 'react';
import { mlAPI } from '../../services/api';
import { Sparkles, TrendingUp, Target, BookOpen, Star } from 'lucide-react';

const MLRecommendations = () => {
  const [recommendations, setRecommendations] = useState([]);
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchRecommendations();
    fetchInsights();
  }, []);

  const fetchRecommendations = async () => {
    try {
      const data = await mlAPI.getRecommendations({ limit: 5 });
      setRecommendations(data.recommendations || []);
    } catch (error) {
      setError('Failed to load recommendations');
      console.error('Error fetching recommendations:', error);
    }
  };

  const fetchInsights = async () => {
    try {
      const data = await mlAPI.getInsights();
      setInsights(data.insights);
    } catch (error) {
      console.error('Error fetching insights:', error);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 90) return 'text-green-600 bg-green-100';
    if (score >= 75) return 'text-blue-600 bg-blue-100';
    if (score >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-gray-600 bg-gray-100';
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-md">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-md">
        <div className="text-center text-red-600">
          <Sparkles className="mx-auto h-12 w-12 mb-2 opacity-50" />
          <p>{error}</p>
          <button 
            onClick={fetchRecommendations}
            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6 rounded-lg">
        <div className="flex items-center">
          <Sparkles className="h-8 w-8 mr-3" />
          <div>
            <h2 className="text-2xl font-bold">AI-Powered Recommendations</h2>
            <p className="opacity-90">Personalized internship matches based on your profile</p>
          </div>
        </div>
      </div>

      {/* Profile Insights */}
      {insights && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-lg shadow-md">
            <div className="flex items-center">
              <Target className="h-6 w-6 text-blue-600 mr-2" />
              <div>
                <p className="text-sm text-gray-600">Average Match Score</p>
                <p className="text-2xl font-bold text-blue-600">
                  {insights.applications.averageMatchScore}%
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow-md">
            <div className="flex items-center">
              <TrendingUp className="h-6 w-6 text-green-600 mr-2" />
              <div>
                <p className="text-sm text-gray-600">High Matches</p>
                <p className="text-2xl font-bold text-green-600">
                  {insights.applications.highMatches}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow-md">
            <div className="flex items-center">
              <BookOpen className="h-6 w-6 text-purple-600 mr-2" />
              <div>
                <p className="text-sm text-gray-600">Skills Count</p>
                <p className="text-2xl font-bold text-purple-600">
                  {insights.profile.skillsCount}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recommendations */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold text-gray-800">Top Recommendations for You</h3>
          <p className="text-sm text-gray-600">Based on your skills, preferences, and career goals</p>
        </div>

        <div className="divide-y">
          {recommendations.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              <Sparkles className="mx-auto h-12 w-12 mb-2 opacity-50" />
              <p>No recommendations available yet.</p>
              <p className="text-sm">Complete your profile to get personalized matches!</p>
            </div>
          ) : (
            recommendations.map((rec, index) => (
              <div key={rec.internship.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <div className="flex items-center">
                      <span className="inline-flex items-center justify-center w-6 h-6 bg-blue-600 text-white text-xs font-bold rounded-full mr-3">
                        {index + 1}
                      </span>
                      <h4 className="text-lg font-semibold text-gray-800">
                        {rec.internship.title}
                      </h4>
                    </div>
                    <p className="text-blue-600 font-medium">{rec.internship.company}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      {rec.internship.location} • {rec.internship.type}
                    </p>
                  </div>
                  
                  <div className="text-right">
                    <span className={`inline-block px-3 py-1 text-sm font-semibold rounded-full ${getScoreColor(rec.match.overallScore)}`}>
                      {rec.match.overallScore}% Match
                    </span>
                  </div>
                </div>

                {/* Match Breakdown */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                  <div className="text-center">
                    <div className="text-xs text-gray-500">Skills</div>
                    <div className="font-semibold text-sm">{rec.match.breakdown.skillsScore}%</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500">Location</div>
                    <div className="font-semibold text-sm">{rec.match.breakdown.locationScore}%</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500">Work Type</div>
                    <div className="font-semibold text-sm">{rec.match.breakdown.workTypeScore}%</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500">Interest</div>
                    <div className="font-semibold text-sm">{rec.match.breakdown.interestScore}%</div>
                  </div>
                </div>

                {/* Matched Skills */}
                {rec.match.skillsMatched && rec.match.skillsMatched.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs text-gray-500 mb-1">Your matching skills:</p>
                    <div className="flex flex-wrap gap-1">
                      {rec.match.skillsMatched.slice(0, 5).map(skill => (
                        <span key={skill} className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                          {skill}
                        </span>
                      ))}
                      {rec.match.skillsMatched.length > 5 && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                          +{rec.match.skillsMatched.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Reasons */}
                {rec.reasons && rec.reasons.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs text-gray-500 mb-1">Why this matches you:</p>
                    <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                      {rec.reasons.slice(0, 3).map((reason, idx) => (
                        <li key={idx}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Skills Gap */}
                {rec.match.skillsGap && rec.match.skillsGap.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs text-gray-500 mb-1">Skills to learn:</p>
                    <div className="flex flex-wrap gap-1">
                      {rec.match.skillsGap.slice(0, 3).map(skill => (
                        <span key={skill} className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex space-x-2 pt-2">
                  <button className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors">
                    View Details
                  </button>
                  <button className="px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors">
                    Apply Now
                  </button>
                  <button className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded hover:bg-gray-50 transition-colors">
                    Save for Later
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Skill Development Suggestions */}
      {insights && insights.recommendations && insights.recommendations.suggestedSkills && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <Star className="h-5 w-5 text-yellow-500 mr-2" />
            Skill Development Suggestions
          </h3>
          
          <div className="space-y-3">
            {insights.recommendations.suggestedSkills.map((suggestion, index) => (
              <div key={index} className="border-l-4 border-blue-500 pl-4">
                <h4 className="font-medium text-gray-800">{suggestion.cluster}</h4>
                <p className="text-sm text-gray-600 mb-2">{suggestion.reason}</p>
                <div className="flex flex-wrap gap-1">
                  {suggestion.suggestedSkills.map(skill => (
                    <span key={skill} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Skill Gaps */}
      {insights && insights.recommendations && insights.recommendations.skillGaps && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">In-Demand Skills You're Missing</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {insights.recommendations.skillGaps.slice(0, 8).map((gap, index) => (
              <div key={index} className="flex justify-between items-center p-3 border rounded">
                <div>
                  <span className="font-medium">{gap.skill}</span>
                  <span className={`ml-2 px-2 py-1 text-xs rounded ${getPriorityColor(gap.priority)}`}>
                    {gap.priority} priority
                  </span>
                </div>
                <div className="text-sm text-gray-600">
                  {gap.demand} openings
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MLRecommendations;

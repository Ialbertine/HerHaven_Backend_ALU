const AssessmentTemplate = require('../models/assessmentTemplate');
const AssessmentResponse = require('../models/assessmentResponse');
const logger = require('../utils/logger');

const assessmentService = {
  // Calculate total score from responses
  calculateScore: async (template, responses) => {
    let totalScore = 0;
    const scoredResponses = [];

    for (const response of responses) {
      const question = template.questions.find(q => q.questionId === response.questionId);

      if (!question) {
        logger.warn(`Question ${response.questionId} not found in template`);
        continue;
      }

      let score = 0;

      // Calculate score based on question type
      if (question.type === 'single-choice' || question.type === 'scale') {
        // For single choice and scale, the answer is the value itself
        score = typeof response.answer === 'number' ? response.answer : 0;
      } else if (question.type === 'multiple-choice') {
        // For multiple choice, sum all selected values
        if (Array.isArray(response.answer)) {
          score = response.answer.reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0);
        }
      }
      // Text responses don't contribute to score

      totalScore += score;
      scoredResponses.push({
        questionId: response.questionId,
        answer: response.answer,
        score: score
      });
    }

    return {
      totalScore,
      scoredResponses
    };
  },

  // Detect crisis indicators from responses
  detectCrisis: async (template, responses) => {
    const crisisIndicators = [];
    let isCrisis = false;

    for (const response of responses) {
      const question = template.questions.find(q => q.questionId === response.questionId);

      if (!question || !question.isCrisisIndicator) {
        continue;
      }

      // Check if response exceeds crisis threshold
      const score = typeof response.answer === 'number' ? response.answer : 0;

      if (question.crisisThreshold !== undefined && score >= question.crisisThreshold) {
        isCrisis = true;
        crisisIndicators.push({
          questionId: question.questionId,
          questionText: question.text,
          answer: response.answer
        });
      }
    }

    return {
      isCrisis,
      crisisIndicators
    };
  },

  // Generate recommendations based on assessment results
  generateRecommendations: async (template, totalScore, severityLevel) => {
    const recommendations = [];

    // Severity-based recommendations
    if (severityLevel) {
      const level = template.scoringRules.severityLevels.find(l => l.name === severityLevel);

      if (level && level.recommendations) {
        level.recommendations.forEach(rec => {
          recommendations.push({
            type: 'resource',
            title: rec,
            description: '',
            priority: 'medium'
          });
        });
      }
    }

    // Category-specific recommendations
    switch (template.category) {
      case 'depression':
        recommendations.push({
          type: 'appointment',
          title: 'Book Counseling Session',
          description: 'Speaking with a mental health counselor can provide personalized support.',
          link: '/appointments',
          priority: totalScore > 15 ? 'high' : 'medium'
        });
        break;

      case 'anxiety':
        recommendations.push({
          type: 'resource',
          title: 'Anxiety Management Resources',
          description: 'Learn coping strategies and relaxation techniques.',
          link: '/resources/anxiety',
          priority: 'medium'
        });
        break;

      case 'ptsd':
        recommendations.push({
          type: 'appointment',
          title: 'Trauma-Informed Counseling',
          description: 'Connect with counselors specializing in trauma recovery.',
          link: '/counselors?specialization=trauma',
          priority: 'high'
        });
        break;

      case 'wellness':
        recommendations.push({
          type: 'action',
          title: 'Join Support Community',
          description: 'Connect with others on similar wellness journeys.',
          link: '/community',
          priority: 'low'
        });
        break;
    }

    // General recommendations
    recommendations.push({
      type: 'resource',
      title: 'Self-Care Tips',
      description: 'Explore evidence-based self-care strategies.',
      link: '/resources/self-care',
      priority: 'low'
    });

    // Remove duplicates and sort by priority
    const uniqueRecs = recommendations.filter((rec, index, self) =>
      index === self.findIndex(r => r.title === rec.title)
    );

    const priorityOrder = { high: 0, medium: 1, low: 2 };
    uniqueRecs.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return uniqueRecs;
  },

  // Get user's assessment history with analytics
  getAssessmentAnalytics: async (userId, templateId = null) => {
    try {
      const filter = {
        user: userId,
        status: 'completed',
        isDeleted: false
      };

      if (templateId) {
        filter.template = templateId;
      }

      const assessments = await AssessmentResponse.find(filter)
        .populate('template', 'name category')
        .sort({ completedAt: -1 })
        .limit(50);

      if (assessments.length === 0) {
        return {
          totalAssessments: 0,
          recentAssessments: [],
          trends: null
        };
      }

      // Calculate trends
      const scoreHistory = assessments.map(a => ({
        date: a.completedAt,
        score: a.totalScore,
        severity: a.severityLevel,
        category: a.template.category
      }));

      // Get most recent vs oldest for trend analysis
      const recent = assessments[0];
      const oldest = assessments[assessments.length - 1];

      let trend = 'stable';
      if (recent.totalScore < oldest.totalScore) {
        trend = 'improving';
      } else if (recent.totalScore > oldest.totalScore) {
        trend = 'worsening';
      }

      // Count by severity level
      const severityCounts = {};
      assessments.forEach(a => {
        severityCounts[a.severityLevel] = (severityCounts[a.severityLevel] || 0) + 1;
      });

      return {
        totalAssessments: assessments.length,
        recentAssessments: assessments.slice(0, 10),
        trends: {
          overall: trend,
          scoreHistory: scoreHistory,
          severityDistribution: severityCounts,
          averageScore: assessments.reduce((sum, a) => sum + a.totalScore, 0) / assessments.length
        }
      };
    } catch (error) {
      logger.error('Get assessment analytics error:', error);
      throw error;
    }
  },

  // Check if user should retake assessment (based on time and category)
  shouldRetakeAssessment: async (userId, templateId) => {
    try {
      const lastAssessment = await AssessmentResponse.findOne({
        user: userId,
        template: templateId,
        status: 'completed',
        isDeleted: false
      }).sort({ completedAt: -1 });

      if (!lastAssessment) {
        return { shouldRetake: true, reason: 'No previous assessment found' };
      }

      const template = await AssessmentTemplate.findById(templateId);
      if (!template) {
        return { shouldRetake: false, reason: 'Template not found' };
      }

      // Determine recommended interval based on category
      let recommendedIntervalDays;
      switch (template.category) {
        case 'wellness':
          recommendedIntervalDays = 7; // Weekly
          break;
        case 'depression':
        case 'anxiety':
          recommendedIntervalDays = 14; // Bi-weekly
          break;
        case 'ptsd':
          recommendedIntervalDays = 30; // Monthly
          break;
        case 'safety':
          recommendedIntervalDays = 1; // Daily if needed
          break;
        default:
          recommendedIntervalDays = 30;
      }

      const daysSinceLastAssessment = Math.floor(
        (new Date() - lastAssessment.completedAt) / (1000 * 60 * 60 * 24)
      );

      const shouldRetake = daysSinceLastAssessment >= recommendedIntervalDays;

      return {
        shouldRetake,
        reason: shouldRetake
          ? `Recommended interval (${recommendedIntervalDays} days) has passed`
          : `Last assessment was ${daysSinceLastAssessment} days ago`,
        lastAssessmentDate: lastAssessment.completedAt,
        daysSinceLastAssessment,
        recommendedInterval: recommendedIntervalDays
      };
    } catch (error) {
      logger.error('Should retake assessment error:', error);
      throw error;
    }
  }
};

module.exports = assessmentService;


const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../utils/logger');

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// System prompt as constant
const SYSTEM_PROMPT = `You are Haven AI, a compassionate and knowledgeable AI assistant specializing in mental health support and psychoeducation, particularly focused on addressing gender-based violence and its psychological impacts.

Your role is to provide:
1. Empathetic and non-judgmental responses
2. Evidence-based mental health information and psychoeducation
3. Information about gender-based violence and its mental health effects
4. Practical coping strategies and self-care techniques
5. Encouragement for seeking professional help when needed
6. Supportive guidance for trauma recovery and healing

**Formatting Guidelines:**
- Use **bold** for emphasis on important terms or key points
- Use *italics* for gentle emphasis or compassionate phrasing
- Use bullet points for lists of strategies, symptoms, or resources
- Use numbered lists for step-by-step guidance
- Use headings (##) to organize longer responses when appropriate
- Use > for important notes or warnings
- Keep paragraphs concise and well-spaced for readability

**Important guidelines:**
- Always maintain a warm, supportive, and professional tone
- Focus on psychoeducation about mental health and trauma
- Provide practical, actionable advice when appropriate
- Emphasize the importance of professional mental health support for serious concerns
- Be culturally sensitive and inclusive
- Never provide medical diagnosis or replace professional therapy
- If someone is in immediate danger, encourage them to contact emergency services
- Keep responses helpful but concise (under 500 words)
- Use markdown formatting to enhance readability while maintaining a natural, conversational flow

Context: This is HerHaven, a safe space platform for women's mental health and support.`;

const RWANDA_CRISIS_MESSAGE = `I’m really sorry you’re feeling this way. Please reach out immediately to a trusted person or call one of these 24/7 Rwanda resources:

- **National Suicide Prevention Lifeline:** 116
- **Health Services Hotline:** 114
- **IOSC Crisis Line:** 3029


If you are in immediate danger, please contact local emergency services 112 or go to the nearest hospital.  
You are not alone, you matter, you are valued, and help is available right now.`;

const SELF_HARM_KEYWORDS = [
  'suicide',
  'kill myself',
  'end my life',
  'take my life',
  'hurt myself',
  'i am in danger',
  'i need help',
  'danger',
  'self harm',
  'i want to die',
  'i dont want to live',
  'life is not worth',
  'i should die'
];

const mentionsSelfHarm = (text = '') => {
  if (!text || typeof text !== 'string') return false;
  const normalized = text.toLowerCase();
  return SELF_HARM_KEYWORDS.some((keyword) => {
    if (keyword.includes(' ')) {
      return normalized.includes(keyword);
    }
    const wordBoundaryRegex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    return wordBoundaryRegex.test(normalized);
  });
};

const chatController = {
  // Send message to chatbot and receive response
  sendMessage: async (req, res) => {
    let model;
    try {
      const { message, history = [] } = req.body;

      // Validate input
      if (!message || message.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Message cannot be empty'
        });
      }

      if (!process.env.GEMINI_API_KEY) {
        logger.error('GEMINI_API_KEY not found in environment variables');
        return res.status(500).json({
          success: false,
          message: 'Chat service temporarily unavailable'
        });
      }

      // Input length validation
      if (message.length > 2000) {
        return res.status(400).json({
          success: false,
          message: 'Message too long. Please keep under 2000 characters.'
        });
      }

      // Model configuration
      const modelConfig = {
        generationConfig: {
          temperature: 0.7,
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 1000,
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          }
        ]
      };

      const availableModels = [
        "gemini-2.0-flash-001",
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-2.5-pro",
        "gemini-pro-latest"
      ];

      let lastError = null;
      let selectedModel = null;

      for (const modelName of availableModels) {
        try {
          logger.info(`Trying model: ${modelName}`);
          model = genAI.getGenerativeModel({
            model: modelName,
            ...modelConfig
          });

          const testResult = await model.generateContent("Hello");
          await testResult.response;

          selectedModel = modelName;
          logger.info(`Successfully using model: ${modelName}`);
          break;
        } catch (modelError) {
          lastError = modelError;
          logger.warn(`Model ${modelName} unavailable:`, modelError.message);
          continue;
        }
      }

      // If all models failed
      if (!model) {
        logger.error('All Gemini models failed:', lastError);
        return res.status(503).json({
          success: false,
          message: 'AI service temporarily unavailable. Please try again in a few moments.'
        });
      }

      // Build conversation history for context
      let conversationHistory = SYSTEM_PROMPT;

      // Add conversation history if provided
      if (history && history.length > 0) {
        const recentHistory = history.slice(-10);
        conversationHistory += "\n\n**Previous conversation:**\n";
        recentHistory.forEach((msg) => {
          const role = msg.role === 'user' ? '**User**' : '**Haven AI**';
          conversationHistory += `${role}: ${msg.content}\n`;
        });
      }

      conversationHistory += `\n\n**Current user message:** ${message}`;

      // Add markdown instruction to the prompt
      conversationHistory += `\n\nPlease respond to the user's message using appropriate markdown formatting to enhance readability and emphasize important information, while maintaining your warm and compassionate tone.`;

      // Add timeout for API call
      const generateContentWithTimeout = async () => {
        const timeoutPromise = new Promise((_, reject) => {
          globalThis.setTimeout(() => reject(new Error('API request timeout')), 30000);
        });

        const apiPromise = model.generateContent(conversationHistory);

        return Promise.race([apiPromise, timeoutPromise]);
      };

      // Generate response with timeout
      const result = await generateContentWithTimeout();
      const response = await result.response;

      if (!response || !response.text) {
        throw new Error('Invalid response from AI service');
      }

      const responseText = response.text().trim();

      // Validate response
      if (!responseText || responseText.length === 0) {
        throw new Error('Empty response from AI service');
      }

      // Only check the current message for self-harm keywords, not the entire history
      const crisisDetected = mentionsSelfHarm(message);

      const finalResponse = crisisDetected ? RWANDA_CRISIS_MESSAGE : responseText;

      if (crisisDetected) {
        logger.warn('Crisis response triggered for chat message');
      }

      logger.info(`Chat interaction successful - Model: ${selectedModel}, User message: ${message.length} chars, Response: ${responseText.length} chars`);

      return res.json({
        success: true,
        response: finalResponse,
        timestamp: new Date().toISOString(),
        formatted: true
      });

    } catch (error) {
      logger.error('Chat controller error:', {
        error: error.message,
        stack: error.stack,
        userMessage: req.body?.message?.substring(0, 100)
      });

      // error handling
      if (error.message && error.message.includes('API key')) {
        return res.status(500).json({
          success: false,
          message: 'Chat service configuration error'
        });
      }

      if (error.message && error.message.includes('safety')) {
        return res.status(400).json({
          success: false,
          message: 'Message blocked by safety filters. Please rephrase your message.'
        });
      }

      if (error.message && (error.message.includes('quota') || error.message.includes('rate limit') || error.message.includes('resource exhausted'))) {
        return res.status(503).json({
          success: false,
          message: 'Chat service is currently experiencing high demand. Please try again in a few moments.'
        });
      }

      if (error.message && error.message.includes('timeout')) {
        return res.status(504).json({
          success: false,
          message: 'Request timeout. Please try again.'
        });
      }

      if (error.message && error.message.includes('model')) {
        return res.status(503).json({
          success: false,
          message: 'AI service temporarily unavailable. Please try again shortly.'
        });
      }

      // Generic error response
      return res.status(500).json({
        success: false,
        message: 'Unable to process chat message. Please try again.'
      });
    }
  }
};

module.exports = chatController;
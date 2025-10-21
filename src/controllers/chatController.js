const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../utils/logger');

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const chatController = {
  // Send message to chatbot and receive response
  sendMessage: async (req, res) => {
    try {
      const { message, history = [] } = req.body;

      if (!process.env.GEMINI_API_KEY) {
        logger.error('GEMINI_API_KEY not found in environment variables');
        return res.status(500).json({
          success: false,
          message: 'Chat service temporarily unavailable'
        });
      }

      let model;
      try {
        model = genAI.getGenerativeModel({
          model: "gemini-2.5-flash",
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
        });
      } catch {
        model = genAI.getGenerativeModel({
          model: "gemini-2.5-pro",
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
        });
      }

      // Build conversation history for context
      let conversationHistory = `You are Haven AI, a compassionate and knowledgeable AI assistant specializing in mental health support and psychoeducation, particularly focused on addressing gender-based violence and its psychological impacts.

Your role is to provide:
1. Empathetic and non-judgmental responses
2. Evidence-based mental health information and psychoeducation
3. Information about gender-based violence and its mental health effects
4. Practical coping strategies and self-care techniques
5. Encouragement for seeking professional help when needed
6. Supportive guidance for trauma recovery and healing

Important guidelines:
- Always maintain a warm, supportive, and professional tone
- Focus on psychoeducation about mental health and trauma
- Provide practical, actionable advice when appropriate
- Emphasize the importance of professional mental health support for serious concerns
- Be culturally sensitive and inclusive
- Never provide medical diagnosis or replace professional therapy
- If someone is in immediate danger, encourage them to contact emergency services
- Keep responses helpful but concise (under 500 words)

Context: This is HerHaven, a safe space platform for women's mental health and support.`;

      // Add conversation history if provided
      if (history && history.length > 0) {
        conversationHistory += "\n\nPrevious conversation:\n";
        history.forEach((msg) => {
          const role = msg.role === 'user' ? 'User' : 'Haven AI';
          conversationHistory += `${role}: ${msg.content}\n`;
        });
      }

      conversationHistory += `\n\nCurrent user message: ${message}`;

      // Generate response
      const result = await model.generateContent(conversationHistory);
      const response = await result.response;
      const responseText = response.text();

      logger.info(`Chat interaction - User message length: ${message.length}, Response generated successfully`);

      res.json({
        response: responseText,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Chat controller error:', error);

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

      res.status(500).json({
        success: false,
        message: 'Unable to process chat message. Please try again.'
      });
    }
  }
};

module.exports = chatController;

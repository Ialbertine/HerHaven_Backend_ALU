# HerHaven Backend API

**[HerHaven](https://ialbertine-herhaven.netlify.app/)** is a culturally sensitive, trauma-informed digital space designed to support women affected by gender-based violence. It offers confidential access to mental health care through professional counseling links, peer-to-peer support, and an AI-guided chatbot providing psychoeducation, self-help tools, and crisis referrals—promoting healing, resilience, and stigma-free help-seeking.

## Overview

HerHaven Backend is built with Node.js and Express.js, providing RESTful API endpoints for a mental health support platform. The platform focuses on addressing gender-based violence and its psychological impacts through various support mechanisms including professional counseling, AI assistance, community support, and mental health assessments.

## Features

- **User Authentication**: Secure registration and login with JWT tokens, support for users, counselors, and admins
- **Mental Health Assessments**: Customizable assessments for depression, anxiety, PTSD, safety, and wellness
- **Counseling Appointments**: Book and manage appointments with verified counselors
- **AI Chat Assistant**: Gemini AI-powered chatbot for mental health support and psychoeducation
- **Community Features**: Post and engage in community discussions with moderation
- **Emergency SOS**: Emergency contact management and SOS functionality
- **Notifications**: Email and SMS notifications via SendGrid and Twilio
- **Guest Access**: Allow guest sessions for limited access
- **Multi-language Support**: i18next integration for internationalization
- **Security Features**: Rate limiting, Helmet security headers, password hashing with Argon2

## Technology Stack

- **Runtime**: Node.js
- **Framework**: Express.js 5.x
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **Password Hashing**: Argon2
- **AI Integration**: Google Gemini AI
- **Email Service**: SendGrid
- **SMS Service**: Twilio
- **Validation**: Joi
- **Logging**: Winston
- **Testing**: Jest with Supertest
- **Other**: CORS, Helmet, Morgan, Moment-timezone, Node-cron

## Project Structure

```
HerHaven_Backend_ALU/
├── src/
│   ├── config/           # Database and i18n configuration
│   ├── controllers/      # Request handlers
│   ├── middleware/       # Auth, validation, error handling
│   ├── models/          # Mongoose schemas
│   ├── routes/          # API route definitions
│   ├── services/        # Business logic (assessments, notifications, SMS, email)
│   ├── utils/           # Helper utilities (logger, security)
│   ├── validations/     # Request validation schemas
│   └── server.js        # Application entry point
├── tests/               # Test files
│   ├── integration/     # Integration tests
│   ├── unit/            # Unit tests
│   ├── setup.integration.js
│   └── setup.unit.js
├── logs/                # Application logs
├── docs/                # Documentation
├── jest.config.js       # Jest configuration
└── package.json         # Dependencies and scripts
```

## Installation

### Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or Atlas cloud)
- npm or yarn

### Steps

1. Clone the repository:
```bash
git clone https://github.com/Ialbertine/HerHaven_Backend_ALU.git
cd HerHaven_Backend_ALU
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:
```env
# Server
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173

# Database
MONGO_URI=mongodb://localhost:27017/herhaven
# OR for MongoDB Atlas:
# MONGO_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>?retryWrites=true&w=majority

# JWT
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=7d

# Google Gemini AI
GEMINI_API_KEY=your-gemini-api-key

# SendGrid Email
SENDGRID_API_KEY=your-sendgrid-api-key
SENDGRID_SENDER_EMAIL=your-email@example.com

# Twilio SMS
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=+1234567890
```

4. Create required directories:
```bash
mkdir -p logs
```

## Running the Application

### Development Mode

Run the server with auto-reload using nodemon:
```bash
npm run dev
```

### Production Mode

Run the server:
```bash
npm start
```

The server will start on `http://localhost:5000` (or the PORT specified in .env).

### Health Check

Verify the server is running:
```bash
curl http://localhost:5000/api/health
```

Expected response:
```json
{
  "success": true,
  "message": "HerHaven API is running",
  "timestamp": "2025-11-21T12:00:00.000Z",
  "environment": "development"
}
```

## Available Scripts

- `npm start` - Start the production server
- `npm run dev` - Start development server with nodemon
- `npm test` - Run all tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate test coverage report
- `npm run lint` - Run ESLint
- `npm run create-admin` - Create an admin user
- `npm run seed-assessments` - Seed assessment templates
- `npm run cleanup-old-templates` - Clean up old assessment templates

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user/admin/counselor
- `POST /api/auth/continue-as-guest` - Create guest session
- `POST /api/auth/validate-guest-session` - Validate guest session

### Assessments
- `GET /api/assessments/templates` - Get assessment templates
- `POST /api/assessments/submit` - Submit assessment responses
- `GET /api/assessments/history` - Get user assessment history
- `GET /api/assessments/analytics` - Get assessment analytics

### Appointments
- `GET /api/appointments` - Get user appointments
- `POST /api/appointments` - Book an appointment
- `PUT /api/appointments/:id` - Update appointment
- `DELETE /api/appointments/:id` - Cancel appointment

### Counselors
- `GET /api/counselor` - Get counselors list
- `GET /api/counselor/:id` - Get counselor details
- `POST /api/counselor/register` - Register as counselor
- `PUT /api/counselor/profile` - Update counselor profile

### Community
- `GET /api/community/posts` - Get community posts
- `POST /api/community/posts` - Create a post
- `PUT /api/community/posts/:id` - Update post
- `DELETE /api/community/posts/:id` - Delete post
- `POST /api/community/posts/:id/comments` - Add comment
- `POST /api/community/posts/:id/like` - Like a post

### Chat
- `POST /api/chat/message` - Send message to AI chatbot
- `GET /api/chat/history` - Get chat history

### SOS & Emergency
- `POST /api/sos` - Trigger SOS alert
- `GET /api/emergency-contacts` - Get emergency contacts
- `POST /api/emergency-contacts` - Add emergency contact
- `PUT /api/emergency-contacts/:id` - Update emergency contact
- `DELETE /api/emergency-contacts/:id` - Delete emergency contact

### Admin
- Admin routes require admin authentication
- User management, counselor verification, system configuration

### Other
- `GET /api/health` - Health check endpoint
- `GET /api/notifications` - Get user notifications
- `POST /api/feedback` - Submit feedback
- `POST /api/contact` - Contact form submission

## Testing

The project uses Jest for testing with separate unit and integration test suites.

### Run All Tests
```bash
npm test
```

### Run Unit Tests Only
```bash
npm test tests/unit/
```

### Run Integration Tests Only
```bash
npm test tests/integration/
```

### Test Coverage
```bash
npm run test:coverage
```

Note: Integration tests require a MongoDB connection. Unit tests run independently without database access.

## Security Features

- Password hashing with Argon2
- JWT token-based authentication
- Rate limiting (100 requests per 15 minutes per IP)
- Helmet.js security headers
- Input sanitization
- CORS configuration
- Role-based access control (RBAC)
- Account locking after failed login attempts
- Guest session management

## User Roles

- **User**: Regular platform user with access to assessments, appointments, community, and chat
- **Counselor**: Verified professional counselor who can manage appointments and provide services
- **Admin**: Platform administrator with access to user management and system configuration
- **Guest**: Limited access for unauthenticated users

## Database Models

- User
- Admin
- Counselor
- Appointment
- AssessmentTemplate
- AssessmentResponse
- Community Post
- Comment
- Notification
- Feedback
- SOS Alert
- Emergency Contact
- Guest Session
- Contact Message

## Environment Variables

Required environment variables are listed in the Installation section. Make sure all required keys are set before running the application.

## Logging

Logs are written to files in the `logs/` directory:
- `error.log` - Error level logs
- `combined.log` - All logs

Console logging is enabled only in development mode.

## Error Handling

The application uses a centralized error handling middleware that:
- Catches and formats errors consistently
- Provides appropriate HTTP status codes
- Logs errors for debugging
- Returns user-friendly error messages

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Write tests for new features
5. Ensure all tests pass
6. Submit a pull request


## Support

For issues and questions, please open an issue on the GitHub repository.

## Acknowledgments

Built as part of ALU Capstone project for women's mental health support.

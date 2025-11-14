# Assessment API Endpoint Map

## 🌐 Public Endpoints (No Authentication)

```
/api/assessments/public/
│
├── GET    /templates
│   └── Returns: All published assessment templates
│       ├── Query: ?category=depression
│       └── Use: Browse available assessments
│
├── GET    /templates/:templateId/begin
│   └── Returns: Full template with all questions
│       └── Use: Start taking an assessment
│
├── POST   /submit
│   ├── Auth: Optional (works for both guest & authenticated)
│   ├── Guest: Returns sessionId
│   └── Authenticated: Saves to account
│
└── GET    /session/:sessionId
    └── Returns: Guest assessment results
        └── Use: Retrieve results with session ID
```

---

## 🔐 Authenticated Endpoints

### Admin Template Management
```
/api/assessments/templates/
│
├── POST   /                          [Admin Only]
│   └── Create new assessment template
│
├── GET    /                          [All Roles]
│   └── Get all templates (with filters)
│
├── GET    /:templateId               [All Roles]
│   └── Get specific template details
│
├── PUT    /:templateId               [Admin Only]
│   └── Update template
│
└── DELETE /:templateId               [Admin Only]
    └── Delete/deactivate template
```

### User Assessment Submissions
```
/api/assessments/
│
├── POST   /submit                    [User]
│   └── Submit assessment (backward compatibility)
│
├── POST   /anonymous/submit          [No Auth - Deprecated]
│   └── Use /public/submit instead
│
└── GET    /my-assessments            [User]
    └── Get user's assessment history
```

### Assessment Results & Management
```
/api/assessments/results/
│
├── GET    /:assessmentId/recommendations    [User]
│   └── Get recommendations for assessment
│
├── POST   /:assessmentId/share              [User]
│   └── Share assessment with counselor
│
├── POST   /:assessmentId/counselor-notes    [Counselor]
│   └── Add counselor notes
│
├── PUT    /:assessmentId/notes              [User]
│   └── Update user notes
│
└── DELETE /:assessmentId                    [User]
    └── Soft delete assessment
```

### Analytics & Insights
```
/api/assessments/
│
├── GET    /analytics/me              [User]
│   └── Get user's assessment trends
│
├── GET    /retake/:templateId        [User]
│   └── Check if should retake
│
└── GET    /shared/with-me            [Counselor]
    └── Get assessments shared with counselor
```

---

## 🎯 Endpoint Usage by User Type

### Guest Users (No Login)
```
✅ GET  /api/assessments/public/templates
✅ GET  /api/assessments/public/templates/:id/begin
✅ POST /api/assessments/public/submit
✅ GET  /api/assessments/public/session/:sessionId
```

### Regular Users (Logged In)
```
✅ All Guest endpoints (auto-upgraded with token)
✅ GET  /api/assessments/my-assessments
✅ GET  /api/assessments/results/:id/recommendations
✅ POST /api/assessments/results/:id/share
✅ PUT  /api/assessments/results/:id/notes
✅ GET  /api/assessments/analytics/me
✅ GET  /api/assessments/retake/:templateId
```

### Counselors
```
✅ All User endpoints
✅ GET  /api/assessments/shared/with-me
✅ POST /api/assessments/results/:id/counselor-notes
```

### Admins
```
✅ All endpoints
✅ POST   /api/assessments/templates
✅ PUT    /api/assessments/templates/:id
✅ DELETE /api/assessments/templates/:id
```

---

## 🔄 Comparison: Old vs New

### Old System ❌
```
GET  /api/assessments/templates              [Auth Required]
GET  /api/assessments/:assessmentId          [Auth Required] ❌ REMOVED
POST /api/assessments/submit                 [Auth Required]
POST /api/assessments/anonymous/submit       [No Auth]
```

### New System ✅
```
GET  /api/assessments/public/templates       [No Auth]
GET  /api/assessments/public/templates/:id/begin  [No Auth]
POST /api/assessments/public/submit          [Optional Auth]
GET  /api/assessments/public/session/:id     [No Auth]
```

**Key Changes:**
- ✅ Public access to browse assessments
- ✅ Direct "begin" endpoint (no ID lookup first)
- ✅ Unified submit endpoint
- ❌ Removed confusing `/:assessmentId` route

---

## 📊 Request/Response Flow

### Guest Submission Flow
```
1. GET /public/templates
   └─> Returns: List of assessments

2. GET /public/templates/ABC123/begin
   └─> Returns: Full template with questions

3. POST /public/submit
   Body: { templateId, responses }
   └─> Returns: { sessionId, results }

4. GET /public/session/XYZ789
   └─> Returns: Saved results
```

### Authenticated Submission Flow
```
1. GET /public/templates
   └─> Returns: List of assessments

2. GET /public/templates/ABC123/begin
   └─> Returns: Full template with questions

3. POST /public/submit
   Headers: { Authorization: "Bearer TOKEN" }
   Body: { templateId, responses, shareWithCounselor }
   └─> Returns: { results } (no sessionId)

4. GET /my-assessments
   └─> Returns: All user's assessments
```

---

## 🔐 Authentication Headers

### No Auth (Guest)
```javascript
fetch('/api/assessments/public/templates', {
  method: 'GET'
})
```

### Optional Auth (Public Submit)
```javascript
// Works without token (guest)
fetch('/api/assessments/public/submit', {
  method: 'POST',
  body: JSON.stringify({ templateId, responses })
})

// Works with token (authenticated)
fetch('/api/assessments/public/submit', {
  method: 'POST',
  headers: { 
    'Authorization': 'Bearer YOUR_TOKEN'
  },
  body: JSON.stringify({ templateId, responses })
})
```

### Required Auth
```javascript
fetch('/api/assessments/my-assessments', {
  method: 'GET',
  headers: { 
    'Authorization': 'Bearer YOUR_TOKEN'
  }
})
```

---

## 📝 Response Formats

### Template List
```json
{
  "success": true,
  "data": {
    "templates": [
      {
        "_id": "abc123",
        "name": "Depression Screening",
        "category": "depression",
        "estimatedDuration": 5,
        "totalResponses": 1523
      }
    ],
    "count": 1
  }
}
```

### Template Details (Begin)
```json
{
  "success": true,
  "data": {
    "template": {
      "questions": [...],
      "scoringRules": {...}
    },
    "message": "You can take this as guest or login..."
  }
}
```

### Submit Response (Guest)
```json
{
  "success": true,
  "message": "Assessment submitted as guest...",
  "data": {
    "assessment": {
      "id": "xyz",
      "sessionId": "abc123def456",
      "totalScore": 15,
      "recommendations": [...]
    }
  }
}
```

### Submit Response (Authenticated)
```json
{
  "success": true,
  "message": "Assessment submitted successfully",
  "data": {
    "assessment": {
      "id": "xyz",
      "totalScore": 15,
      "recommendations": [...]
    }
  }
}
```

---

## 🎯 Quick Reference

| Task | Endpoint | Auth | Method |
|------|----------|------|--------|
| Browse assessments | `/public/templates` | No | GET |
| Begin assessment | `/public/templates/:id/begin` | No | GET |
| Submit (guest) | `/public/submit` | No | POST |
| Submit (authenticated) | `/public/submit` | Yes | POST |
| Get guest results | `/public/session/:id` | No | GET |
| My history | `/my-assessments` | Yes | GET |
| Share with counselor | `/results/:id/share` | Yes | POST |
| Get analytics | `/analytics/me` | Yes | GET |
| Create template | `/templates` | Admin | POST |

---

## 🚨 Deprecated Endpoints

These still work but are not recommended:

```
❌ POST /api/assessments/anonymous/submit
   → Use: POST /public/submit instead

❌ GET  /api/assessments/:assessmentId
   → REMOVED: Use /public/templates/:id/begin
```

---

## 📚 Documentation

- **Full Guide:** `docs/PUBLIC_ASSESSMENT_ENDPOINTS.md`
- **Quick Start:** `QUICK_START_GUIDE.md`
- **Summary:** `ASSESSMENT_UPDATE_SUMMARY.md`

---

**Last Updated:** November 14, 2024
**Status:** ✅ Production Ready


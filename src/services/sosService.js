const mongoose = require('mongoose');
const SOS = require('../models/sos');
const EmergencyContact = require('../models/emergency');
const User = require('../models/user');
const emailService = require('./emailService');
const logger = require('../utils/logger');



const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(String(value));

const buildSOSEmailSubject = (user) => {
  const names = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  const displayName = names || user?.username || user?.email || 'Someone';
  return `🚨 URGENT: SOS Alert - ${displayName} Needs Immediate Help`;
};

const buildSOSEmailHTML = (user, context = {}) => {
  const names = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  const displayName = names || user?.username || user?.email || 'Someone';

  // Get phone number of person who needs help
  const helpSeekerPhone = context.metadata?.phoneNumber || context.phoneNumber || null;

  // Build detailed location HTML
  let locationHTML = '';
  let mapEmbedHTML = '';
  let mapUrl = '';

  if (context.location?.address) {
    const encodedAddress = encodeURIComponent(context.location.address);
    mapUrl = `https://maps.google.com/?q=${encodedAddress}`;
    const hasMapApiKey = process.env.GOOGLE_MAPS_API_KEY && process.env.GOOGLE_MAPS_API_KEY.trim() !== '';
    const mapStaticUrl = hasMapApiKey
      ? `https://maps.googleapis.com/maps/api/staticmap?center=${encodedAddress}&zoom=15&size=600x300&markers=color:red%7C${encodedAddress}&key=${process.env.GOOGLE_MAPS_API_KEY}`
      : null;

    locationHTML = `
      <div style="margin: 20px 0;">
        <p><strong>Exact Location Address:</strong></p>
        <p style="font-size: 16px; color: #d32f2f; font-weight: bold; background: #ffebee; padding: 10px; border-radius: 5px; border-left: 4px solid #d32f2f;">
          ${context.location.address}
        </p>
        ${context.location.accuracy ? `<p style="font-size: 12px; color: #666;"><strong>Location Accuracy:</strong> ±${Math.round(context.location.accuracy)} meters</p>` : ''}
      </div>
    `;

    mapEmbedHTML = `
      <div style="margin: 20px 0;">
        <p><strong>Location Map:</strong></p>
        ${mapStaticUrl ?
        `<img src="${mapStaticUrl}" alt="Location Map" style="max-width: 100%; height: auto; border-radius: 8px; border: 2px solid #ddd; margin: 10px 0;" />`
        : ''}
        <p style="margin-top: 10px;">
          <a href="${mapUrl}" target="_blank" style="display: inline-block; background: #1976d2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
            Open in Google Maps
          </a>
        </p>
      </div>
    `;
  } else if (context.location?.latitude && context.location?.longitude) {
    mapUrl = `https://maps.google.com/?q=${context.location.latitude},${context.location.longitude}`;
    const hasMapApiKey = process.env.GOOGLE_MAPS_API_KEY && process.env.GOOGLE_MAPS_API_KEY.trim() !== '';
    const mapStaticUrl = hasMapApiKey
      ? `https://maps.googleapis.com/maps/api/staticmap?center=${context.location.latitude},${context.location.longitude}&zoom=15&size=600x300&markers=color:red%7C${context.location.latitude},${context.location.longitude}&key=${process.env.GOOGLE_MAPS_API_KEY}`
      : null;

    locationHTML = `
      <div style="margin: 20px 0;">
        <p><strong>Location Coordinates:</strong></p>
        <p style="font-size: 16px; color: #d32f2f; font-weight: bold; background: #ffebee; padding: 10px; border-radius: 5px; border-left: 4px solid #d32f2f;">
          Latitude: ${context.location.latitude}<br>
          Longitude: ${context.location.longitude}
        </p>
        ${context.location.accuracy ? `<p style="font-size: 12px; color: #666;"><strong>Location Accuracy:</strong> ±${Math.round(context.location.accuracy)} meters</p>` : ''}
      </div>
    `;

    mapEmbedHTML = `
      <div style="margin: 20px 0;">
        <p><strong>🗺️ Location Map:</strong></p>
        ${mapStaticUrl ?
        `<img src="${mapStaticUrl}" alt="Location Map" style="max-width: 100%; height: auto; border-radius: 8px; border: 2px solid #ddd; margin: 10px 0;" />`
        : ''}
        <p style="margin-top: 10px;">
          <a href="${mapUrl}" target="_blank" style="display: inline-block; background: #1976d2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
            Open in Google Maps
          </a>
        </p>
      </div>
    `;
  } else if (context.fallbackLocation) {
    mapUrl = `https://maps.google.com/?q=${encodeURIComponent(context.fallbackLocation)}`;
    locationHTML = `
      <div style="margin: 20px 0;">
        <p><strong>Last Known Location:</strong></p>
        <p style="font-size: 16px; color: #f57c00; font-weight: bold; background: #fff3e0; padding: 10px; border-radius: 5px; border-left: 4px solid #f57c00;">
          ${context.fallbackLocation}
        </p>
        <p style="font-size: 12px; color: #666; font-style: italic;">⚠️ This is a fallback location and may not be the current location.</p>
        <p style="margin-top: 10px;">
          <a href="${mapUrl}" target="_blank" style="display: inline-block; background: #1976d2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
            View Location on Map
          </a>
        </p>
      </div>
    `;
  } else {
    locationHTML = `
      <div style="margin: 20px 0;">
        <p style="color: #d32f2f; font-weight: bold;">⚠️ Location information not available</p>
      </div>
    `;
  }

  let noteHTML = '';
  if (context.customNote) {
    noteHTML = `
      <div style="margin: 20px 0; background: #e3f2fd; padding: 15px; border-radius: 5px; border-left: 4px solid #2196f3;">
        <p><strong>Additional Message from ${displayName}:</strong></p>
        <p style="font-size: 14px; color: #333; margin-top: 8px;">${context.customNote}</p>
      </div>
    `;
  }

  // Build call button HTML
  let callButtonHTML = '';
  if (helpSeekerPhone) {
    const telLink = `tel:${helpSeekerPhone.replace(/\s/g, '')}`;
    callButtonHTML = `
      <div style="text-align: center; margin: 30px 0;">
        <a href="${telLink}" style="display: inline-block; background: #4caf50; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-size: 18px; font-weight: bold; box-shadow: 0 4px 6px rgba(0,0,0,0.2);">
          📞 Call ${displayName} Now
        </a>
        <p style="margin-top: 10px; color: #666; font-size: 14px;">Phone: ${helpSeekerPhone}</p>
      </div>
    `;
  } else {
    callButtonHTML = `
      <div style="text-align: center; margin: 30px 0; padding: 15px; background: #fff3cd; border-radius: 5px;">
        <p style="color: #856404; margin: 0;">⚠️ Phone number not available for direct calling</p>
        <p style="color: #666; font-size: 12px; margin: 5px 0 0 0;">Please contact ${displayName} through other means if available</p>
      </div>
    `;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>SOS Alert</title>
      <style>
        body { 
          font-family: Arial, sans-serif; 
          line-height: 1.6; 
          color: #333; 
          margin: 0; 
          padding: 0;
          background-color: #f4f4f4;
        }
        .container {
          max-width: 600px;
          margin: 20px auto;
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
          background: linear-gradient(135deg, #ff4444 0%, #cc0000 100%);
          color: white;
          padding: 30px 20px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
        }
        .header p {
          margin: 10px 0 0 0;
          font-size: 16px;
        }
        .content {
          padding: 30px 20px;
        }
        .alert-box {
          background: #fff3cd;
          border-left: 4px solid #ffc107;
          padding: 15px;
          margin: 20px 0;
          border-radius: 4px;
        }
        .info-section {
          background: #f9f9f9;
          padding: 20px;
          border-radius: 5px;
          margin: 20px 0;
        }
        .info-section h3 {
          margin-top: 0;
          color: #333;
        }
        .info-section p {
          margin: 10px 0;
        }
        .location-link {
          display: inline-block;
          background: #0066cc;
          color: white;
          padding: 10px 20px;
          text-decoration: none;
          border-radius: 5px;
          margin: 10px 0;
        }
        .footer {
          background: #f9f9f9;
          padding: 20px;
          text-align: center;
          color: #666;
          font-size: 12px;
          border-top: 1px solid #ddd;
        }
        .timestamp {
          color: #666;
          font-size: 12px;
          margin-top: 20px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🚨 SOS ALERT</h1>
          <p>Immediate Action Required</p>
        </div>
        <div class="content">
          <div class="alert-box">
            <strong>${displayName} needs immediate assistance!</strong>
            <p>Please reach out to them as soon as possible.</p>
          </div>

          <div class="info-section">
            <h3>Alert Details</h3>
            ${locationHTML}
            ${mapEmbedHTML}
            ${noteHTML}
            <p><strong>Alert Time:</strong> ${new Date().toLocaleString()}</p>
            <p><strong>Person Needing Help:</strong> ${displayName}</p>
            ${user?.email ? `<p><strong>Email:</strong> ${user.email}</p>` : ''}
          </div>

          ${callButtonHTML}

          <div class="info-section">
            <h3>What to Do</h3>
            <ol>
              <li><strong>Immediately try to contact ${displayName}</strong> using the call button above or other available means</li>
              <li><strong>If unable to reach them</strong>, proceed to the location shown on the map</li>
              <li><strong>Call emergency services</strong> (<a href="tel:3029" style="color: #d32f2f; font-weight: bold;">3029</a>, <a href="tel:112" style="color: #d32f2f; font-weight: bold;">112</a>, or <a href="tel:3212" style="color: #d32f2f; font-weight: bold;">3212</a>) if this appears to be a life-threatening situation</li>
              <li><strong>Share this alert</strong> with other trusted contacts who may be able to help</li>
            </ol>
          </div>

          <div class="info-section" style="background: #fff3cd; border-left: 4px solid #ffc107;">
            <h3 style="color: #856404; margin-top: 0;">⚠️ Important Notes</h3>
            <ul style="color: #856404;">
              <li>This is an automated SOS alert from HerHaven Platform</li>
              <li>If you receive this alert, ${displayName} has requested immediate assistance</li>
              <li>Please respond as quickly as possible</li>
              <li>If the situation is critical, do not hesitate to contact local emergency services</li>
            </ul>
          </div>

          <div class="timestamp">
            This is an automated SOS alert from HerHaven Platform.
          </div>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} HerHaven Platform. All rights reserved.</p>
          <p>This alert was generated automatically. Please respond immediately.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

const recalcSOSStatus = (sosDoc) => {
  if (!sosDoc || !Array.isArray(sosDoc.contacts) || sosDoc.contacts.length === 0) {
    return;
  }

  const statuses = sosDoc.contacts.map((entry) => entry.status);
  if (statuses.every((status) => status === 'failed')) {
    sosDoc.status = 'failed';
  } else if (statuses.some((status) => status === 'sent')) {
    sosDoc.status = 'sent';
  } else if (statuses.every((status) => status === 'pending')) {
    sosDoc.status = 'pending';
  }
};

const dispatchEmailAlerts = async (sosDoc, context) => {
  if (!sosDoc) {
    return;
  }

  const pendingEntries = (sosDoc.contacts || [])
    .map((record, index) => ({ record, index }))
    .filter(({ record }) => record.status !== 'sent');

  if (pendingEntries.length === 0) {
    return;
  }

  let user = null;
  let contactMap = new Map();

  if (sosDoc.userId && !sosDoc.isGuest) {
    const contactIds = pendingEntries
      .map(({ record }) => record.contactId)
      .filter((id) => isValidObjectId(id));

    const [userDoc, contacts] = await Promise.all([
      User.findById(sosDoc.userId).select('firstName lastName username email').lean(),
      EmergencyContact.find({
        _id: { $in: contactIds },
        isActive: true,
        consentGiven: true,
      })
        .select('email name phoneNumber')
        .lean(),
    ]);

    user = userDoc;
    contactMap = new Map(contacts.map((item) => [String(item._id), item]));
  } else if (sosDoc.isGuest && sosDoc.guestContacts) {
    sosDoc.guestContacts.forEach((guestContact, index) => {
      contactMap.set(`guest_${index}`, {
        email: guestContact.email,
        name: guestContact.name,
        phoneNumber: guestContact.phoneNumber
      });
    });
  }

  const now = new Date();
  let contactsModified = false;

  for (const { record, index } of pendingEntries) {
    const entry = sosDoc.contacts[index];
    entry.history = Array.isArray(entry.history) ? entry.history : [];

    let contact = null;
    if (sosDoc.isGuest && sosDoc.guestContacts) {
      contact = {
        email: sosDoc.guestContacts[index]?.email,
        name: sosDoc.guestContacts[index]?.name,
        phoneNumber: sosDoc.guestContacts[index]?.phoneNumber
      };
    } else {
      contact = contactMap.get(String(record.contactId));
    }

    if (!contact || !contact.email) {
      entry.status = 'failed';
      entry.lastAttemptAt = now;
      entry.lastError = 'Missing email address';
      entry.history.push({
        channel: 'email',
        status: 'failed',
        sentAt: now,
        metadata: { error: 'Missing email address' },
      });
      contactsModified = true;
      logger.error('SOS alert failed: Missing email', {
        sosId: sosDoc._id,
        contactId: record.contactId || `guest_${index}`,
      });
      continue;
    }

    try {
      // Get phone number from metadata or SOS document metadata
      const helpSeekerPhone = sosDoc.metadata?.phoneNumber || context.metadata?.phoneNumber || null;

      const emailSubject = buildSOSEmailSubject(user || { username: 'Guest User' });
      const emailHTML = buildSOSEmailHTML(user || { username: 'Guest User' }, {
        ...context,
        metadata: sosDoc.metadata || context.metadata || {},
        phoneNumber: helpSeekerPhone
      });

      const emailResult = await emailService.sendEmail(contact.email, emailSubject, emailHTML);

      if (emailResult.success) {
        entry.status = 'sent';
        entry.channel = 'email';
        entry.lastAttemptAt = now;
        entry.lastError = undefined;
        entry.history.push({
          channel: 'email',
          status: 'sent',
          sentAt: now,
          metadata: { messageId: emailResult.messageId },
        });
        logger.info(`SOS email alert sent successfully to ${contact.email}`, {
          sosId: sosDoc._id,
          contactId: record.contactId || `guest_${index}`,
        });
      } else {
        throw new Error(emailResult.error || 'Email send failed');
      }
    } catch (error) {
      entry.status = 'failed';
      entry.lastAttemptAt = now;
      entry.lastError = error.message;
      entry.history.push({
        channel: 'email',
        status: 'failed',
        sentAt: now,
        metadata: { error: error.message },
      });

      logger.error('SOS email dispatch failed', {
        sosId: sosDoc._id,
        contactId: record.contactId || `guest_${index}`,
        email: contact.email,
        error: error.message,
      });
    }

    contactsModified = true;
  }

  if (contactsModified) {
    sosDoc.markModified('contacts');
  }

  recalcSOSStatus(sosDoc);
  await sosDoc.save();
};

const createSOSAlert = async (userId, payload = {}) => {
  if (!isValidObjectId(userId)) {
    throw new Error('Invalid user identifier');
  }

  const contacts = await EmergencyContact.find({
    userId,
    isActive: true,
    consentGiven: true,
  })
    .select('name email phoneNumber relationship')
    .lean();

  if (!contacts.length) {
    throw new Error('No active emergency contacts configured');
  }

  const contactsWithoutEmail = contacts.filter(c => !c.email);
  if (contactsWithoutEmail.length > 0) {
    throw new Error(`Some emergency contacts are missing email addresses: ${contactsWithoutEmail.map(c => c.name).join(', ')}`);
  }

  const contactSnapshots = contacts.map((contact) => ({
    contactId: contact._id,
    status: 'pending',
    channel: 'email',
    history: [],
    snapshot: {
      name: contact.name,
      relationship: contact.relationship,
      phoneNumber: contact.phoneNumber || null,
      email: contact.email,
    },
  }));

  const sosDoc = await SOS.create({
    userId,
    status: 'pending',
    contacts: contactSnapshots,
    location: payload.location || null,
    fallbackLocation: payload.fallbackLocation || null,
    customNote: payload.customNote || null,
    wasOffline: Boolean(payload.wasOffline),
    metadata: payload.metadata || {},
    triggeredAt: new Date(),
  });

  // Dispatch email alerts
  await dispatchEmailAlerts(sosDoc, {
    location: payload.location,
    fallbackLocation: payload.fallbackLocation,
    customNote: payload.customNote,
    metadata: payload.metadata || {},
  });

  await sosDoc.populate({
    path: 'contacts.contactId',
    select: 'name relationship phoneNumber email',
  });

  return sosDoc;
};

const createGuestSOSAlert = async (guestSessionId, payload = {}) => {
  if (!guestSessionId || typeof guestSessionId !== 'string') {
    throw new Error('Valid guest session ID is required');
  }

  if (!payload.guestContacts || !Array.isArray(payload.guestContacts) || payload.guestContacts.length === 0) {
    throw new Error('At least one emergency contact is required for guest SOS');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  for (const contact of payload.guestContacts) {
    if (!contact.name || !contact.email) {
      throw new Error('Each contact must have name and email address');
    }
    if (!emailRegex.test(contact.email)) {
      throw new Error(`Invalid email format: ${contact.email}`);
    }
    if (contact.phoneNumber) {
      const phoneRegex = /^\+[1-9]\d{1,14}$/;
      if (!phoneRegex.test(contact.phoneNumber)) {
        throw new Error(`Invalid phone number format: ${contact.phoneNumber}. Must be in E.164 format (e.g., +250788123456) or leave empty`);
      }
    }
  }

  const contactSnapshots = payload.guestContacts.map((contact) => ({
    status: 'pending',
    channel: 'email',
    history: [],
    snapshot: {
      name: contact.name,
      relationship: contact.relationship || 'other',
      phoneNumber: contact.phoneNumber || null,
      email: contact.email,
    },
  }));

  const sosDoc = await SOS.create({
    guestSessionId,
    isGuest: true,
    status: 'pending',
    contacts: contactSnapshots,
    guestContacts: payload.guestContacts.map(c => ({
      name: c.name,
      email: c.email.toLowerCase(),
      phoneNumber: c.phoneNumber || null,
      relationship: c.relationship || 'other'
    })),
    location: payload.location || null,
    fallbackLocation: payload.fallbackLocation || null,
    customNote: payload.customNote || null,
    wasOffline: Boolean(payload.wasOffline),
    metadata: payload.metadata || {},
    triggeredAt: new Date(),
  });

  // Dispatch email alerts
  await dispatchEmailAlerts(sosDoc, {
    location: payload.location,
    fallbackLocation: payload.fallbackLocation,
    customNote: payload.customNote,
    metadata: payload.metadata || {},
  });

  return sosDoc;
};

const requireOwnedSOS = async (sosId, userId) => {
  if (!isValidObjectId(sosId)) {
    throw new Error('Invalid SOS identifier');
  }

  const sosDoc = await SOS.findOne({ _id: sosId, userId });
  if (!sosDoc) {
    throw new Error('SOS alert not found');
  }

  return sosDoc;
};

const cancelSOSAlert = async (sosId, userId) => {
  const sosDoc = await requireOwnedSOS(sosId, userId);

  if (['cancelled', 'resolved'].includes(sosDoc.status)) {
    return sosDoc;
  }

  sosDoc.status = 'cancelled';
  sosDoc.cancelledAt = new Date();
  await sosDoc.save();

  return sosDoc;
};

const resolveSOSAlert = async (sosId, userId) => {
  const sosDoc = await requireOwnedSOS(sosId, userId);

  if (sosDoc.status === 'resolved') {
    return sosDoc;
  }

  sosDoc.status = 'resolved';
  sosDoc.resolvedAt = new Date();
  await sosDoc.save();

  return sosDoc;
};

const getSOSHistory = async (userId, options = {}) => {
  const limit = Math.min(Math.max(parseInt(options.limit, 10) || 20, 1), 100);
  const skip = Math.max(parseInt(options.skip, 10) || 0, 0);
  const filters = { userId };

  if (options.status) {
    filters.status = options.status;
  }

  const [items, total] = await Promise.all([
    SOS.find(filters)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('contacts.contactId', 'name relationship phoneNumber')
      .lean(),
    SOS.countDocuments(filters),
  ]);

  const page = Math.floor(skip / limit) + 1;

  return {
    data: items,
    pagination: {
      page,
      limit,
      skip,
      total,
      pages: Math.ceil(total / limit) || 1,
    },
  };
};

const retryFailedAlerts = async (sosId) => {
  if (!isValidObjectId(sosId)) {
    throw new Error('Invalid SOS identifier');
  }

  const sosDoc = await SOS.findById(sosId);
  if (!sosDoc) {
    throw new Error('SOS alert not found');
  }

  const failedCount = (sosDoc.contacts || []).filter((entry) => entry.status === 'failed').length;
  if (!failedCount) {
    throw new Error('No failed alerts to retry');
  }

  await dispatchEmailAlerts(sosDoc, {
    location: sosDoc.location,
    fallbackLocation: sosDoc.fallbackLocation,
    customNote: sosDoc.customNote,
    metadata: sosDoc.metadata || {},
  });

  await sosDoc.populate({
    path: 'contacts.contactId',
    select: 'name relationship phoneNumber email',
  });

  return sosDoc;
};

module.exports = {
  createSOSAlert,
  createGuestSOSAlert,
  cancelSOSAlert,
  resolveSOSAlert,
  getSOSHistory,
  retryFailedAlerts,
};
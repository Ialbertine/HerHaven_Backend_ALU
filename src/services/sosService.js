const mongoose = require('mongoose');
const SOS = require('../models/sos');
const EmergencyContact = require('../models/emergency');
const User = require('../models/user');
const smsService = require('./smsService');
const logger = require('../utils/logger');

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(String(value));

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

const dispatchSMSAlerts = async (sosDoc, context) => {
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
        .select('phoneNumber name')
        .lean(),
    ]);

    user = userDoc;
    contactMap = new Map(contacts.map((item) => [String(item._id), item]));
  } else if (sosDoc.isGuest && sosDoc.guestContacts) {
    sosDoc.guestContacts.forEach((guestContact, index) => {
      contactMap.set(`guest_${index}`, {
        phoneNumber: guestContact.phoneNumber,
        name: guestContact.name
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
        phoneNumber: sosDoc.guestContacts[index]?.phoneNumber,
        name: sosDoc.guestContacts[index]?.name
      };
    } else {
      contact = contactMap.get(String(record.contactId));
    }

    if (!contact || !contact.phoneNumber) {
      entry.status = 'failed';
      entry.lastAttemptAt = now;
      entry.lastError = 'Missing phone number';
      entry.history.push({
        channel: 'sms',
        status: 'failed',
        sentAt: now,
        metadata: { error: 'Missing phone number' },
      });
      contactsModified = true;
      logger.error('SOS alert failed: Missing phone number', {
        sosId: sosDoc._id,
        contactId: record.contactId || `guest_${index}`,
      });
      continue;
    }

    try {
      // Get phone number from metadata or SOS document metadata
      const helpSeekerPhone = sosDoc.metadata?.phoneNumber || context.metadata?.phoneNumber || null;

      const smsMessage = smsService.buildSOSMessage(user || { username: 'Guest User' }, {
        ...context,
        metadata: sosDoc.metadata || context.metadata || {},
        phoneNumber: helpSeekerPhone
      });

      const smsResult = await smsService.sendSMS(contact.phoneNumber, smsMessage);

      if (smsResult.success) {
        entry.status = 'sent';
        entry.channel = 'sms';
        entry.lastAttemptAt = now;
        entry.lastError = undefined;
        entry.twilioSid = smsResult.messageId;
        entry.history.push({
          channel: 'sms',
          status: 'sent',
          sentAt: now,
          metadata: { messageId: smsResult.messageId, status: smsResult.status },
        });
        logger.info(`SOS SMS alert sent successfully to ${contact.phoneNumber}`, {
          sosId: sosDoc._id,
          contactId: record.contactId || `guest_${index}`,
        });
      } else {
        throw new Error(smsResult.error || 'SMS send failed');
      }
    } catch (error) {
      entry.status = 'failed';
      entry.lastAttemptAt = now;
      entry.lastError = error.message;
      entry.history.push({
        channel: 'sms',
        status: 'failed',
        sentAt: now,
        metadata: { error: error.message },
      });

      logger.error('SOS SMS dispatch failed', {
        sosId: sosDoc._id,
        contactId: record.contactId || `guest_${index}`,
        phoneNumber: contact.phoneNumber,
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
    .select('name phoneNumber relationship')
    .lean();

  if (!contacts.length) {
    throw new Error('No active emergency contacts configured');
  }

  const contactsWithoutPhone = contacts.filter(c => !c.phoneNumber);
  if (contactsWithoutPhone.length > 0) {
    throw new Error(`Some emergency contacts are missing phone numbers: ${contactsWithoutPhone.map(c => c.name).join(', ')}`);
  }

  const contactSnapshots = contacts.map((contact) => ({
    contactId: contact._id,
    status: 'pending',
    channel: 'sms',
    history: [],
    snapshot: {
      name: contact.name,
      relationship: contact.relationship,
      phoneNumber: contact.phoneNumber,
    },
  }));

  const sosDoc = await SOS.create({
    userId,
    status: 'pending',
    contacts: contactSnapshots,
    location: payload.location || null,
    customNote: payload.customNote || null,
    wasOffline: Boolean(payload.wasOffline),
    metadata: payload.metadata || {},
    triggeredAt: new Date(),
  });

  // Dispatch SMS alerts
  await dispatchSMSAlerts(sosDoc, {
    location: payload.location,
    customNote: payload.customNote,
    metadata: payload.metadata || {},
  });

  await sosDoc.populate({
    path: 'contacts.contactId',
    select: 'name relationship phoneNumber',
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

  // If location is provided, ensure it includes an address
  if (payload.location && !payload.location.address) {
    throw new Error('If location is provided, it must include an address.');
  }

  const phoneRegex = /^\+[1-9]\d{1,14}$/;
  for (const contact of payload.guestContacts) {
    if (!contact.name || !contact.phoneNumber) {
      throw new Error('Each contact must have name and phone number');
    }
    if (!phoneRegex.test(contact.phoneNumber)) {
      throw new Error(`Invalid phone number format: ${contact.phoneNumber}.`);
    }
  }

  const contactSnapshots = payload.guestContacts.map((contact) => ({
    status: 'pending',
    channel: 'sms',
    history: [],
    snapshot: {
      name: contact.name,
      relationship: contact.relationship || 'other',
      phoneNumber: contact.phoneNumber,
    },
  }));

  const sosDoc = await SOS.create({
    guestSessionId,
    isGuest: true,
    status: 'pending',
    contacts: contactSnapshots,
    guestContacts: payload.guestContacts.map(c => ({
      name: c.name,
      phoneNumber: c.phoneNumber,
      relationship: c.relationship || 'other'
    })),
    location: payload.location || null,
    customNote: payload.customNote || null,
    wasOffline: Boolean(payload.wasOffline),
    metadata: payload.metadata || {},
    triggeredAt: new Date(),
  });

  // Dispatch SMS alerts
  await dispatchSMSAlerts(sosDoc, {
    location: payload.location,
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

  await dispatchSMSAlerts(sosDoc, {
    location: sosDoc.location,
    customNote: sosDoc.customNote,
    metadata: sosDoc.metadata || {},
  });

  await sosDoc.populate({
    path: 'contacts.contactId',
    select: 'name relationship phoneNumber',
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


const { getState, updateState, clearState } = require('./conversationState.js');

function normalizeKey(key) {
  if (typeof key !== 'string') return null;
  const trimmed = key.trim();
  return trimmed ? trimmed.toLowerCase() : null;
}

function normalizeSize(size) {
  if (typeof size !== 'string') return null;
  const upper = size.trim().toUpperCase();
  return ['S', 'M', 'L', 'XL'].includes(upper) ? upper : null;
}

function mergeSizes(current, incoming) {
  const merged = {
    serviceSize: current?.serviceSize || null,
    repaintSize: current?.repaintSize || null,
    motor_model: current?.motor_model || null,
    target_service: current?.target_service || null,
    important_notes: current?.important_notes || null,
  };

  if (incoming?.motor_model) {
    merged.motor_model = incoming.motor_model;
  }

  if (incoming?.target_service) {
    merged.target_service = incoming.target_service;
  }

  if (incoming?.important_notes) {
    merged.important_notes = incoming.important_notes;
  }

  if (typeof incoming === 'string') {
    const normalized = normalizeSize(incoming);
    if (normalized) {
      merged.serviceSize = merged.serviceSize || normalized;
      merged.repaintSize = merged.repaintSize || normalized;
    }
    return merged;
  }

  if (!incoming || typeof incoming !== 'object') {
    return merged;
  }

  const serviceCandidates = [
    incoming.serviceSize,
    incoming.service_size,
    incoming.motorSize,
    incoming.motor_size,
    incoming.size,
  ];

  for (const candidate of serviceCandidates) {
    const normalized = normalizeSize(candidate);
    if (normalized) {
      merged.serviceSize = normalized;
      break;
    }
  }

  const repaintCandidates = [
    incoming.repaintSize,
    incoming.repaint_size,
  ];

  for (const candidate of repaintCandidates) {
    const normalized = normalizeSize(candidate);
    if (normalized) {
      merged.repaintSize = normalized;
      break;
    }
  }

  if (!merged.repaintSize && merged.serviceSize) {
    merged.repaintSize = merged.serviceSize;
  }

  if (!merged.serviceSize && merged.repaintSize) {
    merged.serviceSize = merged.repaintSize;
  }

  return merged;
}

async function setMotorSizeForSender(sender, sizes) {
  const key = normalizeKey(sender);
  if (!key) return;

  const existing = await getState(key) || {
    serviceSize: null,
    repaintSize: null,
    motor_model: null,
    target_service: null,
    important_notes: null
  };
  const merged = mergeSizes(existing, sizes);

  await updateState(key, merged);
}

async function getMotorSizesForSender(sender) {
  const key = normalizeKey(sender);
  if (!key) return null;
  const entry = await getState(key);
  if (!entry) return null;
  return {
    serviceSize: entry.serviceSize || null,
    repaintSize: entry.repaintSize || null,
  };
}

async function getPreferredSizeForService(sender, category) {
  const sizes = await getMotorSizesForSender(sender);
  if (!sizes) return null;

  const normalizedCategory = typeof category === 'string' ? category.trim().toLowerCase() : '';
  if (normalizedCategory === 'repaint') {
    return sizes.repaintSize || sizes.serviceSize || null;
  }

  return sizes.serviceSize || sizes.repaintSize || null;
}

async function setPreferredSizeForService(sender, category, size) {
  const normalizedSize = normalizeSize(size);
  if (!normalizedSize) return;

  const normalizedCategory = typeof category === 'string' ? category.trim().toLowerCase() : '';
  if (normalizedCategory === 'repaint') {
    await setMotorSizeForSender(sender, { repaintSize: normalizedSize });
  } else {
    await setMotorSizeForSender(sender, { serviceSize: normalizedSize });
  }
}

async function clearMotorSizeForSender(sender) {
  const key = normalizeKey(sender);
  if (key) {
    await clearState(key);
  }
}

module.exports = {
  setMotorSizeForSender,
  getMotorSizesForSender,
  getPreferredSizeForService,
  setPreferredSizeForService,
  clearMotorSizeForSender,
};

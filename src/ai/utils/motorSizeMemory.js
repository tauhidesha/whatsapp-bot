const cache = new Map();

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
    serviceSize: current.serviceSize || null,
    repaintSize: current.repaintSize || null,
    updatedAt: Date.now(),
  };

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

function setMotorSizeForSender(sender, sizes) {
  const key = normalizeKey(sender);
  if (!key) return;

  const existing = cache.get(key) || { serviceSize: null, repaintSize: null, updatedAt: Date.now() };
  const merged = mergeSizes(existing, sizes);

  if (!merged.serviceSize && !merged.repaintSize) {
    return;
  }

  cache.set(key, merged);
}

function getMotorSizesForSender(sender) {
  const key = normalizeKey(sender);
  if (!key) return null;
  const entry = cache.get(key);
  if (!entry) return null;
  return {
    serviceSize: entry.serviceSize || null,
    repaintSize: entry.repaintSize || null,
  };
}

function getPreferredSizeForService(sender, category) {
  const sizes = getMotorSizesForSender(sender);
  if (!sizes) return null;

  const normalizedCategory = typeof category === 'string' ? category.trim().toLowerCase() : '';
  if (normalizedCategory === 'repaint') {
    return sizes.repaintSize || sizes.serviceSize || null;
  }

  return sizes.serviceSize || sizes.repaintSize || null;
}

function setPreferredSizeForService(sender, category, size) {
  const normalizedSize = normalizeSize(size);
  if (!normalizedSize) return;

  const normalizedCategory = typeof category === 'string' ? category.trim().toLowerCase() : '';
  if (normalizedCategory === 'repaint') {
    setMotorSizeForSender(sender, { repaintSize: normalizedSize });
  } else {
    setMotorSizeForSender(sender, { serviceSize: normalizedSize });
  }
}

function clearMotorSizeForSender(sender) {
  const key = normalizeKey(sender);
  if (key) {
    cache.delete(key);
  }
}

module.exports = {
  setMotorSizeForSender,
  getMotorSizesForSender,
  getPreferredSizeForService,
  setPreferredSizeForService,
  clearMotorSizeForSender,
};

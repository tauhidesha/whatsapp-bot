const DEFAULT_FREE_RADIUS_KM = parseFloat(process.env.HOME_SERVICE_FREE_RADIUS_KM || '5');
const DEFAULT_FEE_PER_KM = parseInt(process.env.HOME_SERVICE_FEE_PER_KM || '10000', 10);
const DEFAULT_BASE_FEE = parseInt(process.env.HOME_SERVICE_BASE_FEE || '0', 10);

function assertFetch() {
  if (typeof fetch !== 'function') {
    try {
      // eslint-disable-next-line global-require
      global.fetch = require('node-fetch');
    } catch (error) {
      throw new Error('fetch tidak tersedia dan node-fetch gagal di-load. Update Node.js ke versi 18+ atau install node-fetch.');
    }
  }
}

function parseNumber(value, fallback = null) {
  const parsed = typeof value === 'string' ? parseFloat(value) : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatCurrency(amount) {
  if (!Number.isFinite(amount)) return 'Rp0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(Math.round(amount));
}

async function fetchDistanceMatrix({ originLat, originLng, destLat, destLng, apiKey }) {
  assertFetch();

  const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json');
  url.searchParams.set('units', 'metric');
  url.searchParams.set('origins', `${originLat},${originLng}`);
  url.searchParams.set('destinations', `${destLat},${destLng}`);
  url.searchParams.set('key', apiKey);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Distance Matrix API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  if (data.status !== 'OK') {
    const errorMessage = data.error_message || JSON.stringify(data.status);
    throw new Error(`Distance Matrix API status not OK: ${errorMessage}`);
  }

  const element = data.rows?.[0]?.elements?.[0];
  if (!element || element.status !== 'OK') {
    const errorMessage = element?.status || 'UNKNOWN_ERROR';
    throw new Error(`Distance Matrix element error: ${errorMessage}`);
  }

  const distanceMeters = element.distance?.value;
  const durationSeconds = element.duration?.value;

  if (!Number.isFinite(distanceMeters)) {
    throw new Error('Distance Matrix response missing distance value');
  }

  return {
    distanceMeters,
    durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : null,
    distanceText: element.distance?.text || null,
    durationText: element.duration?.text || null,
    raw: data,
  };
}

function computeFee(distanceKm, { freeRadiusKm = DEFAULT_FREE_RADIUS_KM, feePerKm = DEFAULT_FEE_PER_KM, baseFee = DEFAULT_BASE_FEE } = {}) {
  const roundedDistance = Math.max(0, distanceKm);
  const effectiveFreeRadius = Math.max(0, Number.isFinite(freeRadiusKm) ? freeRadiusKm : DEFAULT_FREE_RADIUS_KM);
  const effectiveFeePerKm = Math.max(0, Number.isFinite(feePerKm) ? feePerKm : DEFAULT_FEE_PER_KM);
  const effectiveBaseFee = Math.max(0, Number.isFinite(baseFee) ? baseFee : DEFAULT_BASE_FEE);

  const extraKm = Math.max(0, roundedDistance - effectiveFreeRadius);
  const extraKmRounded = Math.ceil(extraKm * 10) / 10; // round up to nearest 100m
  const variableFee = extraKmRounded > 0 ? extraKmRounded * effectiveFeePerKm : 0;
  const additionalFee = extraKmRounded > 0 ? effectiveBaseFee + variableFee : 0;

  return {
    distanceKm: roundedDistance,
    freeRadiusKm: effectiveFreeRadius,
    extraDistanceKm: extraKmRounded,
    feePerKm: effectiveFeePerKm,
    baseFee: effectiveBaseFee,
    additionalFee,
  };
}

async function calculateHomeServiceFee({
  latitude,
  longitude,
  subtotal,
  freeRadiusKm,
  feePerKm,
  baseFee,
  overrides = {},
}) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY;
  const studioLat = parseNumber(process.env.STUDIO_LATITUDE);
  const studioLng = parseNumber(process.env.STUDIO_LONGITUDE);

  if (!apiKey) {
    return {
      success: false,
      error: 'missing_api_key',
      message: 'GOOGLE_MAPS_API_KEY belum diatur.',
    };
  }

  if (!Number.isFinite(studioLat) || !Number.isFinite(studioLng)) {
    return {
      success: false,
      error: 'missing_studio_coordinates',
      message: 'STUDIO_LATITUDE dan STUDIO_LONGITUDE belum diatur.',
    };
  }

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return {
      success: false,
      error: 'invalid_coordinates',
      message: 'Koordinat pelanggan tidak valid.',
    };
  }

  try {
    const matrix = await fetchDistanceMatrix({
      originLat: studioLat,
      originLng: studioLng,
      destLat: latitude,
      destLng: longitude,
      apiKey,
    });

    const distanceKm = matrix.distanceMeters / 1000;

    const feeResult = computeFee(distanceKm, {
      freeRadiusKm: overrides.freeRadiusKm ?? freeRadiusKm,
      feePerKm: overrides.feePerKm ?? feePerKm,
      baseFee: overrides.baseFee ?? baseFee,
    });

    const subtotalValue = Number.isFinite(subtotal) ? subtotal : null;
    const totalWithFee = subtotalValue !== null ? subtotalValue + feeResult.additionalFee : null;

    const summaryParts = [
      `Jarak dari studio: ${distanceKm.toFixed(2)} km (${matrix.durationText || 'durasi tidak tersedia'})`,
    ];
    if (feeResult.additionalFee > 0) {
      summaryParts.push(
        `Biaya tambahan dihitung setelah ${feeResult.freeRadiusKm} km: ${formatCurrency(feeResult.additionalFee)} ` +
          `(sisa jarak ${feeResult.extraDistanceKm.toFixed(1)} km × ${formatCurrency(feeResult.feePerKm)}/km` +
          (feeResult.baseFee > 0 ? ` + biaya dasar ${formatCurrency(feeResult.baseFee)}` : '') +
          `)`
      );
    } else {
      summaryParts.push(`Tidak ada biaya tambahan karena jarak masih dalam ${feeResult.freeRadiusKm} km.`);
    }

    if (subtotalValue !== null) {
      summaryParts.push(`Total layanan + home service: ${formatCurrency(totalWithFee)}.`);
    }

    return {
      success: true,
      distanceKm,
      distanceText: matrix.distanceText,
      durationText: matrix.durationText,
      additionalFee: feeResult.additionalFee,
      freeRadiusKm: feeResult.freeRadiusKm,
      extraDistanceKm: feeResult.extraDistanceKm,
      feePerKm: feeResult.feePerKm,
      baseFee: feeResult.baseFee,
      subtotal: subtotalValue,
      totalWithFee,
      summary: summaryParts.join(' '),
      raw: matrix.raw,
    };
  } catch (error) {
    console.error('[distanceMatrix] Gagal menghitung jarak:', error);
    return {
      success: false,
      error: 'distance_matrix_failed',
      message: error instanceof Error ? error.message : 'Gagal memanggil Distance Matrix API',
    };
  }
}

module.exports = {
  calculateHomeServiceFee,
  computeFee,
  formatCurrency,
};

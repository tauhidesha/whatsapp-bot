const prisma = require('../lib/prisma');

const PLATE_REGEX = /([A-Z]{1,2})\s*([0-9]{1,5})\s*([A-Z]{0,4})/gi;

function normalizePlate(plate) {
  if (!plate) return null;
  return plate.toUpperCase().replace(/\s+/g, ' ').trim();
}

function extractPlateFromText(text) {
  if (!text) return null;
  const match = text.match(PLATE_REGEX);
  return match ? normalizePlate(match[0]) : null;
}

async function createOrUpdateVehicle({ phone, modelName, plateNumber, color }) {
  const customer = await prisma.customer.findUnique({ where: { phone } });
  if (!customer) {
    throw new Error(`Customer not found: ${phone}`);
  }

  const plate = normalizePlate(plateNumber);

  if (plate) {
    const existing = await prisma.vehicle.findUnique({
      where: { plateNumber: plate }
    });

    if (existing) {
      return prisma.vehicle.update({
        where: { id: existing.id },
        data: {
          modelName: modelName || existing.modelName,
          color: color || existing.color,
          customerId: customer.id
        }
      });
    }
  }

  // Only search for existing vehicle by model if modelName is provided
  const existingByModel = modelName ? await prisma.vehicle.findFirst({
    where: {
      customerId: customer.id,
      modelName: { equals: modelName, mode: 'insensitive' },
      plateNumber: null
    }
  }) : null;

  if (existingByModel && plate) {
    return prisma.vehicle.update({
      where: { id: existingByModel.id },
      data: { plateNumber: plate, color }
    });
  }

  return prisma.vehicle.create({
    data: {
      customerId: customer.id,
      modelName,
      plateNumber: plate,
      color
    }
  });
}

async function getVehicleByPlate(plateNumber) {
  const plate = normalizePlate(plateNumber);
  if (!plate) return null;

  return prisma.vehicle.findUnique({
    where: { plateNumber: plate },
    include: {
      customer: true,
      bookings: {
        orderBy: { bookingDate: 'desc' },
        take: 10,
        include: { transaction: true }
      },
      _count: { select: { bookings: true } }
    }
  });
}

async function getCustomerVehicles(customerId) {
  return prisma.vehicle.findMany({
    where: { customerId },
    include: {
      _count: { select: { bookings: true } },
      bookings: {
        orderBy: { bookingDate: 'desc' },
        take: 1
      }
    },
    orderBy: { createdAt: 'desc' }
  });
}

async function getVehicleHistory(vehicleId) {
  return prisma.booking.findMany({
    where: { vehicleId },
    orderBy: { bookingDate: 'desc' },
    include: {
      transaction: true,
      customer: { select: { name: true, phone: true } }
    }
  });
}

async function searchVehicles(query) {
  const normalizedQuery = query.toUpperCase().replace(/\s+/g, '');

  return prisma.vehicle.findMany({
    where: {
      OR: [
        { plateNumber: { contains: normalizedQuery } },
        { modelName: { contains: query, mode: 'insensitive' } },
        {
          customer: {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { phone: { contains: query } }
            ]
          }
        }
      ]
    },
    include: {
      customer: { select: { name: true, phone: true } },
      _count: { select: { bookings: true } }
    },
    take: 50
  });
}

async function linkVehicleToBooking(bookingId, plateNumber, vehicleModel) {
  const plate = normalizePlate(plateNumber);
  if (!plate) return null;

  const vehicle = await prisma.vehicle.findUnique({
    where: { plateNumber: plate }
  });

  if (!vehicle) return null;

  return prisma.booking.update({
    where: { id: bookingId },
    data: {
      vehicleId: vehicle.id,
      plateNumber: vehicle.plateNumber,
      vehicleModel: vehicle.modelName
    }
  });
}

async function getOrCreateVehicleFromBooking(phone, modelName, plateNumber, bookingId) {
  const vehicle = await createOrUpdateVehicle({
    phone,
    modelName,
    plateNumber
  });

  if (vehicle && bookingId) {
    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        vehicleId: vehicle.id,
        plateNumber: vehicle.plateNumber,
        vehicleModel: vehicle.modelName
      }
    });
  }

  return vehicle;
}

module.exports = {
  createOrUpdateVehicle,
  getVehicleByPlate,
  getCustomerVehicles,
  getVehicleHistory,
  searchVehicles,
  linkVehicleToBooking,
  getOrCreateVehicleFromBooking,
  extractPlateFromText,
  normalizePlate
};

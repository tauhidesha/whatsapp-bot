/**
 * backfillVehicles.js
 * 
 * Backfill script: Extract plate numbers from existing Firestore bookings
 * and create Vehicle records in Prisma, then link bookings to vehicles.
 * 
 * This script is FAULT-TOLERANT:
 * - If a booking's vehicleInfo can't be parsed, it logs a warning and skips
 * - Individual errors don't crash the entire script
 * - Progress is logged for monitoring
 * 
 * Usage:
 *   node src/scripts/backfillVehicles.js
 * 
 * Prerequisites:
 *   - Prisma client must be generated: npx prisma generate
 *   - DATABASE_URL must be set in .env
 *   - (Optional) Firebase admin SDK for source data
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Plate number regex for Indonesian plates
const PLATE_REGEX = /([A-Z]{1,2})\s*([0-9]{1,5})\s*([A-Z]{0,4})/gi;

// Common motorcycle brand/model keywords for extraction
const MOTOR_KEYWORDS = [
  'honda', 'yamaha', 'suzuki', 'kawasaki', 'vespa', 'bmw', 'ducati', 'harley',
  'beat', 'vario', 'supra', 'civic', 'mio', 'nmax', 'vixion', 'rx', 'scoopy',
  ' CRF', ' CBR', ' R1', ' ninja', ' mt', ' duke', ' duke', ' domi', ' sprint',
  ' adv', ' pcx', ' sh', ' vario', ' jazz', ' brio', ' city', ' jazz'
];

function normalizePlate(plate) {
  if (!plate) return null;
  return plate.toUpperCase().replace(/\s+/g, ' ').trim();
}

function extractPlateFromText(text) {
  if (!text) return null;
  const match = text.match(PLATE_REGEX);
  return match ? normalizePlate(match[0]) : null;
}

function extractModelFromText(text) {
  if (!text) return null;
  
  // Clean the text
  const cleanText = text.toLowerCase().replace(/[()]/g, ' ');
  
  // Try to find known motorcycle models
  for (const keyword of MOTOR_KEYWORDS) {
    const regex = new RegExp(`\\b${keyword.replace(/\s+/g, '\\s*')}`, 'i');
    const match = cleanText.match(regex);
    if (match) {
      // Return the original case version
      const originalMatch = text.match(regex);
      return originalMatch ? originalMatch[0].trim() : match[0].trim();
    }
  }
  
  // Fallback: return the first part before the plate number
  const plateMatch = text.match(PLATE_REGEX);
  if (plateMatch) {
    const beforePlate = text.substring(0, plateMatch.index).trim();
    // Return the last 2-4 words before the plate
    const words = beforePlate.split(/\s+/).filter(w => w.length > 2);
    if (words.length > 0) {
      return words.slice(-3).join(' ');
    }
  }
  
  // Last resort: return the whole text (truncated)
  return text.substring(0, 50).trim();
}

async function findOrCreateCustomer(phone) {
  if (!phone) return null;
  
  const normalizedPhone = phone.replace(/[^0-9]/g, '');
  
  // Try to find existing customer
  let customer = await prisma.customer.findUnique({
    where: { phone: normalizedPhone }
  });
  
  if (customer) return customer;
  
  // Try alternative formats
  const alternatives = [
    normalizedPhone.startsWith('62') ? '0' + normalizedPhone.substring(2) : null,
    normalizedPhone.startsWith('0') ? '62' + normalizedPhone.substring(1) : null,
  ].filter(Boolean);
  
  for (const alt of alternatives) {
    customer = await prisma.customer.findUnique({
      where: { phone: alt }
    });
    if (customer) return customer;
  }
  
  return null;
}

async function createOrGetVehicle(customerId, modelName, plateNumber, color = null) {
  if (!customerId) return null;
  if (!modelName && !plateNumber) return null;
  
  const plate = normalizePlate(plateNumber);
  
  // If we have a plate number, check if vehicle already exists
  if (plate) {
    const existing = await prisma.vehicle.findUnique({
      where: { plateNumber: plate }
    });
    
    if (existing) {
      // Update model if provided
      if (modelName && existing.modelName !== modelName) {
        return prisma.vehicle.update({
          where: { id: existing.id },
          data: { modelName, color }
        });
      }
      return existing;
    }
  }
  
  // Create new vehicle
  try {
    return await prisma.vehicle.create({
      data: {
        customerId,
        modelName: modelName || 'Unknown',
        plateNumber: plate,
        color
      }
    });
  } catch (error) {
    // Handle unique constraint violation (plate already exists)
    if (error.code === 'P2002') {
      console.warn(`  ⚠️ Plate ${plate} already exists, finding existing...`);
      return prisma.vehicle.findUnique({ where: { plateNumber: plate } });
    }
    throw error;
  }
}

async function linkBookingToVehicle(bookingId, vehicleId, plateNumber, vehicleModel) {
  if (!bookingId) return;
  
  try {
    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        vehicleId,
        plateNumber: normalizePlate(plateNumber),
        vehicleModel
      }
    });
  } catch (error) {
    console.warn(`  ⚠️ Failed to update booking ${bookingId}:`, error.message);
  }
}

async function backfillFromJsonData(dataSource) {
  console.log('\n📥 Starting backfill from data source...\n');
  
  const results = {
    total: 0,
    processed: 0,
    skipped: 0,
    vehiclesCreated: 0,
    bookingsLinked: 0,
    errors: []
  };
  
  // Handle both array and object formats
  const bookings = Array.isArray(dataSource) ? dataSource 
    : (dataSource.bookings || dataSource.data || []);
  
  results.total = bookings.length;
  console.log(`📊 Total bookings to process: ${results.total}\n`);
  
  for (let i = 0; i < bookings.length; i++) {
    const booking = bookings[i];
    const progress = `[${i + 1}/${results.total}]`;
    
    try {
      // Extract data from various formats
      const phone = booking.customerPhone || booking.customer_phone || booking.phone;
      const vehicleInfo = booking.vehicleInfo || booking.vehicle_info || booking.motor || '';
      const bookingId = booking.id || booking.bookingId;
      
      // Skip if no phone or booking ID
      if (!phone && !bookingId) {
        console.log(`${progress} ⏭️  Skipping (no phone or ID)`);
        results.skipped++;
        continue;
      }
      
      // Skip if already has vehicleId
      if (booking.vehicleId) {
        console.log(`${progress} ⏭️  Skipping booking ${bookingId} (already has vehicleId)`);
        results.skipped++;
        continue;
      }
      
      // Extract plate and model
      const plate = extractPlateFromText(vehicleInfo);
      const model = extractModelFromText(vehicleInfo);
      
      if (!plate && !model) {
        console.log(`${progress} ⚠️  Skipping booking ${bookingId} (no parseable vehicle info: "${vehicleInfo}")`);
        results.skipped++;
        continue;
      }
      
      console.log(`${progress} 🔧 Processing: "${vehicleInfo}"`);
      
      // Find customer
      const customer = phone ? await findOrCreateCustomer(phone) : null;
      
      if (!customer) {
        console.log(`   ⚠️  Customer not found for phone: ${phone}`);
        results.skipped++;
        continue;
      }
      
      // Create or get vehicle
      const vehicle = await createOrGetVehicle(customer.id, model, plate);
      
      if (vehicle) {
        console.log(`   ✅ Vehicle: ${vehicle.modelName} (${vehicle.plateNumber || 'no plate'})`);
        
        // Link booking to vehicle
        if (bookingId) {
          await linkBookingToVehicle(bookingId, vehicle.id, plate, vehicle.modelName);
          console.log(`   🔗 Linked booking ${bookingId} to vehicle ${vehicle.id}`);
          results.bookingsLinked++;
        }
        
        results.vehiclesCreated++;
      }
      
      results.processed++;
      
      // Log progress every 100 items
      if ((i + 1) % 100 === 0) {
        console.log(`\n📈 Progress: ${i + 1}/${results.total} processed`);
      }
      
    } catch (error) {
      console.error(`${progress} ❌ Error:`, error.message);
      results.errors.push({ booking: booking.id || booking, error: error.message });
    }
  }
  
  return results;
}

async function verifyDataIntegrity() {
  console.log('\n🔍 Verifying data integrity...\n');
  
  // Check for bookings without vehicleId but with plateNumber in vehicleInfo
  const bookingsWithPlate = await prisma.booking.count({
    where: {
      vehicleId: null,
      NOT: { plateNumber: null }
    }
  });
  
  console.log(`📋 Bookings with plateNumber but no vehicleId: ${bookingsWithPlate}`);
  
  // Check for customers without vehicles
  const customers = await prisma.customer.count();
  const customersWithVehicles = await prisma.customer.count({
    where: {
      vehicles: { some: {} }
    }
  });
  
  console.log(`📋 Total customers: ${customers}`);
  console.log(`📋 Customers with vehicles: ${customersWithVehicles}`);
  
  // Note: Since customerId is required in Vehicle model, orphaned vehicles cannot exist
  // All vehicles must have a valid customerId (enforced by foreign key)
  console.log(`📋 Orphaned vehicles: 0 (customerId is required)`);
  
  return { bookingsWithPlate, customers, customersWithVehicles };
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🚗  Vehicle Backfill Script');
  console.log('═══════════════════════════════════════════════════════\n');
  
  const startTime = Date.now();
  
  try {
    // For Firebase data, you would load it here
    // const firebaseData = await loadFirebaseData();
    // await backfillFromJsonData(firebaseData);
    
    // For demo/testing with existing Prisma data:
    // This will scan existing bookings and link vehicles
    
    console.log('📌 Mode: Process existing bookings from Prisma\n');
    
    // Get all bookings without vehicleId
    const bookingsToProcess = await prisma.booking.findMany({
      where: { vehicleId: null },
      select: {
        id: true,
        customerId: true,
        customerPhone: true,
        plateNumber: true,
        vehicleModel: true
      },
      take: 1000 // Process in batches
    });
    
    console.log(`📊 Found ${bookingsToProcess.length} bookings without vehicleId\n`);
    
    const results = {
      total: bookingsToProcess.length,
      processed: 0,
      skipped: 0,
      vehiclesCreated: 0,
      bookingsLinked: 0,
      errors: []
    };
    
    for (let i = 0; i < bookingsToProcess.length; i++) {
      const booking = bookingsToProcess[i];
      const progress = `[${i + 1}/${results.total}]`;
      
      try {
        if (!booking.customerId) {
          console.log(`${progress} ⏭️  Skipping (no customerId)`);
          results.skipped++;
          continue;
        }
        
        // Get customer phone
        const customer = await prisma.customer.findUnique({
          where: { id: booking.customerId },
          select: { phone: true, name: true }
        });
        
        if (!customer) {
          console.log(`${progress} ⏭️  Skipping (customer not found)`);
          results.skipped++;
          continue;
        }
        
        const vehicleInfo = `${booking.vehicleModel || ''} ${booking.plateNumber || ''}`.trim();
        
        if (!vehicleInfo) {
          console.log(`${progress} ⏭️  Skipping (no vehicle info)`);
          results.skipped++;
          continue;
        }
        
        const plate = extractPlateFromText(vehicleInfo);
        const model = booking.vehicleModel || extractModelFromText(vehicleInfo);
        
        console.log(`${progress} 🔧 Processing: "${vehicleInfo}"`);
        
        const vehicle = await createOrGetVehicle(booking.customerId, model, plate);
        
        if (vehicle) {
          console.log(`   ✅ Vehicle: ${vehicle.modelName} (${vehicle.plateNumber || 'no plate'})`);
          
          await prisma.booking.update({
            where: { id: booking.id },
            data: {
              vehicleId: vehicle.id,
              plateNumber: vehicle.plateNumber,
              vehicleModel: vehicle.modelName
            }
          });
          
          console.log(`   🔗 Linked booking to vehicle`);
          results.bookingsLinked++;
          results.vehiclesCreated++;
        }
        
        results.processed++;
        
      } catch (error) {
        console.error(`${progress} ❌ Error:`, error.message);
        results.errors.push({ bookingId: booking.id, error: error.message });
      }
    }
    
    // Verify integrity
    await verifyDataIntegrity();
    
    // Summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('📊 BACKFILL SUMMARY');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`⏱️  Duration: ${duration} seconds`);
    console.log(`📦 Total processed: ${results.processed}`);
    console.log(`⏭️  Skipped: ${results.skipped}`);
    console.log(`🚗 Vehicles created/linked: ${results.vehiclesCreated}`);
    console.log(`🔗 Bookings linked: ${results.bookingsLinked}`);
    console.log(`❌ Errors: ${results.errors.length}`);
    
    if (results.errors.length > 0) {
      console.log('\n⚠️  Error Details:');
      results.errors.slice(0, 10).forEach(e => {
        console.log(`   - ${e.bookingId || 'unknown'}: ${e.error}`);
      });
      if (results.errors.length > 10) {
        console.log(`   ... and ${results.errors.length - 10} more errors`);
      }
    }
    
    console.log('\n✅ Backfill complete!\n');
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Export for programmatic use
module.exports = {
  extractPlateFromText,
  extractModelFromText,
  normalizePlate,
  backfillFromJsonData,
  verifyDataIntegrity
};

// Run if executed directly
if (require.main === module) {
  main();
}

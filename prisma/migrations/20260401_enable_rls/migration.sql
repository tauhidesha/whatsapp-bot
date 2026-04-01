-- Enable Row Level Security on ALL tables
-- This is the P0 fix for the Supabase security alert.
-- 
-- WHY: Without RLS, the Supabase anon key (exposed in frontend)
-- grants full read/write access to ALL tables.
--
-- SAFETY: Prisma uses DATABASE_URL (postgres role) which bypasses RLS.
-- Only Supabase client connections (anon/authenticated) are affected.

-- ===== STEP 1: Enable RLS on all tables =====
ALTER TABLE "Customer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Vehicle" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DirectMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Booking" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Transaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CustomerContext" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CoatingMaintenance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "HandoverSnooze" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CustomerLocation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KeyValueStore" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VehicleModel" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Service" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ServicePrice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Surcharge" ENABLE ROW LEVEL SECURITY;

-- ===== STEP 2: Supabase Realtime Policies =====
-- The admin-frontend uses Supabase Realtime to listen for changes
-- on Customer and DirectMessage tables. We need SELECT policies
-- so that the realtime subscription receives events.
-- 
-- These policies allow SELECT-only access via anon/authenticated roles.
-- All INSERT/UPDATE/DELETE are DENIED (no policy = denied when RLS is on).

-- Realtime needs to see Customer updates (for conversation list refresh)
CREATE POLICY "realtime_select_customer"
  ON "Customer"
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Realtime needs to see new DirectMessage inserts (for live chat)
CREATE POLICY "realtime_select_directmessage"
  ON "DirectMessage"
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Public read access to services/prices (used by frontend for display)
CREATE POLICY "public_read_vehiclemodel"
  ON "VehicleModel"
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "public_read_service"
  ON "Service"
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "public_read_serviceprice"
  ON "ServicePrice"
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "public_read_surcharge"
  ON "Surcharge"
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Booking: read-only for realtime (admin dashboard shows bookings)
CREATE POLICY "realtime_select_booking"
  ON "Booking"
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Transaction: read-only for finance dashboard
CREATE POLICY "realtime_select_transaction"
  ON "Transaction"
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Vehicle: read-only for CRM display
CREATE POLICY "realtime_select_vehicle"
  ON "Vehicle"
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- ===== STEP 3: Deny all writes via Supabase client =====
-- No INSERT/UPDATE/DELETE policies = all writes BLOCKED for anon/authenticated.
-- Only the postgres role (used by Prisma via DATABASE_URL) can write.
-- This is intentional: all data mutations go through the backend API.

#!/usr/bin/env node
/**
 * One-time backfill: Reset reviewFollowUpSent for customers who completed
 * service but never received a review follow-up due to the bug where
 * CustomerContext flags were not reset on booking COMPLETED.
 *
 * This script cross-checks chat history for the Google review link to avoid
 * false positives (customers who already received a review message).
 *
 * Usage:
 *   node scripts/backfill-review-flags.js          # dry-run (preview only)
 *   node scripts/backfill-review-flags.js --apply   # actually update DB
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const REVIEW_LINK = 'g.page/r/Cb2npq6EDStKEBI/review';

async function main() {
  const apply = process.argv.includes('--apply');
  console.log(`\n🔍 Backfill Review Flags — ${apply ? '⚡ APPLY MODE' : '👀 DRY RUN'}\n`);

  // ── Step 1: Fix stale records — patch lastReviewAt for customers who ──────
  // already received a review message (detectable via chat history containing
  // the Google review link) but have lastReviewAt = null.
  const staleContexts = await prisma.customerContext.findMany({
    where: {
      reviewFollowUpSent: true,
      lastReviewAt: null,
    },
    include: {
      customer: {
        include: {
          messages: {
            where: {
              role: 'assistant',
              content: { contains: 'g.page' },
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
          }
        }
      }
    }
  });

  let patchedCount = 0;
  for (const ctx of staleContexts) {
    const reviewMsg = ctx.customer?.messages?.[0];
    if (reviewMsg) {
      console.log(`  🔧 Patching lastReviewAt for ${ctx.customer?.name || ctx.phone} (review sent ${reviewMsg.createdAt.toISOString().slice(0, 10)})`);
      if (apply) {
        await prisma.customerContext.update({
          where: { id: ctx.id },
          data: { lastReviewAt: reviewMsg.createdAt }
        });
        patchedCount++;
      }
    }
  }

  if (patchedCount > 0 || staleContexts.length > 0) {
    console.log(`\n  ${apply ? `✅ Patched ${patchedCount}` : `ℹ️  Would patch ${staleContexts.filter(c => c.customer?.messages?.length > 0).length}`} stale lastReviewAt record(s)\n`);
  }

  // ── Step 2: Find truly missed customers ────────────────────────────────────
  // Customers who:
  // 1. Have lastService set (completed a booking)
  // 2. reviewFollowUpSent is true BUT never actually received a review message
  //    OR reviewFollowUpSent stuck from previous service cycle
  // 3. No review link found in their chat history
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const candidates = await prisma.customer.findMany({
    where: {
      lastService: { not: null, gte: thirtyDaysAgo },
    },
    include: {
      customerContext: true,
      bookings: {
        where: { status: 'COMPLETED' },
        orderBy: { bookingDate: 'desc' },
        take: 1,
      },
      messages: {
        where: {
          role: 'assistant',
          content: { contains: 'g.page' },
        },
        take: 1,
      }
    }
  });

  // Filter to only those who truly never got a review message
  const missed = candidates.filter(c => {
    const hasReviewMsg = c.messages.length > 0;
    const ctx = c.customerContext;
    if (!ctx) return false;
    // Already received review → skip
    if (hasReviewMsg) return false;
    if (ctx.lastReviewAt) return false;
    // reviewFollowUpSent is true (stuck) but no actual review sent → needs reset
    // OR reviewFollowUpSent is false but within window and has active booking blocking it
    return true;
  });

  if (missed.length === 0) {
    console.log('✅ No customers truly missed their review follow-up.');
    await prisma.$disconnect();
    return;
  }

  console.log(`Found ${missed.length} customer(s) who genuinely missed review follow-ups:\n`);

  let resetCount = 0;
  for (const c of missed) {
    const ctx = c.customerContext;
    const lastService = c.lastService ? new Date(c.lastService) : null;
    const daysSince = lastService
      ? Math.floor((now - lastService) / (1000 * 60 * 60 * 24))
      : null;
    const lastBooking = c.bookings[0];

    const raw = (lastBooking?.serviceType || '').toLowerCase();
    let serviceType = null;
    if (raw.includes('coating')) serviceType = 'coating';
    else if (raw.includes('repaint') || raw.includes('cat')) serviceType = 'repaint';
    else if (raw.includes('detail') || raw.includes('poles') || raw.includes('cuci')) serviceType = 'detailing';

    const eligible = daysSince !== null && daysSince >= 3 && daysSince <= 30;

    console.log(
      `  ${eligible ? '🟢' : '🔴'} ${c.name || c.phone} — ` +
      `lastService: ${daysSince}d ago, ` +
      `serviceType: ${serviceType || 'unknown'}, ` +
      `label: ${ctx?.customerLabel || '-'}, ` +
      `reviewSent: ${ctx?.reviewFollowUpSent}` +
      `${eligible ? '' : ' (>30 days, scheduler won\'t pick up)'}`
    );

    if (apply && ctx) {
      await prisma.customerContext.update({
        where: { id: ctx.id },
        data: {
          reviewFollowUpSent: false,
          lastServiceAt: lastService,
          ...(serviceType ? { lastServiceType: serviceType } : {}),
        }
      });
      resetCount++;
    }
  }

  console.log(`\n${apply
    ? `✅ Reset ${resetCount} customer context(s). They will be picked up by the next scheduler run.`
    : `ℹ️  Run with --apply to reset flags:\n   node scripts/backfill-review-flags.js --apply`
  }\n`);

  await prisma.$disconnect();
}

main().catch(e => {
  console.error('❌ Backfill failed:', e);
  prisma.$disconnect();
  process.exit(1);
});

/**
 * Progress Update Routes
 * Handles upload, listing, and manual send trigger for motor progress updates.
 *
 * Routes:
 *   GET  /api/progress/bookings/active          — List active bookings (for dashboard picker)
 *   GET  /api/progress/booking/:bookingId       — List progress updates for a booking
 *   POST /api/progress/upload                   — Upload media + save to DB (+ optional auto-send)
 *   POST /api/progress/:progressId/send         — Manually trigger send to customer
 */

const express = require('express');
const multer  = require('multer');
const prisma  = require('../../lib/prisma');
const { uploadToCloudinary } = require('../../lib/cloudinary');
const { requireAuth } = require('../../middleware/auth');

const router = express.Router();

// multer: store in memory (we'll stream to Cloudinary)
const upload = multer({
    storage: multer.memoryStorage(),
    limits:  { fileSize: 100 * 1024 * 1024 }, // 100MB per file
    fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/mpeg'];
        cb(null, allowed.includes(file.mimetype));
    }
});

// ─── GET /api/progress/bookings/active ────────────────────────────────────────
router.get('/bookings/active', requireAuth, async (req, res) => {
    try {
        const STATUS_ACTIVE = ['PENDING', 'CONFIRMED', 'IN_QUEUE', 'IN_PROGRESS'];
        const bookings = await prisma.booking.findMany({
            where: { status: { in: STATUS_ACTIVE } },
            orderBy: { bookingDate: 'desc' },
            take: 100,
            select: {
                id: true,
                status: true,
                serviceType: true,
                bookingDate: true,
                vehicleModel: true,
                plateNumber: true,
                customerName: true,
                customerPhone: true,
                customer: { select: { name: true, phone: true } },
            }
        });

        const formatted = bookings.map(b => ({
            id: b.id,
            label: `${b.vehicleModel || 'Motor'} — ${b.customerName || b.customer?.name || 'Customer'}${b.plateNumber ? ` (${b.plateNumber})` : ''}`,
            customerName: b.customerName || b.customer?.name || 'Customer',
            customerPhone: b.customerPhone || b.customer?.phone || null,
            vehicleModel: b.vehicleModel || 'Motor',
            plateNumber: b.plateNumber || null,
            service: b.serviceType,
            status: b.status,
            bookingDate: b.bookingDate,
        }));

        res.json({ success: true, data: formatted });
    } catch (err) {
        console.error('[progressRoutes] GET /bookings/active error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ─── GET /api/progress/booking/:bookingId ─────────────────────────────────────
router.get('/booking/:bookingId', requireAuth, async (req, res) => {
    try {
        const { bookingId } = req.params;
        const updates = await prisma.progressUpdate.findMany({
            where: { bookingId },
            orderBy: { createdAt: 'desc' },
        });
        res.json({ success: true, data: updates });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ─── POST /api/progress/upload ────────────────────────────────────────────────
router.post('/upload', requireAuth, upload.array('media', 10), async (req, res) => {
    try {
        const { bookingId, caption = '', autoSend = 'true' } = req.body;

        if (!bookingId) return res.status(400).json({ success: false, error: 'bookingId required' });
        if (!req.files || req.files.length === 0) return res.status(400).json({ success: false, error: 'No media files uploaded' });

        // Verify booking exists
        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: { customer: { select: { phone: true } } }
        });
        if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });

        // Upload all files to Cloudinary
        const uploadResults = await Promise.all(
            req.files.map(file => {
                const resourceType = file.mimetype.startsWith('video') ? 'video' : 'image';
                return uploadToCloudinary(file.buffer, { resourceType, folder: 'bosmat-progress' })
                    .then(result => ({ ...result, originalMime: file.mimetype }));
            })
        );

        const mediaUrls  = uploadResults.map(r => r.url);
        const mediaTypes = uploadResults.map(r => r.resourceType);

        // Save to DB
        const progressUpdate = await prisma.progressUpdate.create({
            data: { bookingId, mediaUrls, mediaTypes, caption: caption || null }
        });

        // Auto-send if requested
        const shouldAutoSend = autoSend === 'true' || autoSend === true;
        let sendResult = null;
        if (shouldAutoSend) {
            try {
                const { sendProgressUpdate } = require('../../ai/utils/progressSender');
                const phone = booking.customerPhone || booking.customer?.phone;
                sendResult = await sendProgressUpdate(progressUpdate.id, phone);
            } catch (sendErr) {
                console.error('[progressRoutes] Auto-send failed:', sendErr.message);
                sendResult = { success: false, error: sendErr.message };
            }
        }

        res.json({ success: true, data: progressUpdate, sent: sendResult });
    } catch (err) {
        console.error('[progressRoutes] POST /upload error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ─── POST /api/progress/:progressId/send ──────────────────────────────────────
router.post('/:progressId/send', requireAuth, async (req, res) => {
    try {
        const { progressId } = req.params;
        const update = await prisma.progressUpdate.findUnique({
            where: { id: progressId },
            include: { booking: { include: { customer: { select: { phone: true } } } } }
        });
        if (!update) return res.status(404).json({ success: false, error: 'Progress update not found' });

        const phone = update.booking.customerPhone || update.booking.customer?.phone;
        if (!phone) return res.status(400).json({ success: false, error: 'Customer phone not found' });

        const { sendProgressUpdate } = require('../../ai/utils/progressSender');
        const result = await sendProgressUpdate(progressId, phone);
        res.json(result);
    } catch (err) {
        console.error('[progressRoutes] POST /:id/send error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;

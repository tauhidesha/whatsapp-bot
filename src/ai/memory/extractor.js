const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { DateTime } = require('luxon');
const { extractTextFromContent, getMessageType } = require('../graph/utils/sanitizeMessages');

/**
 * Memory Extractor for Zoya V2 — LLM-as-State-Manager
 *
 * Philosophy: LLM receives the FULL current state + new message, and outputs
 * the CANONICAL FINAL state. No regex fallbacks, no manual conflict resolution.
 * The LLM understands context — trust it.
 *
 * Booking date/time is verified post-LLM with luxon (not regex) for accuracy.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve a relative date string from LLM (e.g. "besok", "senin", "2026-08-01")
 * into an absolute YYYY-MM-DD date using luxon.
 * Returns null if the value cannot be resolved.
 */
function resolveBookingDate(rawValue) {
    if (!rawValue) return null;
    const now = DateTime.now().setZone('Asia/Jakarta').setLocale('id');
    const val = String(rawValue).toLowerCase().trim();

    // Already an ISO date
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;

    // Relative day keywords
    const relativeMap = {
        'hari ini': 0, 'sekarang': 0, 'today': 0,
        'besok': 1, 'tomorrow': 1,
        'lusa': 2, 'day after tomorrow': 2,
        'senin': 1, 'monday': 1,
        'selasa': 2, 'tuesday': 2,
        'rabu': 3, 'wednesday': 3,
        'kamis': 4, 'thursday': 4,
        'jumat': 5, 'friday': 5,
        'sabtu': 6, 'saturday': 6,
    };

    if (val in relativeMap && relativeMap[val] <= 2) {
        return now.plus({ days: relativeMap[val] }).toFormat('yyyy-MM-dd');
    }

    // Day-of-week: find next occurrence
    const dayOfWeekMap = { senin: 1, selasa: 2, rabu: 3, kamis: 4, jumat: 5, sabtu: 6, minggu: 7 };
    for (const [day, iso] of Object.entries(dayOfWeekMap)) {
        if (val.includes(day)) {
            let target = now;
            while (target.weekday !== iso) target = target.plus({ days: 1 });
            return target.toFormat('yyyy-MM-dd');
        }
    }

    // "tanggal N" or "tgl N"
    const tglMatch = val.match(/(?:tanggal|tgl)\s*(\d{1,2})/);
    if (tglMatch) {
        const day = parseInt(tglMatch[1], 10);
        let candidate = now.set({ day });
        if (candidate < now) candidate = candidate.plus({ months: 1 });
        return candidate.toFormat('yyyy-MM-dd');
    }

    // Fallback: return as-is if it looks like a date
    return null;
}

/**
 * Normalize a time string like "jam 10", "10:30", "pagi", "sore" → "HH:mm"
 */
function resolveBookingTime(rawValue) {
    if (!rawValue) return null;
    const val = String(rawValue).toLowerCase().trim();

    const hmMatch = val.match(/(\d{1,2})[.:](\d{2})/);
    if (hmMatch) return `${hmMatch[1].padStart(2, '0')}:${hmMatch[2]}`;

    const hMatch = val.match(/(?:jam\s*)?(\d{1,2})/);
    if (hMatch) return `${hMatch[1].padStart(2, '0')}:00`;

    const keywords = { pagi: '09:00', siang: '12:00', sore: '15:00', malam: '19:00' };
    for (const [k, v] of Object.entries(keywords)) {
        if (val.includes(k)) return v;
    }

    return null;
}

// ---------------------------------------------------------------------------
// Main extractor
// ---------------------------------------------------------------------------

async function extractMemory(state) {
    console.log('[Memory Extractor] Running LLM-as-State-Manager...');

    const messages = state.messages || [];
    const lastUserMessageObj = [...messages].reverse().find(m => {
        const type = getMessageType(m) || 'user';
        return type === 'human' || type === 'user';
    });

    const lastUserContent = lastUserMessageObj
        ? (lastUserMessageObj.kwargs?.content || lastUserMessageObj.content)
        : null;

    if (!lastUserContent) return {};

    const lastUserMessageText = extractTextFromContent(lastUserContent);

    // Build a short transcript (last 6 messages) for context
    const recentMessages = messages.slice(-6);
    const transcript = recentMessages.map(m => {
        const type = getMessageType(m);
        const text = extractTextFromContent(m.kwargs?.content || m.content || '');
        if (!text.trim()) return null;
        return `[${type === 'human' || type === 'user' ? 'USER' : 'AI'}]: ${text.trim()}`;
    }).filter(Boolean).join('\n');

    // Current state snapshot for LLM to reason about
    const currentMotor = typeof state.vehicle?.model === 'string'
        ? state.vehicle.model
        : (state.vehicle?.model?.value || null);
    const currentServices = state.consultation?.requestedServices || [];
    const currentColor = typeof state.vehicle?.paintType === 'string'
        ? state.vehicle.paintType
        : (state.vehicle?.paintType?.value || null);
    const currentColorChoice = state.consultation?.knownFacts?.paintColor?.value
        || state.consultation?.knownFacts?.paintColor
        || null;
    const lastOffered = state.last_offered_services || [];

    const now = DateTime.now().setZone('Asia/Jakarta').setLocale('id');
    const currentDateTime = now.toFormat("cccc, dd MMMM yyyy HH:mm 'WIB'");

    const llm = new ChatGoogleGenerativeAI({
        model: process.env.VISION_MODEL || process.env.AI_MODEL || 'gemini-1.5-flash-latest',
        temperature: 0,
        maxOutputTokens: 768,
        apiKey: process.env.GOOGLE_API_KEY,
        responseMimeType: 'application/json',
    });

    const systemPrompt = `Kamu adalah State Manager untuk chatbot Bosmat Repaint Studio.
Tugasmu: Baca STATE SAAT INI + PERCAKAPAN TERAKHIR, lalu tentukan STATE FINAL yang benar.

WAKTU SEKARANG: ${currentDateTime}

STATE SAAT INI:
- Motor: ${currentMotor || 'belum diketahui'}
- Layanan yang sudah dipilih: ${currentServices.length > 0 ? currentServices.join(', ') : 'belum ada'}
- Warna cat motor: ${currentColor || currentColorChoice || 'belum diketahui'}
- Layanan terakhir yang AI tawarkan (untuk resolve pronoun): ${lastOffered.length > 0 ? lastOffered.join(', ') : 'tidak ada'}

PERCAKAPAN TERAKHIR:
${transcript}

ATURAN KEPUTUSAN (PENTING — baca semua sebelum output):

1. MOTOR:
   - Hanya ganti motor jika user secara jelas menyebut motor yang BERBEDA dan BARU.
   - Jika user hanya membalas pertanyaan AI (misal: AI tanya warna, user jawab "merah"), JANGAN ubah motor.
   - Jika user sebut nama motor yang sama dengan variasi ejaan (nmax/n-max), anggap sama.
   - Jika tidak ada perubahan motor → kembalikan nilai saat ini.

2. LAYANAN (requestedServices):
   - Kembalikan DAFTAR LENGKAP layanan yang masih diinginkan user setelah pesan ini.
   - Jika user hanya menjawab pertanyaan detail (warna, jadwal, dll) → PERTAHANKAN semua layanan yang sudah ada.
   - Jika user menyebut "aja" / "saja" dalam konteks menjawab pertanyaan → JANGAN hapus layanan lain.
   - Hanya hapus layanan jika user secara tegas membatalkan/mengganti (contoh: "batal yang kasar", "gak jadi kasar", "cancel kasar").
   - Jika user menjawab pronoun ("itu aja", "yang itu", "mau") → resolve ke layanan terakhir yang AI tawarkan (last_offered_services).
   - Layanan yang valid: "Repaint Bodi Halus", "Repaint Bodi Kasar", "Repaint Velg", "Repaint CVT", "Repaint Full Bodi", "Detailing Mesin", "Cuci Komplit", "Coating Motor Glossy", "Coating Motor Doff", "Poles Bodi Glossy", "Full Detailing Glossy", "Complete Service Glossy", "Complete Service Doff"

3. WARNA:
   - color_choice: warna bodi yang diinginkan untuk repaint (cat baru)
   - paint_type_current: tipe cat motor SAAT INI (glossy/doff) — hanya update jika user menyebutnya
   - Bedakan keduanya dengan teliti.

4. BOOKING:
   - Untuk bookingDate, kembalikan nilai string apa adanya (misal: "besok", "senin", "tanggal 5"). Sistem akan resolve ke tanggal absolut.
   - Untuk bookingTime, kembalikan jam apa adanya (misal: "jam 10", "10:30", "sore").

5. FOTO/VISUAL:
   - Jika pesan terakhir mengandung gambar, isi visualSummary dengan deskripsi singkat 1-2 kalimat.

Output format JSON:
{
  "motor": "nama motor final (null jika tidak ada perubahan dan belum diketahui)",
  "requestedServices": ["daftar layanan FINAL yang diinginkan user"],
  "color_choice": "warna bodi baru yang diinginkan (null jika belum disebutkan)",
  "paint_type_current": "glossy/doff/matte (null jika tidak disebutkan)",
  "velg_color_choice": "warna velg (null jika belum disebutkan)",
  "velg_condition": "ori/sudah repaint/null",
  "has_damage": true/false/null,
  "objection": "keberatan user jika ada (null jika tidak ada)",
  "booking_date_raw": "string tanggal apa adanya dari user (null jika tidak sebut)",
  "booking_time_raw": "string jam apa adanya dari user (null jika tidak sebut)",
  "target_service": "layanan yang ditanya/diclarify (null jika tidak relevan)",
  "needs_clarification": true/false,
  "visual_summary": "ringkasan foto jika ada (null jika tidak ada foto)",
  "reasoning": "penjelasan singkat kenapa kamu membuat keputusan ini"
}`;

    try {
        const { SystemMessage, HumanMessage } = require('@langchain/core/messages');

        // Build vision-aware content (support image messages)
        const visionContent = [{ type: 'text', text: `Pesan terakhir user:` }];
        if (Array.isArray(lastUserContent)) {
            const filtered = lastUserContent.filter(c => c.type !== 'thinking');
            visionContent.push(...filtered);
        } else {
            visionContent.push({ type: 'text', text: lastUserContent || '[Tanpa Teks]' });
        }

        const response = await llm.invoke([
            new SystemMessage(systemPrompt),
            new HumanMessage({ content: visionContent }),
        ]);

        const rawText = typeof response.content === 'string'
            ? response.content
            : extractTextFromContent(response.content);

        const cleaned = rawText.replace(/```json\n?|```/g, '').trim();
        const ex = JSON.parse(cleaned);

        console.log('[Memory Extractor] LLM Decision:', ex.reasoning || '(no reasoning)');
        console.log('[Memory Extractor] Final services:', ex.requestedServices);

        const updates = {};

        // --- Vehicle ---
        const newMotor = ex.motor || currentMotor;
        const newPaintType = ex.paint_type_current;
        if (newMotor || newPaintType) {
            updates.vehicle = { ...state.vehicle };
            if (newMotor) updates.vehicle.model = { value: newMotor, state: 'KNOWN' };
            if (newPaintType) updates.vehicle.paintType = { value: newPaintType, state: 'KNOWN' };
        }

        // --- Consultation ---
        const needsConsultationUpdate =
            ex.requestedServices?.length >= 0 ||
            ex.color_choice ||
            ex.velg_color_choice ||
            ex.velg_condition ||
            ex.has_damage !== undefined ||
            ex.objection ||
            ex.target_service ||
            ex.needs_clarification !== undefined;

        if (needsConsultationUpdate) {
            updates.consultation = { ...state.consultation };
            updates.consultation.knownFacts = { ...(state.consultation?.knownFacts || {}) };

            // Services: LLM is the authority
            if (Array.isArray(ex.requestedServices)) {
                updates.consultation.requestedServices = ex.requestedServices;
            }

            // Color choice for repaint
            if (ex.color_choice) {
                updates.consultation.knownFacts.paintColor = { value: ex.color_choice, state: 'KNOWN' };
            }

            // Velg color
            if (ex.velg_color_choice) {
                updates.consultation.knownFacts.velgColor = { value: ex.velg_color_choice, state: 'KNOWN' };
            }

            // Velg condition (previously painted or original)
            if (ex.velg_condition) {
                updates.consultation.knownFacts.velgCondition = { value: ex.velg_condition, state: 'KNOWN' };
            }

            // Damage flag
            if (ex.has_damage !== undefined && ex.has_damage !== null) {
                updates.consultation.knownFacts.hasDamage = ex.has_damage;
            }

            // Objection
            if (ex.objection) {
                updates.consultation.knownFacts.commonObjection = { value: ex.objection, state: 'KNOWN' };
            }

            // Coreference resolution fields
            if (ex.target_service) {
                updates.consultation.knownFacts.targetService = ex.target_service;
            }
            if (ex.needs_clarification !== undefined) {
                updates.consultation.knownFacts.needsClarification = ex.needs_clarification;
            }
        }

        // --- Booking date/time (luxon-verified) ---
        if (ex.booking_date_raw || ex.booking_time_raw) {
            updates.consultation = updates.consultation || { ...state.consultation };
            updates.consultation.knownFacts = updates.consultation.knownFacts || { ...(state.consultation?.knownFacts || {}) };

            const resolvedDate = resolveBookingDate(ex.booking_date_raw);
            const resolvedTime = resolveBookingTime(ex.booking_time_raw);

            if (resolvedDate) {
                const currentBD = state.consultation?.knownFacts?.bookingDate;
                if (!currentBD || currentBD.state !== 'KNOWN') {
                    updates.consultation.knownFacts.bookingDate = { state: 'KNOWN', value: resolvedDate };
                }
            }
            if (resolvedTime) {
                const currentBT = state.consultation?.knownFacts?.bookingTime;
                if (!currentBT || currentBT.state !== 'KNOWN') {
                    updates.consultation.knownFacts.bookingTime = { state: 'KNOWN', value: resolvedTime };
                }
            }
        }

        // --- Visual summary ---
        if (ex.visual_summary) {
            updates.metadata = { ...(state.metadata || {}), visualSummary: ex.visual_summary };
        }

        return updates;

    } catch (error) {
        console.error('[Memory Extractor] LLM Error — returning empty update (state preserved):', error.message);
        // Return empty: LangGraph will keep existing state untouched
        return {};
    }
}

module.exports = { extractMemory };

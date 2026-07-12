import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, MessageCircle, ArrowRight, Sparkles, MapPin, Search, Loader2 } from 'lucide-react';
import masterLayanan from './data/masterLayanan';
import studioMetadata from './data/studioMetadata';

// ─────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

// ─────────────────────────────────────────────
// DECISION TREE (mirrors chatbot conversation-rules.md)
// ─────────────────────────────────────────────

const INTENT_CHOICES = [
  {
    id: 'detailing',
    emoji: '✨',
    title: 'Bersihin / Poles / Coating',
    sub: 'Motor kusam, kotor, atau mau proteksi cat',
  },
  {
    id: 'repaint',
    emoji: '🎨',
    title: 'Cat Ulang (Repaint)',
    sub: 'Ganti warna, lecet parah, atau refresh tampilan',
  },
  {
    id: 'konsul',
    emoji: '🤔',
    title: 'Gak tau, mau konsultasi aja',
    sub: 'Bingung butuh apa, pengen saran langsung',
  },
];

// DETAILING BRANCH (from conversation-rules.md Section B)
const DETAILING_DEPTH = [
  { id: 'bodi_only', emoji: '🏍️', title: 'Bodi & kaki-kaki aja', sub: 'Ga perlu bongkar rangka' },
  { id: 'full_bongkar', emoji: '🔧', title: 'Sampai rangka (bongkar total)', sub: 'Bersih luar-dalam kayak baru' },
  { id: 'mesin_only', emoji: '🛢️', title: 'Mesin aja', sub: 'Kerak oli, area mesin kotor' },
];

const PAINT_TYPE = [
  { id: 'glossy', emoji: '💎', title: 'Glossy (Mengkilap)', sub: 'Cat standar mengkilap' },
  { id: 'doff', emoji: '🌑', title: 'Doff / Matte', sub: 'Cat doff / matte finish' },
  { id: 'gatau', emoji: '🤷', title: 'Gatau / Bingung', sub: 'Nanti konsul langsung aja' },
];

// REPAINT BRANCH (from conversation-rules.md Section C)
const REPAINT_AREA = [
  { id: 'bodi_halus', emoji: '🚀', title: 'Bodi Halus (Full Body)', sub: 'Cat ulang semua panel bodi' },
  { id: 'bodi_kasar', emoji: '⬛', title: 'Bodi Kasar / Dek', sub: 'Hitamkan bagian kasar yang kusam' },
  { id: 'velg', emoji: '🔘', title: 'Velg Motor', sub: 'Cat ulang pelek / kaki-kaki' },
  { id: 'full', emoji: '👑', title: 'Full Bodi (Halus + Kasar)', sub: 'Semua panel, sultan mode' },
];

// TESTIMONIALS per branch
const TESTIMONIALS = {
  detailing: {
    quote: '"Mesin bersih, bodi kinclong, kaki-kaki rapi. Dikerjain owner langsung, jadi hasilnya konsisten banget."',
    name: 'Dimas P.', detail: 'Honda ADV 160 • Complete Service Glossy', initials: 'DP'
  },
  repaint: {
    quote: '"Candy red-nya mantap. Temen-temen pada nanya cat dimana. Halus banget hasilnya, ga ada kulit jeruk."',
    name: 'Bayu S.', detail: 'Yamaha Aerox • Repaint Bodi Halus', initials: 'BS'
  },
  konsul: {
    quote: '"Awalnya bingung mau ngapain, dikasih saran poles + coating. Sekarang motor 2019 keliatan kayak 2025."',
    name: 'Andi R.', detail: 'Yamaha XMAX • Full Detailing + Coating', initials: 'AR'
  },
};

// ─── DECISION RESOLVER (mirrors infoCollector.js decision tree) ───
function resolveService(intent, depth, paintType, repaintArea) {
  if (intent === 'konsul') return null;

  if (intent === 'detailing') {
    if (depth === 'mesin_only') return 'Detailing Mesin';
    if (depth === 'bodi_only') {
      if (paintType === 'doff') return 'Coating Motor Doff';
      return 'Poles Bodi Glossy';
    }
    if (depth === 'full_bongkar') {
      if (paintType === 'doff') return 'Complete Service Doff';
      return 'Complete Service Glossy';
    }
  }

  if (intent === 'repaint') {
    if (repaintArea === 'bodi_halus') return 'Repaint Bodi Halus';
    if (repaintArea === 'bodi_kasar') return 'Repaint Bodi Kasar';
    if (repaintArea === 'velg') return 'Repaint Velg';
    if (repaintArea === 'full') return 'Repaint Bodi Halus';
  }

  return null;
}

function getUpsell(intent, depth, paintType, repaintArea) {
  if (intent === 'detailing') {
    if (depth === 'mesin_only') return { name: 'Poles/Coating juga', reason: 'Sayang kalau mesin bersih tapi bodi masih kusam' };
    if (depth === 'bodi_only') {
      if (paintType === 'doff') return { name: 'Complete Service Doff', reason: 'Udah sekalian sampai rangka + coating, hasil lebih awet' };
      return { name: 'Coating Motor Glossy', reason: 'Biar proteksinya lebih tahan lama, efek daun talas' };
    }
    return null;
  }
  if (intent === 'repaint') {
    if (repaintArea === 'bodi_halus') return { name: '+ Cuci Komplit', reason: 'Mumpung bodi lagi dibongkar, sekalian bersihin rangka' };
    if (repaintArea === 'bodi_kasar' || repaintArea === 'velg') return { name: '+ Repaint Bodi Halus', reason: 'Ada promo diskon 15% kalau ambil sekalian' };
    return null;
  }
  return null;
}

// ─── ANIMATION VARIANTS ───
const pageVariants = {
  enter: (dir) => ({ x: dir > 0 ? '30%' : '-30%', opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir) => ({ x: dir > 0 ? '-30%' : '30%', opacity: 0 }),
};
const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

// ─── HELPER COMPONENTS ───
const ChoiceCard = ({ emoji, title, sub, selected, onClick }) => (
  <button className={`choice-card ${selected ? 'selected' : ''}`} onClick={onClick}>
    <div className="choice-emoji">{emoji}</div>
    <div className="choice-text">
      <span>{title}</span>
      <span>{sub}</span>
    </div>
  </button>
);

const ProofCard = ({ testimonial }) => (
  <div className="proof-card">
    <p className="proof-quote">{testimonial.quote}</p>
    <div className="proof-author">
      <div className="proof-avatar">{testimonial.initials}</div>
      <div>
        <div className="proof-name">{testimonial.name}</div>
        <div className="proof-detail">{testimonial.detail}</div>
      </div>
    </div>
  </div>
);

// ─── MOTOR INPUT COMPONENT ───
const MotorInput = ({ motorModel, setMotorModel, suggestions, onSearch, onSelect, isSearching }) => {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  const handleChange = (e) => {
    const val = e.target.value;
    setMotorModel(val);

    // Debounce API call
    clearTimeout(debounceRef.current);
    if (val.trim().length >= 2) {
      debounceRef.current = setTimeout(() => onSearch(val.trim()), 300);
    }
  };

  const handleSelect = (model) => {
    setMotorModel(model.modelName);
    onSelect(model);
    setIsFocused(false);
    inputRef.current?.blur();
  };

  return (
    <div className="motor-input-wrapper">
      <div className={`motor-input-container ${isFocused ? 'focused' : ''}`}>
        <Search size={18} className="motor-input-icon" />
        <input
          ref={inputRef}
          type="text"
          className="motor-input"
          placeholder="Ketik motor lo, misal: NMax, Vario, Beat..."
          value={motorModel}
          onChange={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          autoComplete="off"
        />
        {isSearching && <Loader2 size={18} className="motor-input-spinner" />}
      </div>

      {/* Autocomplete dropdown */}
      {isFocused && suggestions.length > 0 && (
        <div className="motor-suggestions">
          {suggestions.map((m) => (
            <button
              key={m.id}
              className="motor-suggestion-item"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(m)}
            >
              <span className="motor-suggestion-name">{m.modelName}</span>
              <span className="motor-suggestion-brand">{m.brand}</span>
            </button>
          ))}
        </div>
      )}

      {motorModel.length >= 2 && !isSearching && suggestions.length === 0 && isFocused && (
        <div className="motor-suggestions">
          <div className="motor-suggestion-empty">
            Motor ga ketemu? Tenang, tetap bisa konsul via WA 👇
          </div>
        </div>
      )}
    </div>
  );
};

// ─── MAIN APP ───
const App = () => {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);

  // Decision tree state
  const [intent, setIntent] = useState(null);
  const [depth, setDepth] = useState(null);
  const [paintType, setPaintType] = useState(null);
  const [repaintArea, setRepaintArea] = useState(null);

  // Motor input state
  const [motorModel, setMotorModel] = useState('');
  const [selectedMotor, setSelectedMotor] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Pricing state (fetched from API)
  const [pricingData, setPricingData] = useState(null);
  const [isPricingLoading, setIsPricingLoading] = useState(false);

  const next = useCallback(() => { setDir(1); setStep(s => s + 1); }, []);
  const back = useCallback(() => { setDir(-1); setStep(s => Math.max(0, s - 1)); }, []);

  const selectAndNext = (setter) => (val) => {
    setter(val);
    setTimeout(() => next(), 180);
  };

  // ─── API CALLS ───
  const searchMotors = useCallback(async (query) => {
    setIsSearching(true);
    try {
      const res = await fetch(`${API_BASE}/public/vehicle-models?search=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.success) {
        setSuggestions(data.models);
      }
    } catch (err) {
      console.error('Failed to search motors:', err);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleMotorSelect = useCallback((model) => {
    setSelectedMotor(model);
    setMotorModel(model.modelName);
    setSuggestions([]);
  }, []);

  // Fetch pricing when entering result step
  const recommended = resolveService(intent, depth, paintType, repaintArea);
  const recommendedService = recommended ? masterLayanan.find(s => s.name === recommended) : null;

  useEffect(() => {
    const stepSequence = buildStepsStatic(intent, depth, repaintArea);
    const currentType = stepSequence[step];

    if (currentType === 'result' && selectedMotor && recommended) {
      setIsPricingLoading(true);
      setPricingData(null);

      fetch(`${API_BASE}/public/pricing?motor=${encodeURIComponent(selectedMotor.modelName)}&service=${encodeURIComponent(recommended)}`)
        .then(r => r.json())
        .then(data => {
          setPricingData(data);
        })
        .catch(err => {
          console.error('Pricing fetch failed:', err);
        })
        .finally(() => setIsPricingLoading(false));
    }
  }, [step, selectedMotor, recommended]);

  const upsell = getUpsell(intent, depth, paintType, repaintArea);
  const testimonial = intent ? TESTIMONIALS[intent] : TESTIMONIALS.konsul;
  const repaintKasar = repaintArea === 'full' ? masterLayanan.find(s => s.name === 'Repaint Bodi Kasar') : null;

  const generateWaLink = (serviceName = '') => {
    const parts = [`Halo Bosmat 👋`];
    if (serviceName) {
      parts.push(`Saya tertarik layanan *${serviceName}*.`);
    } else {
      parts.push('Saya mau konsultasi.');
    }
    if (selectedMotor) {
      parts.push(`Motor: ${selectedMotor.modelName}`);
    }
    if (intent === 'detailing' && depth) {
      const depthLabel = DETAILING_DEPTH.find(d => d.id === depth)?.title || '';
      parts.push(`Kebutuhan: ${depthLabel}`);
    }
    if (intent === 'repaint' && repaintArea) {
      const areaLabel = REPAINT_AREA.find(a => a.id === repaintArea)?.title || '';
      parts.push(`Area: ${areaLabel}`);
    }
    parts.push('Bisa booking slot kapan ya?');
    return `https://wa.me/${studioMetadata.contact.whatsapp}?text=${encodeURIComponent(parts.join('\n'))}`;
  };

  // ─── PRICE DISPLAY HELPERS ───
  const getDisplayPrice = () => {
    // If API returned pricing data, use that
    if (pricingData?.success) {
      // Single service result
      if (pricingData.price_formatted) return pricingData.price_formatted;
      // Multi-service result (from getServiceDetails wrapper)
      if (pricingData.results?.length) {
        const first = pricingData.results[0];
        if (first.price_formatted) return first.price_formatted;
        if (first.candidates?.length) return first.candidates[0].price_formatted;
      }
    }
    // Fallback to static data
    return getFallbackPrice(recommendedService);
  };

  const getDisplayDuration = () => {
    if (pricingData?.success) {
      if (pricingData.estimated_duration) return pricingData.estimated_duration;
      if (pricingData.results?.length) {
        const first = pricingData.results[0];
        if (first.estimated_duration) return first.estimated_duration;
      }
    }
    return null;
  };

  const getFallbackPrice = (svc) => {
    if (!svc) return 'Hubungi via WA';
    if (svc.price > 0) return `Rp ${svc.price.toLocaleString('id-ID')}`;
    if (svc.variants?.length) return `Mulai Rp ${svc.variants[0].price.toLocaleString('id-ID')}`;
    return 'Tergantung model motor';
  };

  // ─── DYNAMIC STEP ROUTING ───
  const buildSteps = () => buildStepsStatic(intent, depth, repaintArea);

  const stepSequence = buildSteps();
  const currentStepType = stepSequence[step] || 'hook';
  const totalSteps = stepSequence.length;

  return (
    <div className="mobile-container">
      {/* Progress Bar */}
      <div className="progress-bar">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div key={i} className={`progress-segment ${i === step ? 'active' : i < step ? 'done' : ''}`} />
        ))}
      </div>

      <AnimatePresence mode="wait" custom={dir}>
        {/* ═══════════════════════════════════════
            STEP: EGO HOOK
            ═══════════════════════════════════════ */}
        {currentStepType === 'hook' && (
          <motion.div key="hook" className="step-screen" custom={dir}
            variants={pageVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}>
            <motion.div variants={stagger} initial="hidden" animate="show">
              <motion.div variants={fadeUp} className="hero-badge">⚡ One Man Show Studio</motion.div>
              <motion.h1 variants={fadeUp} className="hero-title">
                Motor lo masih<br /><span className="text-danger">keliatan worth it?</span>
              </motion.h1>
              <motion.p variants={fadeUp} className="hero-subtitle">
                Jujur aja. Cat kusam, mesin dekil, baret dimana-mana — itu ngerusak <strong>first impression</strong> lo.
              </motion.p>
              <motion.div variants={fadeUp} className="stat-row">
                <div className="stat-item">
                  <div className="stat-number">500+</div>
                  <div className="stat-label">Motor Digarap</div>
                </div>
                <div className="stat-item">
                  <div className="stat-number">1</div>
                  <div className="stat-label">Craftsman</div>
                </div>
                <div className="stat-item">
                  <div className="stat-number">4.9</div>
                  <div className="stat-label">★ Rating</div>
                </div>
              </motion.div>
            </motion.div>
            <div className="fixed-bottom">
              <button className="btn-continue primary" onClick={next}>
                Cek Kebutuhan Motor Gue <ArrowRight size={18} />
              </button>
              <p className="fade-text">30 detik • Tanpa form ribet</p>
            </div>
          </motion.div>
        )}

        {/* ═══════════════════════════════════════
            STEP: INTENT (Detailing / Repaint / Konsul)
            ═══════════════════════════════════════ */}
        {currentStepType === 'intent' && (
          <motion.div key="intent" className="step-screen top-aligned" custom={dir}
            variants={pageVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}>
            <button className="btn-back" onClick={back}><ChevronLeft size={18} /> Kembali</button>
            <motion.div variants={stagger} initial="hidden" animate="show">
              <motion.h2 variants={fadeUp} className="question-label">
                Lo butuhnya apa nih?
              </motion.h2>
              <motion.p variants={fadeUp} className="question-sub">Pilih yang paling cocok.</motion.p>
              <motion.div variants={fadeUp} className="choice-grid">
                {INTENT_CHOICES.map(c => (
                  <ChoiceCard key={c.id} {...c} selected={intent === c.id}
                    onClick={() => selectAndNext(setIntent)(c.id)} />
                ))}
              </motion.div>
            </motion.div>
          </motion.div>
        )}

        {/* ═══════════════════════════════════════
            STEP: DETAILING DEPTH
            ═══════════════════════════════════════ */}
        {currentStepType === 'detailing_depth' && (
          <motion.div key="detail-depth" className="step-screen top-aligned" custom={dir}
            variants={pageVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}>
            <button className="btn-back" onClick={back}><ChevronLeft size={18} /> Kembali</button>
            <motion.div variants={stagger} initial="hidden" animate="show">
              <motion.h2 variants={fadeUp} className="question-label">
                Sejauh mana mau<br />dibersihin?
              </motion.h2>
              <motion.p variants={fadeUp} className="question-sub">
                Ini nentuin paket yang paling pas buat lo.
              </motion.p>
              <motion.div variants={fadeUp} className="choice-grid">
                {DETAILING_DEPTH.map(c => (
                  <ChoiceCard key={c.id} {...c} selected={depth === c.id}
                    onClick={() => selectAndNext(setDepth)(c.id)} />
                ))}
              </motion.div>
            </motion.div>
          </motion.div>
        )}

        {/* ═══════════════════════════════════════
            STEP: PAINT TYPE (Glossy / Doff)
            ═══════════════════════════════════════ */}
        {currentStepType === 'paint_type' && (
          <motion.div key="paint-type" className="step-screen top-aligned" custom={dir}
            variants={pageVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}>
            <button className="btn-back" onClick={back}><ChevronLeft size={18} /> Kembali</button>
            <motion.div variants={stagger} initial="hidden" animate="show">
              <motion.h2 variants={fadeUp} className="question-label">
                Cat motor lo<br />glossy atau doff?
              </motion.h2>
              <motion.p variants={fadeUp} className="question-sub">
                Paket treatment-nya beda, biar hasilnya pas.
              </motion.p>
              <motion.div variants={fadeUp} className="choice-grid">
                {PAINT_TYPE.map(c => (
                  <ChoiceCard key={c.id} {...c} selected={paintType === c.id}
                    onClick={() => selectAndNext(setPaintType)(c.id)} />
                ))}
              </motion.div>
            </motion.div>
          </motion.div>
        )}

        {/* ═══════════════════════════════════════
            STEP: REPAINT AREA
            ═══════════════════════════════════════ */}
        {currentStepType === 'repaint_area' && (
          <motion.div key="repaint-area" className="step-screen top-aligned" custom={dir}
            variants={pageVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}>
            <button className="btn-back" onClick={back}><ChevronLeft size={18} /> Kembali</button>
            <motion.div variants={stagger} initial="hidden" animate="show">
              <motion.h2 variants={fadeUp} className="question-label">
                Bagian mana yang<br />mau di-repaint?
              </motion.h2>
              <motion.p variants={fadeUp} className="question-sub">
                Bisa pilih satu atau full bodi.
              </motion.p>
              <motion.div variants={fadeUp} className="choice-grid">
                {REPAINT_AREA.map(c => (
                  <ChoiceCard key={c.id} {...c} selected={repaintArea === c.id}
                    onClick={() => selectAndNext(setRepaintArea)(c.id)} />
                ))}
              </motion.div>
            </motion.div>
          </motion.div>
        )}

        {/* ═══════════════════════════════════════
            STEP: SOCIAL PROOF
            ═══════════════════════════════════════ */}
        {currentStepType === 'proof' && testimonial && (
          <motion.div key="proof" className="step-screen" custom={dir}
            variants={pageVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}>
            <button className="btn-back" onClick={back}><ChevronLeft size={18} /> Kembali</button>
            <motion.div variants={stagger} initial="hidden" animate="show">
              <motion.h2 variants={fadeUp} className="question-label">
                Lo ga sendirian 👊
              </motion.h2>
              <motion.p variants={fadeUp} className="question-sub">
                Yang punya masalah sama udah pada ke Bosmat.
              </motion.p>
              <motion.div variants={fadeUp}><ProofCard testimonial={testimonial} /></motion.div>
              <motion.div variants={fadeUp} className="craftsman-section">
                <div className="craftsman-avatar">🔧</div>
                <div className="craftsman-info">
                  <h4>100% dikerjakan owner</h4>
                  <p>Tanpa mekanik magang. Kualitas terkontrol, hasil konsisten.</p>
                </div>
              </motion.div>
            </motion.div>
            <div className="fixed-bottom">
              <button className="btn-continue primary" onClick={next}>
                Lanjut <ArrowRight size={18} />
              </button>
            </div>
          </motion.div>
        )}

        {/* ═══════════════════════════════════════
            STEP: MOTOR INPUT (Ketik + Autocomplete)
            ═══════════════════════════════════════ */}
        {currentStepType === 'motor_input' && (
          <motion.div key="motor-input" className="step-screen top-aligned" custom={dir}
            variants={pageVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}>
            <button className="btn-back" onClick={back}><ChevronLeft size={18} /> Kembali</button>
            <motion.div variants={stagger} initial="hidden" animate="show">
              <motion.h2 variants={fadeUp} className="question-label">
                Motor lo apa?
              </motion.h2>
              <motion.p variants={fadeUp} className="question-sub">
                Ketik merk/model biar harga bisa langsung muncul.
              </motion.p>
              <motion.div variants={fadeUp}>
                <MotorInput
                  motorModel={motorModel}
                  setMotorModel={setMotorModel}
                  suggestions={suggestions}
                  onSearch={searchMotors}
                  onSelect={handleMotorSelect}
                  isSearching={isSearching}
                />
              </motion.div>

              {selectedMotor && (
                <motion.div variants={fadeUp} className="motor-selected-badge">
                  <span className="motor-selected-check">✓</span>
                  <span>{selectedMotor.modelName}</span>
                  <span className="motor-selected-brand">{selectedMotor.brand}</span>
                </motion.div>
              )}
            </motion.div>

            <div className="fixed-bottom">
              <button
                className={`btn-continue primary ${!selectedMotor && !motorModel.trim() ? 'disabled' : ''}`}
                onClick={next}
                disabled={!selectedMotor && !motorModel.trim()}
              >
                Lihat Harga & Rekomendasi <ArrowRight size={18} />
              </button>
              <button className="btn-skip" onClick={() => { setSelectedMotor(null); next(); }}>
                Skip — Mau langsung konsul aja
              </button>
            </div>
          </motion.div>
        )}

        {/* ═══════════════════════════════════════
            STEP: PROOF + CTA (for "konsul" branch)
            ═══════════════════════════════════════ */}
        {currentStepType === 'proof_cta' && (
          <motion.div key="proof-cta" className="step-screen" custom={dir}
            variants={pageVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}>
            <button className="btn-back" onClick={back}><ChevronLeft size={18} /> Kembali</button>
            <motion.div variants={stagger} initial="hidden" animate="show">
              <motion.h2 variants={fadeUp} className="question-label">
                Tenang, Bosmat bantu lo. ✊
              </motion.h2>
              <motion.p variants={fadeUp} className="question-sub">
                Langsung konsultasi gratis via WhatsApp. Ceritain aja kondisi motornya.
              </motion.p>
              <motion.div variants={fadeUp}><ProofCard testimonial={TESTIMONIALS.konsul} /></motion.div>
              <motion.div variants={fadeUp} className="craftsman-section">
                <div className="craftsman-avatar">🔧</div>
                <div className="craftsman-info">
                  <h4>Konsultasi langsung sama owner</h4>
                  <p>Bukan CS, bukan bot. Langsung yang ngerti otomotif.</p>
                </div>
              </motion.div>
            </motion.div>
            <div className="fixed-bottom">
              <a href={generateWaLink()} className="btn-whatsapp">
                <MessageCircle size={22} fill="currentColor" /> Chat Bosmat Sekarang
              </a>
              <p className="fade-text">Gratis • Langsung dijawab owner</p>
            </div>
          </motion.div>
        )}

        {/* ═══════════════════════════════════════
            STEP: THE REVEAL / RECOMMENDATION
            ═══════════════════════════════════════ */}
        {currentStepType === 'result' && (
          <motion.div key="result" className="step-screen top-aligned" custom={dir}
            variants={pageVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}>
            <button className="btn-back" onClick={back}><ChevronLeft size={18} /> Kembali</button>
            <motion.div variants={stagger} initial="hidden" animate="show">
              <motion.h2 variants={fadeUp} className="question-label">Yang lo butuh 👇</motion.h2>

              <motion.div variants={fadeUp} className="scarcity-strip">
                <div className="dot" />
                <p>Dikerjakan 1 orang — slot terbatas per minggu</p>
              </motion.div>

              {recommendedService && (
                <motion.div variants={fadeUp} className="result-card">
                  <div className="result-label">Rekomendasi untuk lo</div>
                  <h3 className="result-name">{recommendedService.name}</h3>
                  <p className="result-summary">{recommendedService.summary}</p>

                  {/* Motor badge */}
                  {selectedMotor && (
                    <div className="result-motor-badge">
                      🏍️ {selectedMotor.modelName}
                    </div>
                  )}

                  {/* Price: from API or fallback */}
                  <div className="result-price">
                    {isPricingLoading ? (
                      <div className="price-loading">
                        <Loader2 size={20} className="motor-input-spinner" />
                        <span>Menghitung harga...</span>
                      </div>
                    ) : (
                      <>
                        <span className="from">{selectedMotor ? 'Harga untuk motor lo' : 'Estimasi harga'}</span>
                        <span className="amount">{getDisplayPrice()}</span>
                      </>
                    )}
                  </div>

                  {/* Duration from API */}
                  {getDisplayDuration() && (
                    <div className="result-duration">
                      ⏱️ Estimasi: {getDisplayDuration()}
                    </div>
                  )}
                </motion.div>
              )}

              {/* Full Bodi = Halus + Kasar */}
              {repaintKasar && (
                <motion.div variants={fadeUp} style={{
                  padding: '14px 16px', background: 'var(--bg-card)', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)', marginBottom: '12px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>+ {repaintKasar.name}</span>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '2px' }}>Sudah termasuk di Full Bodi</p>
                  </div>
                </motion.div>
              )}

              {/* Upsell suggestion */}
              {upsell && (
                <motion.div variants={fadeUp} style={{
                  padding: '16px', borderRadius: 'var(--radius-md)',
                  background: 'rgba(234, 179, 8, 0.05)', border: '1px solid rgba(234, 179, 8, 0.12)',
                  marginBottom: '16px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <Sparkles size={16} color="var(--accent)" />
                    <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--accent)' }}>Saran Tambahan</span>
                  </div>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    <strong style={{ color: 'var(--text-main)' }}>{upsell.name}</strong> — {upsell.reason}
                  </p>
                </motion.div>
              )}

              {/* Location */}
              <motion.div variants={fadeUp} style={{
                padding: '16px', borderRadius: 'var(--radius-md)',
                background: 'var(--bg-card)', border: '1px solid var(--border-color)', marginBottom: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <MapPin size={16} color="var(--text-dim)" />
                  <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-muted)' }}>{studioMetadata.location.address}</span>
                </div>
                <a href={studioMetadata.location.googleMaps} target="_blank" rel="noreferrer"
                  style={{ fontSize: '0.85rem', color: 'var(--accent)', fontWeight: 600 }}>
                  Buka Google Maps →
                </a>
              </motion.div>

            </motion.div>

            <div className="fixed-bottom">
              <a href={generateWaLink(recommendedService?.name || '')} className="btn-whatsapp">
                <MessageCircle size={22} fill="currentColor" /> Booking via WhatsApp
              </a>
              <p className="fade-text">Langsung chat owner • Ga ribet</p>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
};

// Step builder as pure function (needed for useEffect dependency)
function buildStepsStatic(intent, depth, repaintArea) {
  const steps = ['hook', 'intent'];
  if (!intent || intent === 'konsul') {
    steps.push('proof_cta');
    return steps;
  }
  if (intent === 'detailing') {
    steps.push('detailing_depth');
    if (depth && depth !== 'mesin_only') steps.push('paint_type');
    steps.push('proof');
    steps.push('motor_input');
    steps.push('result');
  }
  if (intent === 'repaint') {
    steps.push('repaint_area');
    steps.push('proof');
    steps.push('motor_input');
    steps.push('result');
  }
  return steps;
}

export default App;

import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { REPO_URL } from "@/services/config";
import {
  Sparkles,
  MapPin,
  Sun,
  Moon,
  MousePointer2,
  ExternalLink,
  Map as MapIcon,
  Languages,
  QrCode,
  ArrowRight,
  Zap,
  Menu,
  X,
} from "lucide-react";

const provincesData = [
  { kh: "ភ្នំពេញ", en: "Phnom Penh" },
  { kh: "សៀមរាប", en: "Siem Reap" },
  { kh: "បាត់ដំបង", en: "Battambang" },
  { kh: "កំពត", en: "Kampot" },
  { kh: "កែប", en: "Kep" },
  { kh: "ព្រះសីហនុ", en: "Preah Sihanouk" },
  { kh: "កំពង់ចាម", en: "Kampong Cham" },
  { kh: "តាកែវ", en: "Takeo" },
  { kh: "មណ្ឌលគីរី", en: "Mondulkiri" },
  { kh: "រតនគីរី", en: "Ratanakiri" },
  { kh: "កំពង់ធំ", en: "Kampong Thom" },
  { kh: "កណ្ដាល", en: "Kandal" },
  { kh: "កំពង់ឆ្នាំង", en: "Kampong Chhnang" },
  { kh: "កំពង់ស្ពឺ", en: "Kampong Speu" },
  { kh: "កោះកុង", en: "Koh Kong" },
  { kh: "ក្រចេះ", en: "Kratie" },
  { kh: "ព្រៃវែង", en: "Prey Veng" },
  { kh: "ពោធិ៍សាត់", en: "Pursat" },
  { kh: "ស្ទឹងត្រែង", en: "Stung Treng" },
  { kh: "ស្វាយរៀង", en: "Svay Rieng" },
  { kh: "បន្ទាយមានជ័យ", en: "Banteay Meanchey" },
  { kh: "ឧត្តរមានជ័យ", en: "Oddar Meanchey" },
  { kh: "ព្រះវិហារ", en: "Preah Vihear" },
  { kh: "ប៉ៃលិន", en: "Pailin" },
  { kh: "ត្បូងឃ្មុំ", en: "Tbong Khmum" },
];

function CarouselFeatured() {
  const cards = [
    {
      icon: MapIcon,
      title: "Live Editor",
      kh: "ផ្ទាំងរចនាបែបងាយស្រួល",
      desc: "អ្នកអាចប្តូរឈ្មោះខេត្ត ប្តូរចំណងជើងជាភាសាខ្មែរ ឬអង់គ្លេស និងផ្លាស់ប្តូរទម្រង់ស៊ុមបានភ្លាមៗដោយគ្មានការពិបាក។",
    },
    {
      icon: Languages,
      title: "Full Khmer Typography",
      kh: "គាំទ្រអក្សរខ្មែរ",
      desc: "មានពុម្ពអក្សរខ្មែរស្អាតៗ និងត្រឹមត្រូវតាមបែបបទខ្មែរ សម្រាប់បង្ហាញឈ្មោះខេត្ត និងចំណងជើងផ្សេងៗយ៉ាងស្រស់បំព្រង។",
    },
    {
      icon: QrCode,
      title: "Integrated QR Code",
      kh: "ភ្ជាប់ QR កូដងាយៗ",
      desc: "អាចបន្ថែមរូបសញ្ញា QR Code ភ្ជាប់ទៅកាន់ផែនទីពិតប្រាកដ ដើម្បីបង្ហាញភ្ញៀវ ឬមិត្តភក្តិឱ្យរកទីតាំងឃើញលឿនរហ័ស។",
    },
  ];
  const [idx, setIdx] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setIdx((current) => (current + 1) % cards.length), 5000);
    return () => window.clearInterval(timer);
  }, [cards.length, isPaused]);

  return (
    <div
      className="home-carousel"
      role="region"
      aria-roledescription="carousel"
      aria-label="Creator features"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsPaused(false);
      }}
    >
      <div className="home-carousel-track" style={{ transform: `translateX(-${idx * 100}%)` }}>
        {cards.map((card, i) => {
          const IC = card.icon;
          return (
            <div key={i} className="home-carousel-card" aria-hidden={i !== idx}>
              <div className="home-carousel-icon-box">
                <IC size={22} />
              </div>
              <h3 className="home-carousel-title">
                {card.title} <span>{card.kh}</span>
              </h3>
              <p className="home-carousel-desc">{card.desc}</p>
            </div>
          );
        })}
      </div>
      <div className="home-carousel-dots" aria-label="Choose a feature">
        {cards.map((card, i) => (
          <button
            key={card.title}
            type="button"
            className={`home-carousel-dot${i === idx ? " active" : ""}`}
            onClick={() => setIdx(i)}
            aria-label={`Show ${card.title}`}
            aria-current={i === idx ? "true" : undefined}
          />
        ))}
        <button
          type="button"
          className="home-carousel-toggle"
          onClick={() => setIsPaused((paused) => !paused)}
          aria-label={isPaused ? "Play carousel" : "Pause carousel"}
        >
          {isPaused ? "Play" : "Pause"}
        </button>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [isDark, setIsDark] = useState(true);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isNavOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIsNavOpen(false);
      menuButtonRef.current?.focus();
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (!navRef.current?.contains(event.target as Node)) setIsNavOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isNavOpen]);

  const triggerToast = (msg: string) => {
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    setToast(msg);
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 2500);
  };

  const handleThemeToggle = () => {
    const next = !isDark;
    setIsDark(next);
    triggerToast(`ប្តូរទៅកាន់ស្ទីល ${next ? "ងងឹត (Dark Mode)" : "ភ្លឺ (Light Mode)"}`);
  };

  // Scroll-triggered reveal animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("home-section-reveal-active");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" },
    );

    const sections = document.querySelectorAll("[data-reveal]");
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  return (
    <div className={`home-page${isDark ? "" : " light-theme"}`}>
      {/* Toast */}
      {toast && (
        <div className="home-toast" id="toast-notification" role="status" aria-live="polite">
          <Sparkles className="home-toast-icon" />
          <span>{toast}</span>
        </div>
      )}

      {/* Vertical tag */}
      <div className="home-vertical-tag">The Land of Smiles • កម្ពុជា</div>

      {/* Navigation */}
      <nav ref={navRef} className="home-nav" aria-label="Main navigation">
        <div className="container home-nav-container">
          <Link to="/" className="home-logo-area" aria-label="TeeTang Art home">
            <div className="home-logo-icon">
              <MapPin size={20} />
            </div>
            <span className="home-logo-text">
              TEE<span style={{ color: "var(--home-color-gold)" }}>TANG</span>.ART
              <span className="home-logo-kh">ទីតាំង</span>
            </span>
          </Link>

          <button
            ref={menuButtonRef}
            type="button"
            className="home-mobile-menu-btn"
            onClick={() => setIsNavOpen((open) => !open)}
            aria-expanded={isNavOpen}
            aria-controls="home-navigation"
            aria-label={isNavOpen ? "Close navigation" : "Open navigation"}
          >
            {isNavOpen ? <X size={24} /> : <Menu size={24} />}
          </button>

          <div id="home-navigation" className={`home-nav-menu${isNavOpen ? " is-open" : ""}`}>
            <a href="#studio" className="home-nav-item" onClick={() => setIsNavOpen(false)}>
              សាកល្បងរចនា
            </a>
            <a href="#features" className="home-nav-item" onClick={() => setIsNavOpen(false)}>
              មុខងារពិសេស
            </a>
            <a href="#usecases" className="home-nav-item" onClick={() => setIsNavOpen(false)}>
              អត្ថប្រយោជន៍
            </a>
            <button
              type="button"
              className="home-theme-toggle"
              onClick={handleThemeToggle}
              aria-label={isDark ? "Use light theme" : "Use dark theme"}
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <Link to="/create" className="home-cta-button" onClick={() => setIsNavOpen(false)}>
              <Sparkles size={16} /> បង្កើតផែនទីឥឡូវនេះ
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="home-hero">
        <div className="container">
          <div className="home-badge">
            <span className="home-badge-dot" />
            <span>ឥតគិតថ្លៃ ១០០% & Open Source សម្រាប់ខ្មែរគ្រប់រូប</span>
          </div>

          <h1 className="home-hero-title">
            Your place. <em>Your map.</em> Your story.
          </h1>
          <p className="home-hero-subtitle-kh">
            ទីតាំង — បង្កើតផ្ទាំងសិល្បៈផែនទីដ៏ស្រស់ស្អាតបំផុតសម្រាប់អ្នក
          </p>
          <p className="home-hero-desc">
            រចនា និងបោះពុម្ពផ្ទាំងផែនទីបង្ហាញទីតាំងដ៏ប្រណីតពីគ្រប់ទីកន្លែងក្នុងប្រទេសកម្ពុជា
            ឬជុំវិញពិភពលោក។ សាមញ្ញ ងាយស្រួលប្រើប្រាស់ និងមិនចាំបាច់មានជំនាញរចនាទាល់តែសោះ។
          </p>

          <div className="home-hero-actions">
            <Link to="/create" className="home-btn home-btn-primary">
              <MousePointer2 size={20} /> សាកល្បងរចនាឥឡូវនេះ
            </Link>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="home-btn home-btn-secondary"
            >
              <ExternalLink size={20} /> ចូលរួមអភិវឌ្ឍន៍លើ GitHub
            </a>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="home-stats-bar" data-reveal>
        <div className="container home-stats-grid">
          <div className="home-stat-cell">
            <span className="home-stat-num">៨ +</span>
            <span className="home-stat-label">ស៊ុមស្អាតៗ</span>
          </div>
          <div className="home-stat-cell">
            <span className="home-stat-num">ចម្រុះ</span>
            <span className="home-stat-label">ពណ៌ប្លែកៗជាច្រើន</span>
          </div>
          <div className="home-stat-cell">
            <span className="home-stat-num">២៥ ខេត្ត</span>
            <span className="home-stat-label">ជ្រើសរើសបានគ្រប់ខេត្ត</span>
          </div>
        </div>
      </section>

      {/* Studio CTA */}
      <section id="studio" className="home-steps-section" data-reveal>
        <div className="container">
          <div className="home-section-header">
            <p className="home-section-sub">
              សាកល្បងរចនាផ្ទាំងប័ណ្ណផែនទីរបស់អ្នកភ្លាមៗនៅលើវេបសាយនេះ
              រួចផ្លាស់ប្តូរការកំណត់ទៅតាមចិត្ត!
            </p>
          </div>

          {/* Sample Gallery */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 20,
              marginBottom: 40,
            }}
          >
            {[
              {
                src: "/assets/phnom_penh_copper.png",
                title: "Phnom Penh",
                city: "Phnom Penh",
                theme: "copper",
                badge: "Copper",
                badgeColor: "#D4AF37",
              },
              {
                src: "/assets/phnom-penh-paris-ruby.png",
                title: "Phnom Penh & Paris",
                city: "Phnom Penh",
                theme: "ruby",
                badge: "Ruby",
                badgeColor: "#E8453C",
              },
              {
                src: "/assets/phnom_penh_japanese_ink.png",
                title: "Phnom Penh",
                city: "Phnom Penh",
                theme: "japanese-ink",
                badge: "Japanese Ink",
                badgeColor: "#3B82F6",
              },
              {
                src: "/assets/phnom_penh_tonle_sap.png",
                title: "Tonle Sap",
                city: "Phnom Penh",
                theme: "tonle_sap",
                badge: "Tonle Sap",
                badgeColor: "#48B8A0",
              },
            ].map((sample, i) => (
              <div key={i} className="home-feat-card" style={{ padding: 12, textAlign: "center" }}>
                <div
                  style={{
                    width: "100%",
                    aspectRatio: "3/4",
                    borderRadius: 12,
                    overflow: "hidden",
                    border: "1px solid #1e2a47",
                    marginBottom: 16,
                    background: "#0a0f1e",
                    position: "relative",
                  }}
                >
                  <img
                    src={sample.src}
                    alt={sample.title}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
                    loading="lazy"
                  />
                  {/* Lively beating theme badge on image */}
                  <span
                    className="home-sample-badge"
                    style={{
                      position: "absolute",
                      bottom: 10,
                      left: 10,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "3px 10px",
                      borderRadius: 9999,
                      background: "rgba(11, 15, 25, 0.85)",
                      backdropFilter: "blur(4px)",
                      border: `1px solid ${sample.badgeColor}`,
                      color: sample.badgeColor,
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: "0.04em",
                      animation: `home-badge-pop 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 0.12}s both, home-badge-beat 1.8s ease-in-out ${i * 0.3}s infinite`,
                      transition: "transform 0.2s ease, box-shadow 0.2s ease",
                      cursor: "default",
                      zIndex: 3,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.animation = "none";
                      e.currentTarget.style.transform = "scale(1.15)";
                      e.currentTarget.style.boxShadow = `0 0 16px ${sample.badgeColor}60`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "scale(1)";
                      e.currentTarget.style.boxShadow = "none";
                      e.currentTarget.style.animation = `home-badge-beat 1.8s ease-in-out ${i * 0.3}s infinite`;
                    }}
                  >
                    <Sparkles size={11} />
                    {sample.badge}
                  </span>
                </div>
                <h3
                  className="home-feat-title"
                  style={{ justifyContent: "center", fontSize: 16, marginBottom: 8 }}
                >
                  {sample.title}
                </h3>
                <Link
                  to={`/create?city=${encodeURIComponent(sample.city)}&theme=${sample.theme}`}
                  className="home-btn home-btn-primary"
                  style={{
                    width: "100%",
                    justifyContent: "center",
                    padding: "10px 16px",
                    fontSize: 13,
                  }}
                >
                  <Zap size={14} /> បង្កើតភ្លាមៗ
                </Link>
              </div>
            ))}
          </div>

          {/* Quick Create Buttons */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              flexWrap: "wrap",
              gap: 12,
              marginBottom: 32,
            }}
          >
            {[
              { label: "ភ្នំពេញ ស្ទីល Copper", city: "Phnom Penh", theme: "copper", icon: MapPin },
              {
                label: "ភ្នំពេញ & បារីស ស្ទីល Ruby",
                city: "Phnom Penh",
                theme: "ruby",
                icon: Sparkles,
              },
              { label: "កំពត ស្ទីល Ink", city: "Kampot", theme: "japanese-ink", icon: Zap },
              {
                label: "ភ្នំពេញ&ប៉ារីស ស្ទីល Tonle Sap",
                city: "Phnom Penh",
                theme: "tonle_sap",
                icon: MapPin,
              },
            ].map((quick, i) => {
              const Icon = quick.icon;
              return (
                <Link
                  key={i}
                  to={`/create?city=${encodeURIComponent(quick.city)}&theme=${quick.theme}`}
                  className="home-btn home-btn-primary"
                  style={{ padding: "10px 18px", fontSize: 13 }}
                >
                  <Icon size={14} /> {quick.label}
                </Link>
              );
            })}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "center",
            }}
          >
            <div
              className="home-feat-card"
              style={{ maxWidth: 520, width: "100%", textAlign: "center" }}
            >
              <div className="home-feat-icon-box" style={{ margin: "0 auto 20px" }}>
                <MapIcon size={22} />
              </div>
              <h3 className="home-feat-title" style={{ justifyContent: "center" }}>
                ចាប់ផ្តើមរចនាឥឡូវនេះ
              </h3>
              <p className="home-feat-desc">
                ជ្រើសរើសទីតាំងដែលអ្នកចូលចិត្ត ប្តូរពណ៌
                និងប្លាស់ប្តូររចនាសម្ព័ន្ធផ្ទាំងផែនទីរបស់អ្នកយ៉ាងងាយស្រួល។
              </p>
              <Link
                to="/create"
                className="home-btn home-btn-primary"
                style={{ width: "100%", justifyContent: "center", marginTop: 12 }}
              >
                <ArrowRight size={18} /> ចូលទៅកាន់ Studio
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="home-features" data-reveal>
        <div className="container">
          <div className="home-section-header">
            <span className="home-section-tag">មុខងារសំខាន់ៗ</span>
            <h2 className="home-section-h">រៀបចំឡើងសាមញ្ញបំផុត</h2>
            <p className="home-section-sub">
              មុខងារងាយស្រួល មិនស្មុគស្មាញ ដើម្បីឱ្យខ្មែរគ្រប់រូបអាចប្រើបានយ៉ាងរហ័ស។
            </p>
          </div>

          <CarouselFeatured />
        </div>
      </section>

      {/* Steps */}
      <section id="steps" className="home-steps-section" data-reveal>
        <div className="container">
          <div className="home-section-header">
            <span className="home-section-tag">ដំណើរការ</span>
            <h2 className="home-section-h">៣ ជំហានងាយៗ</h2>
            <p className="home-section-sub">
              ការរចនាសាមញ្ញបំផុត ដោយគ្រាន់តែធ្វើតាមជំហានងាយៗទាំងនេះ៖
            </p>
          </div>

          <div className="home-steps-grid">
            {[
              {
                num: "01",
                title: "ស្វែងរកទីតាំង",
                desc: "ជ្រើសរើសខេត្ត-ក្រុង ឬវាយបញ្ចូលឈ្មោះទីកន្លែងដែលអ្នកចង់បង្ហាញនៅលើផែនទី។",
              },
              {
                num: "02",
                title: "រៀបចំតាមចិត្ត",
                desc: "ជ្រើសរើសពណ៌ រូបរាងស៊ុម និងកែសម្រួលដូរចំណងជើងជាភាសាខ្មែរយ៉ាងងាយ។",
              },
              {
                num: "03",
                title: "រក្សាទុក និងប្រើប្រាស់",
                desc: "ប្រើប្រាស់សម្រាប់ចែករំលែក ឬជាការចងចាំ គំរូផែនទីដ៏ស្រស់ស្អាតដោយគ្មានភាពស្មុគស្មាញ។",
              },
            ].map((s, i) => (
              <div key={i} className="home-step-card">
                <div className="home-step-num">{s.num}</div>
                <h3 className="home-step-h">{s.title}</h3>
                <p className="home-step-desc">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section id="usecases" className="home-features" data-reveal>
        <div className="container">
          <div className="home-section-header">
            <span className="home-section-tag">ការប្រើប្រាស់</span>
            <h2 className="home-section-h">ប្រើប្រាស់បានគ្រប់តម្រូវការ</h2>
            <p className="home-section-sub">
              អ្នកអាចរៀបចំផ្ទាំងផែនទីស្អាតៗទាំងនេះ សម្រាប់សម្រួលការងារប្រចាំថ្ងៃ និងពិធីការផ្សេងៗ។
            </p>
          </div>

          <div className="home-usecase-grid">
            {[
              {
                color: "#e74c3c",
                tag: "កម្មវិធីផ្សេងៗ",
                kh: "ពិធីមង្គលការ និងពិធីជប់លៀង",
                desc: "រៀបចំស្លាកបង្ហាញទីតាំងដ៏ស្រស់ស្អាតសម្រាប់ភ្ញៀវកិត្តិយសរបស់អ្នក ងាយស្រួលស្កែនរកផ្លូវធ្វើដំណើរទៅដល់កន្លែងកម្មវិធីភ្លាមៗ។",
              },
              {
                color: "var(--home-color-gold)",
                tag: "អាជីវកម្មខ្នាតតូច",
                kh: "ហាងកាហ្វេ ហាងទំនិញ និងសណ្ឋាគារ",
                desc: "តុបតែងហាងទំនិញរបស់អ្នកជាមួយនឹងផ្ទាំងផែនទីដ៏ទាក់ទាញ ដើម្បីជួយដល់អតិថិជនក្នុងការស្វែងរកហាងកាន់តែងាយស្រួល។",
              },
              {
                color: "#2e86de",
                tag: "សាលា និងអង្គការ",
                kh: "ផែនទីតំបន់ និងដំណើរកម្សាន្ត",
                desc: "ប្រើប្រាស់សម្រាប់របាយការណ៍ការងារ បទបង្ហាញ សកម្មភាពសង្គម ឬផែនទីសាលារៀន ស្ថាប័ននានាយាងមានរបៀបរៀបរយ។",
              },
              {
                color: "#2ed573",
                tag: "ទេសចរណ៍ និងការចងចាំ",
                kh: "មគ្គុទ្ទេសក៍ និងការគាំទ្រ",
                desc: "បង្ហាញពីទីតាំងបេតិកភណ្ឌប្រវត្តិសាស្ត្រ តំបន់កម្សាន្ត ឬកន្លែងដើរលេងដែលអ្នកចង់ណែនាំទៅកាន់អ្នកដទៃ។",
              },
            ].map((uc, i) => (
              <div key={i} className="home-uc-card">
                <div className="home-uc-header">
                  <div className="home-uc-dot" style={{ backgroundColor: uc.color }} />
                  <div className="home-uc-tag">{uc.tag}</div>
                </div>
                <div className="home-uc-kh">{uc.kh}</div>
                <p className="home-uc-desc">{uc.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Provinces */}
      <section className="home-provinces-section" data-reveal>
        <div className="container">
          <div className="home-section-header">
            <span className="home-section-tag">Kingdom Of Wonder</span>
            <h2 className="home-section-h">គ្រប់ដីខ្មែរ គ្រប់រឿងរ៉ាវ</h2>
            <p className="home-section-sub">
              ជ្រើសរើសខេត្ត-ក្រុងរបស់អ្នក ហើយចាប់ផ្តើមរចនាផែនទីដែលបានកំណត់ទីតាំងរួចជាស្រេច៖
            </p>
          </div>

          <div className="home-provinces-container">
            {provincesData.map((prov) => (
              <Link
                key={prov.en}
                to={`/create?city=${encodeURIComponent(prov.en)}`}
                className="home-province-chip"
                aria-label={`Create a map for ${prov.en}`}
              >
                {prov.kh}
                <ArrowRight size={13} aria-hidden="true" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Community */}
      <section className="home-community-banner" data-reveal>
        <div className="container">
          <h2 className="home-banner-h">រួមគ្នាកសាងបច្ចេកវិទ្យាខ្មែរ</h2>
          <p className="home-banner-sub">
            គម្រោងនេះជាកម្មវិធីកូដចំហរ (Open Source) ដើម្បីជួយដល់ការរចនារបស់ប្រជាជនខ្មែរទាំងអស់គ្នា។
            សូមចូលរួមចំណែកជាមួយពួកយើង!
          </p>
          <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 16 }}>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="home-btn home-btn-github"
            >
              <ExternalLink size={20} /> ចូលទៅកាន់ GitHub Repository
            </a>
            <Link to="/create" className="home-btn home-btn-primary">
              <Sparkles size={20} /> ចាប់ផ្តើមរចនាឥឡូវនេះ
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="home-footer">
        <div className="container home-footer-container">
          <div className="home-footer-left">
            រៀបចំឡើងដោយក្តីស្រឡាញ់ពីប្រទេសកម្ពុជា · <a href="https://teetang.art">teetang.art</a> ·
            MIT License ·{" "}
            <a href={REPO_URL} target="_blank" rel="noreferrer">
              GitHub
            </a>
          </div>
          <div className="home-footer-right">
            © 2026 សិល្បៈផែនទី — Tee Tang Art. រក្សាសិទ្ធិគ្រប់យ៉ាង។
          </div>
        </div>
      </footer>

      <button
        type="button"
        className="home-gotop"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="Go to top"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m18 15-6-6-6 6" />
        </svg>
      </button>
    </div>
  );
}

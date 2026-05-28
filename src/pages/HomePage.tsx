import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
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
} from "lucide-react";
import "@/styles/home-page.css";

const provincesData = [
  { kh: "ភ្នំពេញ", en: "Phnom Penh", lat: 11.5564, lng: 104.9282 },
  { kh: "សៀមរាប", en: "Siem Reap", lat: 13.3633, lng: 103.857 },
  { kh: "បាត់ដំបង", en: "Battambang", lat: 13.0957, lng: 103.2022 },
  { kh: "កំពត", en: "Kampot", lat: 10.5942, lng: 104.164 },
  { kh: "កែប", en: "Kep", lat: 10.4829, lng: 104.3167 },
  { kh: "ព្រះសីហនុ", en: "Preah Sihanouk", lat: 10.6253, lng: 103.5234 },
  { kh: "កំពង់ចាម", en: "Kampong Cham", lat: 11.9934, lng: 105.4635 },
  { kh: "តាកែវ", en: "Takeo", lat: 10.9902, lng: 104.785 },
  { kh: "មណ្ឌលគីរី", en: "Mondulkiri", lat: 12.4558, lng: 107.1895 },
  { kh: "រតនគីរី", en: "Ratanakiri", lat: 13.7396, lng: 106.9873 },
  { kh: "កំពង់ធំ", en: "Kampong Thom", lat: 12.6986, lng: 104.8885 },
  { kh: "កណ្ដាល", en: "Kandal", lat: 11.4822, lng: 104.9482 },
  { kh: "កំពង់ឆ្នាំង", en: "Kampong Chhnang", lat: 12.25, lng: 104.6667 },
  { kh: "កំពង់ស្ពឺ", en: "Kampong Speu", lat: 11.4533, lng: 104.5208 },
  { kh: "កោះកុង", en: "Koh Kong", lat: 11.6152, lng: 102.9838 },
  { kh: "ក្រចេះ", en: "Kratie", lat: 12.4881, lng: 106.0187 },
  { kh: "ព្រៃវែង", en: "Prey Veng", lat: 11.4868, lng: 105.3253 },
  { kh: "ពោធិ៍សាត់", en: "Pursat", lat: 12.5333, lng: 103.9167 },
  { kh: "ស្ទឹងត្រែង", en: "Stung Treng", lat: 13.5259, lng: 105.9683 },
  { kh: "ស្វាយរៀង", en: "Svay Rieng", lat: 11.0878, lng: 105.7991 },
  { kh: "បន្ទាយមានជ័យ", en: "Banteay Meanchey", lat: 13.5852, lng: 102.9737 },
  { kh: "ឧត្តរមានជ័យ", en: "Oddar Meanchey", lat: 14.1751, lng: 103.5134 },
  { kh: "ព្រះវិហារ", en: "Preah Vihear", lat: 13.8073, lng: 104.9804 },
  { kh: "ប៉ៃលិន", en: "Pailin", lat: 12.8489, lng: 102.6093 },
  { kh: "ត្បូងឃ្មុំ", en: "Tbong Khmum", lat: 11.9333, lng: 105.65 },
];

function CarouselFeatured() {
  const cards = [
    { icon: MapIcon, title: "Live Editor", kh: "ផ្ទាំងរចនាបែបងាយស្រួល", desc: "អ្នកអាចប្តូរឈ្មោះខេត្ត ប្តូរចំណងជើងជាភាសាខ្មែរ ឬអង់គ្លេស និងផ្លាស់ប្តូរទម្រង់ស៊ុមបានភ្លាមៗដោយគ្មានការពិបាក។" },
    { icon: Languages, title: "Full Khmer Typography", kh: "គាំទ្រអក្សរខ្មែរ", desc: "មានពុម្ពអក្សរខ្មែរស្អាតៗ និងត្រឹមត្រូវតាមបែបបទខ្មែរ សម្រាប់បង្ហាញឈ្មោះខេត្ត និងចំណងជើងផ្សេងៗយ៉ាងស្រស់បំព្រង។" },
    { icon: QrCode, title: "Integrated QR Code", kh: "ភ្ជាប់ QR កូដងាយៗ", desc: "អាចបន្ថែមរូបសញ្ញា QR Code ភ្ជាប់ទៅកាន់ផែនទីពិតប្រាកដ ដើម្បីបង្ហាញភ្ញៀវ ឬមិត្តភក្តិឱ្យរកទីតាំងឃើញលឿនរហ័ស។" },
  ];
  const [idx, setIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    timerRef.current = setInterval(() => setIdx(p => (p + 1) % cards.length), 4000);
    return () => clearInterval(timerRef.current);
  }, [cards.length]);

  const prev = (i: number) => (i - 1 + cards.length) % cards.length;
  const next = (i: number) => (i + 1) % cards.length;
  const c = cards[idx];
  const IconComponent = c.icon;

  return (
    <div className="home-carousel">
      <div className="home-carousel-track" style={{ transform: `translateX(-${idx * 100}%)` }}>
        {cards.map((card, i) => {
          const IC = card.icon;
          return (
            <div key={i} className="home-carousel-card">
              <div className="home-carousel-icon-box"><IC size={22} /></div>
              <h3 className="home-carousel-title">{card.title} <span>{card.kh}</span></h3>
              <p className="home-carousel-desc">{card.desc}</p>
            </div>
          );
        })}
      </div>
      <div className="home-carousel-dots">
        {cards.map((_, i) => (
          <button key={i} className={`home-carousel-dot${i === idx ? " active" : ""}`} onClick={() => setIdx(i)} />
        ))}
      </div>
    </div>
  );
}

export default function HomePage() {
  const [isDark, setIsDark] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [activeProvince, setActiveProvince] = useState(provincesData[0]);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.remove("light-theme");
      document.body.classList.remove("light-theme");
    } else {
      root.classList.add("light-theme");
      document.body.classList.add("light-theme");
    }
  }, [isDark]);

  const triggerToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleThemeToggle = () => {
    const next = !isDark;
    setIsDark(next);
    triggerToast(`ប្តូរទៅកាន់ស្ទីល ${next ? "ងងឹត (Dark Mode)" : "ភ្លឺ (Light Mode)"}`);
  };

  const handleProvinceSelect = (prov: (typeof provincesData)[0]) => {
    setActiveProvince(prov);
    triggerToast(`បានផ្លាស់ប្តូរទីតាំងទៅកាន់ខេត្ត ${prov.kh}`);
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
    <div className="home-page">
      {/* Toast */}
      {toast && (
        <div className="home-toast" id="toast-notification">
          <Sparkles className="home-toast-icon" />
          <span>{toast}</span>
        </div>
      )}

      {/* Vertical tag */}
      <div className="home-vertical-tag">The Land of Smiles • កម្ពុជា</div>

      {/* Navigation */}
      <nav className="home-nav">
        <div className="container home-nav-container">
          <a href="#" className="home-logo-area">
            <div className="home-logo-icon">
              <MapPin size={20} />
            </div>
            <span className="home-logo-text">
              TEE<span style={{ color: "var(--home-color-gold)" }}>TANG</span>.ART
              <span className="home-logo-kh">ទីតាំង</span>
            </span>
          </a>

          <div className="home-nav-menu">
            <a href="#studio" className="home-nav-item">
              សាកល្បងរចនា
            </a>
            <a href="#features" className="home-nav-item">
              មុខងារពិសេស
            </a>
            <a href="#usecases" className="home-nav-item">
              អត្ថប្រយោជន៍
            </a>
            <button
              type="button"
              className="home-theme-toggle"
              onClick={handleThemeToggle}
              aria-label="Toggle Theme"
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <a href="https://teetang.art" className="home-cta-button">
              <Sparkles size={16} /> បង្កើតផែនទីឥឡូវនេះ
            </a>
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
            <a href="#studio" className="home-btn home-btn-primary">
              <MousePointer2 size={20} /> សាកល្បងរចនាឥឡូវនេះ
            </a>
            <a
              href="https://github.com/im4tta/teetang.art"
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
              { label: "ភ្នំពេញ & បារីស ស្ទីល Ruby", city: "Phnom Penh", theme: "ruby", icon: Sparkles },
              { label: "កំពត ស្ទីល Ink", city: "Kampot", theme: "japanese-ink", icon: Zap },
              { label: "ភ្នំពេញ&ប៉ារីស ស្ទីល Tonle Sap", city: "Phnom Penh", theme: "tonle_sap", icon: MapPin },
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
              ចុចលើឈ្មោះខេត្ត-ក្រុងរបស់អ្នក ដើម្បីផ្លាស់ប្តូរការរចនាផែនទីគំរូខាងលើភ្លាមៗ៖
            </p>
          </div>

          <div className="home-provinces-container">
            {provincesData.map((prov, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleProvinceSelect(prov)}
                className={`home-province-chip ${activeProvince.kh === prov.kh ? "active" : ""}`}
              >
                {prov.kh}
              </button>
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
              href="https://github.com/im4tta/teetang.art"
              target="_blank"
              rel="noreferrer"
              className="home-btn"
              style={{ background: "#333", color: "#fff", border: "none" }}
            >
              <ExternalLink size={20} /> ចូលទៅកាន់ GitHub Repository
            </a>
            <a href="https://teetang.art" className="home-btn home-btn-primary">
              <Sparkles size={20} /> ចូលរួមប្រើប្រាស់វេបសាយដើម
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="home-footer">
        <div className="container home-footer-container">
          <div className="home-footer-left">
            រៀបចំឡើងដោយក្តីស្រឡាញ់ពីប្រទេសកម្ពុជា · <a href="https://teetang.art">teetang.art</a> ·
            MIT License ·{" "}
            <a href="https://github.com/im4tta/teetang.art" target="_blank" rel="noreferrer">
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
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
      </button>
    </div>
  );
}

import { useState } from "react";
import { useI18n } from "@/context/i18n/context";
import {
  InfoIcon,
  ChevronDownIcon,
  LocationIcon,
  ThemeIcon,
  StyleIcon,
  DownloadIcon,
  LayersIcon,
} from "@/components/ui/Icons";

const guidesEn = [
  {
    title: "1. Choose a Location",
    desc: "Search for any place in Cambodia or around the world. The map will automatically center on your selected location.",
    Icon: LocationIcon,
  },
  {
    title: "2. Pick a Theme",
    desc: "Select from curated color palettes inspired by Khmer heritage — Angkor Gold, Alabaster, Mekong Cyan, and more.",
    Icon: ThemeIcon,
  },
  {
    title: "3. Set Poster Size",
    desc: "Choose your desired dimensions in centimeters. The preview updates in real-time as you adjust.",
    Icon: LayersIcon,
  },
  {
    title: "4. Add Typography",
    desc: "Customize titles in both Khmer and English. Adjust fonts, alignment, and divider style to match your taste.",
    Icon: StyleIcon,
  },
  {
    title: "5. Export & Print",
    desc: "Download a high-resolution image or layered SVG. Ready for professional printing or sharing online.",
    Icon: DownloadIcon,
  },
];

const guidesKm = [
  {
    title: "១. ជ្រើសរើសទីតាំង",
    desc: "ស្វែងរកទីកន្លែងណាមួយនៅកម្ពុជា ឬជុំវិញពិភពលោក។ ផែនទីនឹងផ្ចង់ទៅលើទីតាំងដែលបានជ្រើសរើសដោយស្វ័យប្រវត្តិ។",
    Icon: LocationIcon,
  },
  {
    title: "២. ជ្រើសរើសស្ទីលពណ៌",
    desc: "ជ្រើសរើសពីក្រុមពណ៌ដែលបានរៀបចំឡើងយ៉ាងប្រណីត ចាប់ពីមាសអង្គរ សប្រណីត ទន្លេមេគង្គ និងច្រើនទៀត។",
    Icon: ThemeIcon,
  },
  {
    title: "៣. កំណត់ទំហំផ្ទាំង",
    desc: "ជ្រើសរើសទំហំតាមបំណងជាសង់ទីម៉ែត្រ។ ផ្ទាំងពិនិត្យមើលនឹងធ្វើបច្ចុប្បន្នភាពភ្លាមៗនៅពេលអ្នកកែប្រែ។",
    Icon: LayersIcon,
  },
  {
    title: "៤. បន្ថែមអក្សរសិល្បៈ",
    desc: "ប្ដូរចំណងជើងជាភាសាខ្មែរនិងអង់គ្លេស។ លៃតម្រូវពុម្ពអក្សរ ការតម្រឹម និងរចនាសម្ព័ន្ធឲ្យសាកសមតាមចិត្តអ្នក។",
    Icon: StyleIcon,
  },
  {
    title: "៥. ទាញយក និងបោះពុម្ព",
    desc: "ទាញយករូបភាពដែលមានគុណភាពបង្ហាញខ្ពស់ ឬស្រទាប់ SVG។ ត្រៀមខ្លួនជាស្រេចសម្រាប់ការបោះពុម្ព ឬការចែករំលែកប្រកបដោយវិជ្ជាជីវៈតាមអ៊ីនធឺណិត។",
    Icon: DownloadIcon,
  },
];

export default function UserGuidePanel() {
  const { lang } = useI18n();
  const [isExpanded, setIsExpanded] = useState(true);
  const guides = lang === "en" ? guidesEn : guidesKm;

  return (
    <div className="desktop-user-guide">
      <button
        type="button"
        className="desktop-user-guide__header"
        onClick={() => setIsExpanded((v) => !v)}
        aria-expanded={isExpanded}
      >
        <InfoIcon className="desktop-user-guide__icon" />
        <span className="desktop-user-guide__title">
          {lang === "en" ? "Quick Guide" : "របៀបប្រើងាយៗ"}
        </span>
        <ChevronDownIcon className={`desktop-user-guide__chevron${isExpanded ? " is-open" : ""}`} />
      </button>

      {isExpanded && (
        <div className="desktop-user-guide__content">
          {guides.map(({ title, desc, Icon }, idx) => (
            <div key={idx} className="desktop-user-guide__item">
              <div className="desktop-user-guide__step">
                <Icon className="desktop-user-guide__step-icon" />
              </div>
              <div>
                <p className="desktop-user-guide__item-title">{title}</p>
                <p className="desktop-user-guide__item-desc">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

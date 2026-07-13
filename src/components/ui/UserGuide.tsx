import { useI18n } from "@/context/i18n/context";

export default function UserGuide() {
  const { lang } = useI18n();
  const isKhmer = lang === "km";

  return (
    <div className="user-guide">
      <div className="user-guide-row">
        <span className="user-guide-icon">&#128269;</span>
        <span className="user-guide-text">
          {isKhmer
            ? "ស្វែងរកទីតាំងដោយប្រើរបារស្វែងរកនៅផ្នែកខាងលើ"
            : "Search for locations using the search bar at the top"}
        </span>
      </div>
      <div className="user-guide-row">
        <span className="user-guide-icon">&#8596;</span>
        <span className="user-guide-text">
          {isKhmer ? "អូសឆ្វេង/ស្ដាំ ដើម្បីផ្លាស់ប្ដូរស្បែក" : "Swipe left/right to change theme"}
        </span>
      </div>
      <div className="user-guide-row">
        <span className="user-guide-icon">&#8597;</span>
        <span className="user-guide-text">
          {isKhmer ? "អូសឡើង/ចុះ ដើម្បីផ្លាស់ប្ដូររូបរាង" : "Swipe up/down to change shape"}
        </span>
      </div>
      <div className="user-guide-row">
        <span className="user-guide-icon">&#128205;</span>
        <span className="user-guide-text">
          {isKhmer
            ? "បន្ថែមសញ្ញាសម្គាល់ដោយចុចលើផែនទី ឬប្រើម៉ឺនុយសញ្ញាសម្គាល់"
            : "Add markers by clicking on the map or using the markers menu"}
        </span>
      </div>
      <div className="user-guide-row">
        <span className="user-guide-icon">&#128434;</span>
        <span className="user-guide-text">
          {isKhmer
            ? "ប្រើកង់កណ្ដាលកណ្ដុរ ឬប្រើម្រាមដៃពីរដើម្បីប្ដូរទំហំសញ្ញាសម្គាល់"
            : "Use mouse wheel or two-finger pinch to resize markers"}
        </span>
      </div>
      <div className="user-guide-row">
        <span className="user-guide-icon">&#128400;</span>
        <span className="user-guide-text">
          {isKhmer
            ? "ចុចលើសញ្ញាសម្គាល់ដើម្បីអូសវាទៅកន្លែងផ្សេង"
            : "Tap and drag markers to move them manually"}
        </span>
      </div>
      <div className="user-guide-row">
        <span className="user-guide-icon">&#128190;</span>
        <span className="user-guide-text">
          {isKhmer
            ? "នាំចេញការរចនារបស់អ្នកជាឯកសាររូបភាពគុណភាពខ្ពស់"
            : "Export your design as a high-quality image file"}
        </span>
      </div>
    </div>
  );
}

import { SunIcon, MoonIcon, MaximizeIcon, MinimizeIcon, StyleIcon, LayoutIcon } from "@/shared/ui/Icons";

interface Props {
  form: any;
  onChange: (e: any) => void;
}

export default function AppSettingsSection({ form, onChange }: Props) {
  const opt = (name: string, value: string, Icon: React.ComponentType<{ className?: string }>, label: string) => (
    <button
      type="button"
      className={`settings-option-card${form[name] === value ? " is-active" : ""}`}
      onClick={() => onChange({ target: { name, value } })}
    >
      <Icon className="option-card-icon" /><span>{label}</span>
    </button>
  );

  const quickLinks: [string, React.ComponentType<{ className?: string }>, string][] = [
    ["style", StyleIcon, "Fonts & Style"],
    ["layout", LayoutIcon, "Shapes & Sizes"],
  ];

  return (
    <div className="app-settings-section">
      <div className="settings-group">
        <p className="section-summary-label">App Appearance</p>
        <div className="settings-row-grid">
          <div className="settings-option-card-group">
            {opt("appTheme", "light", SunIcon, "Light")}
            {opt("appTheme", "dark", MoonIcon, "Dark")}
          </div>
        </div>
      </div>
      <div className="settings-group" style={{ marginTop: 20 }}>
        <p className="section-summary-label">UI Density</p>
        <div className="settings-row-grid">
          <div className="settings-option-card-group">
            {opt("uiDensity", "comfortable", MaximizeIcon, "Comfortable")}
            {opt("uiDensity", "compact", MinimizeIcon, "Compact")}
          </div>
        </div>
      </div>
      <div className="settings-group" style={{ marginTop: 20 }}>
        <p className="section-summary-label">Quick Links</p>
        <div className="settings-links">
          <p className="settings-link-hint">Jump to specific design settings:</p>
          <div className="settings-link-grid">
            {quickLinks.map(([sec, Icon, label]) => (
              <button
                key={sec}
                type="button"
                className="settings-link-btn"
                onClick={() => document.querySelector(`[data-section="${sec}"]`)?.scrollIntoView({ behavior: "smooth" })}
              >
                <Icon /><span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

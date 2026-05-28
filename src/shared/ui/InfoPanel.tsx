import { useI18n } from "@/shared/i18n/context";
import { useRepoStars } from "@/shared/hooks/useRepoStars";
import { REPO_URL, REPO_API_URL, KOFI_URL } from "@/core/config";
import { GitHubIcon, KofiIcon } from "./Icons";
import UserGuide from "@/shared/ui/UserGuide";

/* ── sub-components ── */

function HelpUsGrowSection({
  repoUrl,
  repoStars,
  repoStarsLoading,
}: {
  repoUrl: string;
  repoStars: number | null;
  repoStarsLoading: boolean;
}) {
  const { t } = useI18n();
  const kofiUrl = String(KOFI_URL ?? "").trim();

  return (
    <section className="info-panel-section">
      <h3>{t("about.title")}</h3>
      <p className="hug-copy" style={{ fontWeight: 600 }}>
        {t("about.welcome")}
      </p>
      <p className="hug-copy">{t("about.description")}</p>
      <p className="hug-copy">{t("about.bodyText")}</p>

      <div className="hug-rows">
        {/* Contact */}
        <div className="hug-row">
          <span className="hug-row-label">{t("about.contact")}</span>
          <div className="hug-row-content">
            <a
              className="github-badge"
              href="https://tmeta.blog"
              target="_blank"
              rel="noreferrer"
              aria-label="Visit Tmeta Blog"
            >
              <span>tmeta.blog</span>
            </a>
          </div>
        </div>

        {/* Support the project */}
        <div className="hug-row">
          <span className="hug-row-label">{t("about.supportProject")}</span>
          <div className="hug-row-content">
            {repoUrl ? (
              <a
                className="github-badge"
                href={repoUrl}
                target="_blank"
                rel="noreferrer"
                aria-label="Open Tee Tang Art repository on GitHub"
              >
                <GitHubIcon className="badge-icon" />
                <span>GitHub</span>
              </a>
            ) : null}
            {kofiUrl ? (
              <a
                className="github-badge"
                href={kofiUrl}
                target="_blank"
                rel="noreferrer"
                aria-label="Support Tee Tang Art on Ko-fi"
              >
                <KofiIcon className="badge-icon" />
                <span>Ko-fi</span>
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function UsageGuideSection() {
  const { lang } = useI18n();
  const isKhmer = lang === "km";

  return (
    <section className="info-panel-section">
      <h3>{isKhmer ? "របៀបប្រើ" : "How to use"}</h3>
      <UserGuide />
    </section>
  );
}

function CreditsSection() {
  return (
    <section className="info-panel-section">
      <div style={{ fontSize: "0.8rem", color: "#94A3B8", lineHeight: 1.6 }}>
        <p style={{ margin: "0 0 8px" }}>
          &mdash; Inspired by{" "}
          <a
            href="https://github.com/originalankur/maptoposter"
            target="_blank"
            rel="noopener noreferrer"
          >
            originalankur/maptoposter
          </a>
          . This project is an independent implementation built with a different stack and
          architecture.
        </p>
        <p style={{ margin: "0" }}>
          {"\u00a9"} OpenStreetMap contributors &middot; Powered by MapLibre GL, OpenFreeMap, and
          Nominatim
        </p>
      </div>
    </section>
  );
}

/* ── main panel ── */

export default function InfoPanel() {
  const repoUrl = String(REPO_URL ?? "").trim();
  const { repoStars, repoStarsLoading } = useRepoStars(REPO_API_URL);

  return (
    <aside className="info-panel">
      <div className="info-panel-group">
        <HelpUsGrowSection
          repoUrl={repoUrl}
          repoStars={repoStars}
          repoStarsLoading={repoStarsLoading}
        />
        <UsageGuideSection />
        <CreditsSection />
      </div>
    </aside>
  );
}

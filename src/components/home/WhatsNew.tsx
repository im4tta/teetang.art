import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { APP_VERSION, UPDATES_URL } from "@/services/config";
import { formatKhmerDate } from "@/utils/khmerDate";

/** The parts of updates.json the home page shows; the editor's pop-up reads the same file. */
interface Point {
  type: string;
  text: string;
  km?: string;
}

interface Release {
  version: string;
  date: string;
  summary?: {
    title?: string;
    titleKm?: string;
    image?: string | null;
    link?: string;
    linkLabel?: string;
    linkLabelKm?: string;
    points: Point[];
  };
}

const ICONS: Record<string, string> = { new: "✨", improved: "🚀", fixed: "🛠️", perf: "⚡" };

/** "What's new" on the home page, from the release notes of the current version. */
export default function WhatsNew() {
  const [release, setRelease] = useState<Release | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(UPDATES_URL, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : []))
      .then((data: Release[]) => {
        const current = Array.isArray(data)
          ? (data.find((item) => item.version === APP_VERSION) ?? data[0])
          : undefined;
        if (current?.summary?.points?.length) setRelease(current);
      })
      .catch(() => {
        // Release notes are optional; the section keeps its link to the plate.
      });
    return () => controller.abort();
  }, []);

  const summary = release?.summary;
  const link = summary?.link ?? "/plate";

  return (
    <section id="whats-new" className="home-whats-new" data-reveal>
      <div className="container">
        <div className="home-section-header">
          <span className="home-section-tag">អ្វីថ្មី{release ? ` · កំណែ ${release.version}` : ""}</span>
          <h2 className="home-section-h">
            {summary?.titleKm || summary?.title || "ផ្ទាំងដី 3D នៃទីកន្លែងណាក៏បាន"}
          </h2>
          {release && <p className="home-section-sub">ចេញផ្សាយ {formatKhmerDate(release.date)}</p>}
        </div>

        <div className="home-whats-new__card">
          <Link to={link} className="home-whats-new__media" aria-label="ផ្ទាំងដី 3D">
            <img
              src={summary?.image || "/assets/updates/plate-3d.webp"}
              alt=""
              width={900}
              height={585}
              loading="lazy"
              decoding="async"
            />
          </Link>
          <div className="home-whats-new__body">
            {summary && (
              <ul className="home-whats-new__list">
                {summary.points.map((point, index) => (
                  <li key={index}>
                    <span aria-hidden="true">{ICONS[point.type] ?? "✨"}</span>
                    <span>{point.km || point.text}</span>
                  </li>
                ))}
              </ul>
            )}
            <Link to={link} className="home-btn home-btn-primary home-whats-new__cta">
              {summary?.linkLabelKm || summary?.linkLabel || "សាកល្បងផ្ទាំងដី 3D"}{" "}
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * A page for checking the Khmer translation: every text in English and Khmer
 * side by side, with a box for corrections and a CSV download of them.
 * Not linked from the app; share /translations with a reviewer.
 */
import { useMemo, useState } from "react";
import { en } from "@/context/i18n/en";
import { km } from "@/context/i18n/km";
import { triggerDownloadBlob } from "@/services/export/fileDownloader";
import "@/styles/plate.css";

type Key = keyof typeof en;
const KEYS = Object.keys(en) as Key[];
const STORE = "teetangart.translations.review";

function readCorrections(): Record<string, string> {
  try {
    return JSON.parse(window.localStorage.getItem(STORE) ?? "{}") ?? {};
  } catch {
    return {};
  }
}

const csvCell = (text: string) => `"${text.replace(/"/g, '""')}"`;

export default function TranslationsPage() {
  const [query, setQuery] = useState("");
  const [area, setArea] = useState<"all" | "plate" | "studio" | "other">("plate");
  const [corrections, setCorrections] = useState<Record<string, string>>(readCorrections);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return KEYS.filter((key) => {
      const group = key.startsWith("plate.")
        ? "plate"
        : key.startsWith("studio.")
          ? "studio"
          : "other";
      if (area !== "all" && group !== area) return false;
      if (!q) return true;
      return [key, en[key], km[key] ?? ""].some((text) => text.toLowerCase().includes(q));
    });
  }, [query, area]);

  const correct = (key: Key, value: string) => {
    const next = { ...corrections, [key]: value };
    if (!value.trim()) delete next[key];
    setCorrections(next);
    try {
      window.localStorage.setItem(STORE, JSON.stringify(next));
    } catch {
      // Corrections stay on screen even if they cannot be kept.
    }
  };

  const download = () => {
    const lines = [["key", "english", "khmer", "correction"].map(csvCell).join(",")];
    for (const key of KEYS) {
      if (!corrections[key]) continue;
      lines.push([key, en[key], km[key] ?? "", corrections[key]].map(csvCell).join(","));
    }
    // A byte-order mark so spreadsheet apps read the Khmer correctly.
    void triggerDownloadBlob(
      new Blob(["﻿" + lines.join("\n")], { type: "text/csv" }),
      "teetang-khmer-corrections.csv",
    );
  };

  const corrected = Object.keys(corrections).length;

  return (
    <div className="plate-page translations-page">
      <header className="plate-header">
        <a href="/" className="plate-brand">
          teetang.art
        </a>
        <span className="plate-header__title">Khmer review · ពិនិត្យការបកប្រែ</span>
      </header>
      <main className="translations-main">
        <p className="plate-note">
          Read each Khmer text. If it is wrong or unnatural, type a better one in the last column.
          Corrections are kept in this browser; download them when you are done. · អានអត្ថបទខ្មែរនីមួយៗ។
          បើខុស ឬមិនធម្មជាតិ សូមសរសេរពាក្យល្អជាងនេះក្នុងជួរចុងក្រោយ។
        </p>
        <div className="translations-tools">
          <input
            className="plate-input"
            type="search"
            placeholder="Search · ស្វែងរក"
            aria-label="Search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="plate-segmented plate-segmented--wide" role="group" aria-label="Area">
            {(["plate", "studio", "other", "all"] as const).map((id) => (
              <button key={id} type="button" aria-pressed={area === id} onClick={() => setArea(id)}>
                {id === "plate"
                  ? "3D plate"
                  : id === "studio"
                    ? "STL Studio"
                    : id === "other"
                      ? "Posters"
                      : "All"}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="plate-btn plate-btn--primary"
            disabled={!corrected}
            onClick={download}
          >
            Download {corrected} correction{corrected === 1 ? "" : "s"} (CSV)
          </button>
        </div>
        <table className="translations-table">
          <thead>
            <tr>
              <th>English</th>
              <th>ខ្មែរ</th>
              <th>Correction · កែតម្រូវ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((key) => (
              <tr key={key}>
                <td>
                  {en[key]}
                  <small>{key}</small>
                </td>
                <td lang="km">{km[key] ?? "—"}</td>
                <td>
                  <textarea
                    lang="km"
                    aria-label={`Correction for ${key}`}
                    value={corrections[key] ?? ""}
                    onChange={(event) => correct(key, event.target.value)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </div>
  );
}

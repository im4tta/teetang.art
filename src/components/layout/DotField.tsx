import { useMemo } from "react";
import "@/styles/dot-field.css";

export default function DotField() {
  const dots = useMemo(() => {
    const cols = 30;
    const rows = 20;
    const items = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const delay = (c * 0.08 + r * 0.12) % 3;
        items.push({ key: `${r}-${c}`, delay });
      }
    }
    return items;
  }, []);

  return (
    <div className="dot-field" aria-hidden="true">
      {dots.map((d) => (
        <div key={d.key} className="dot-field__dot" style={{ animationDelay: `${d.delay}s` }} />
      ))}
    </div>
  );
}

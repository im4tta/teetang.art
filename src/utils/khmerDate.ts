const KHMER_MONTHS = [
  "មករា",
  "កុម្ភៈ",
  "មីនា",
  "មេសា",
  "ឧសភា",
  "មិថុនា",
  "កក្កដា",
  "សីហា",
  "កញ្ញា",
  "តុលា",
  "វិច្ឆិកា",
  "ធ្នូ",
];

const toKhmerDigits = (value: number) =>
  String(value).replace(/\d/g, (digit) => String.fromCharCode(0x17e0 + Number(digit)));

/**
 * "១៩ វិច្ឆិកា ២០២៦" from "2026-11-19". Written by hand because many browsers
 * ship without Khmer date data and would fall back to English.
 */
export function formatKhmerDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return `${toKhmerDigits(date.getDate())} ${KHMER_MONTHS[date.getMonth()]} ${toKhmerDigits(date.getFullYear())}`;
}

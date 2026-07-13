import type { ParsedGpx } from "@/services/routes/types";

export interface IGpxParserPort {
  parse(xml: string, fallbackLabel?: string): ParsedGpx;
}

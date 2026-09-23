/** Fired after an export when it is time to thank the user and ask for support. */
export const SUPPORT_PROMPT_EVENT = "teetangart:support-prompt";
export type SupportPromptVariant = "first" | "milestone";
export interface SupportPromptState {
  posterNumber: number;
  variant: SupportPromptVariant;
}

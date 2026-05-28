/**
 * Overlay components for specialty layout modes:
 * - PropertyCardOverlay: Real-estate property card details
 * - ShopSignageOverlay: Shop/storefront signage details
 *
 * Extracted from PreviewPanel to keep it focused on map/poster composition.
 */
import type { PosterForm } from "@/features/poster/application/posterReducer";
import type { ResolvedTheme } from "@/features/theme/domain/types";
import { InstagramIcon, FacebookIcon, TelegramIcon, WhatsappIcon } from "@/shared/ui/Icons";

type ThemeColors = Pick<ResolvedTheme["ui"], "bg" | "text">;

interface PropertyCardOverlayProps {
  form: PosterForm;
  cityLabel: string;
  theme: ThemeColors;
}

export function PropertyCardOverlay({ form, cityLabel, theme }: PropertyCardOverlayProps) {
  return (
    <div
      className="property-card-details"
      style={{ backgroundColor: theme.bg, color: theme.text }}
    >
      <div className="property-card-badge">{form.propStatus}</div>
      <div className="property-card-title">{form.propType} — {cityLabel}</div>
      <div className="property-card-features">{form.propFeatures}</div>
      <div className="property-card-info">
        {form.propPrice} | {form.propLandSize} | {form.propBuildSize} | {form.propBedrooms}BR/{form.propBathrooms}BA
      </div>
      <div className="property-card-contact">{form.propContact} | {form.propAgent}</div>
      <div className="property-card-cta">{form.propCta}</div>
    </div>
  );
}

interface ShopSignageOverlayProps {
  form: PosterForm;
  cityLabel: string;
  countryLabel: string;
  theme: ThemeColors;
}

const SOCIAL_FIELDS = [
  ["shopInstagram", InstagramIcon],
  ["shopFacebook", FacebookIcon],
  ["shopTelegram", TelegramIcon],
  ["shopWhatsapp", WhatsappIcon],
] as const;

export function ShopSignageOverlay({ form, cityLabel, countryLabel, theme }: ShopSignageOverlayProps) {
  const hasSocial = SOCIAL_FIELDS.some(([key]) => Boolean(form[key as keyof PosterForm]));

  return (
    <div
      className="shop-signage-details"
      style={{ backgroundColor: theme.bg, color: theme.text }}
    >
      <div className="shop-signage-title">{cityLabel}</div>
      <div className="shop-signage-meta">{countryLabel}</div>
      {form.shopTagline && <div className="shop-signage-tagline">{form.shopTagline}</div>}
      <div className="shop-signage-hours">Hours: {form.shopOpen}</div>
      <div className="shop-signage-contact">{form.shopPhone}</div>
      {hasSocial && (
        <div className="shop-signage-social">
          {SOCIAL_FIELDS.map(([key, Icon]) => {
            const value = form[key as keyof PosterForm] as string | undefined;
            if (!value) return null;
            return (
              <span key={key} className="shop-signage-social-item">
                <Icon className="shop-signage-social-icon" />
                {value}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

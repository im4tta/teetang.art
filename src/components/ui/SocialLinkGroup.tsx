import { ABA_ACCOUNT, REPO_API_URL, REPO_URL, SOCIAL_INSTAGRAM } from "@/services/config";
import { useRepoStars } from "@/hooks/useRepoStars";
import { GitHubIcon, InstagramIcon, StarIcon } from "@/components/ui/Icons";
import AbaLogo from "@/components/ui/AbaLogo";

interface SocialLinkGroupProps {
  variant: "header" | "mobile-export";
}

export default function SocialLinkGroup({ variant }: SocialLinkGroupProps) {
  const repoUrl = String(REPO_URL ?? "").trim();
  const repoApiUrl = String(REPO_API_URL ?? "").trim();
  const instagramUrl = String(SOCIAL_INSTAGRAM ?? "").trim();
  const abaAccount = String(ABA_ACCOUNT ?? "").trim();
  const { repoStars, repoStarsLoading } = useRepoStars(repoApiUrl);
  const starsText = repoStarsLoading ? "..." : (repoStars?.toLocaleString() ?? "Star");

  const rootClassName =
    variant === "header" ? "desktop-header-social" : "mobile-export-social-links";

  return (
    <div className={rootClassName} aria-label="Project links">
      {repoUrl ? (
        <a
          className="general-header-social-btn general-header-social-btn--github"
          href={repoUrl}
          target="_blank"
          rel="noreferrer"
          aria-label="Open Tee Tang Art repository on GitHub"
          title="GitHub repository"
        >
          <GitHubIcon />
          <span className="general-header-github-stars">
            <span className="general-header-github-stars-count">{starsText}</span>
            <StarIcon />
          </span>
        </a>
      ) : null}
      {instagramUrl ? (
        <a
          className="general-header-social-btn"
          href={instagramUrl}
          target="_blank"
          rel="noreferrer"
          aria-label="Follow Tee Tang Art on Instagram"
          title="Instagram"
        >
          <InstagramIcon />
        </a>
      ) : null}
      {abaAccount ? (
        <span
          className="general-header-social-btn general-header-social-btn--aba"
          aria-label={`ABA Account ${abaAccount}`}
          title={`ABA Account: ${abaAccount}`}
        >
          <AbaLogo className="general-header-aba-logo" />
          <span className="general-header-aba-number">{abaAccount}</span>
        </span>
      ) : null}
    </div>
  );
}

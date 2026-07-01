import { useState } from "react";
import { useTranslation } from "react-i18next";
import GameModeSelector from "./GameModeSelector.jsx";
import LanguageSwitcher from "./LanguageSwitcher.jsx";
import clearBackgroundLogo from "../assets/images/Logos/Logo_ClearBackground.svg";
import discordIcon from "../assets/images/SocialIcons/SocialIcon_Discord.png";
import instagramIcon from "../assets/images/SocialIcons/SocialIcon_Instagram.png";
import tiktokIcon from "../assets/images/SocialIcons/SocialIcon_TikTok.png";
import xIcon from "../assets/images/SocialIcons/SocialIcon_x.png";
import {
  getPublicPageContent
} from "../data/publicPageContent.js";
import {
  COOKIE_CONSENT_CHOICES,
  hasCookieConsentChoice,
  setCookieConsentChoice
} from "../privacyConsent.js";

const SOCIAL_LINKS = Object.freeze([
  { label: "TikTok", href: "https://www.tiktok.com", icon: tiktokIcon },
  { label: "Discord", href: "https://discord.com", icon: discordIcon },
  { label: "Instagram", href: "https://www.instagram.com", icon: instagramIcon },
  { label: "X", href: "https://x.com/PlayVervus", icon: xIcon }
]);

const serverUrl = String(import.meta.env.VITE_SERVER_URL || "").replace(/\/+$/, "");

function usePublicPageContent() {
  const { i18n } = useTranslation();
  return getPublicPageContent(i18n.resolvedLanguage || i18n.language);
}

function BrandHeader({ onOpenMenu, onNavigate, onHost, menuLabel }) {
  const { t } = useTranslation();
  const resolvedMenuLabel = menuLabel || t("publicPages.menu.open");
  return (
    <header className="landing-header">
      <div className="landing-brand-mark" aria-label={t("app.name")}>
        <img src={clearBackgroundLogo} alt={t("app.name")} />
      </div>
      {onNavigate ? (
        <nav className="landing-desktop-nav" aria-label={t("publicPages.nav.sectionsAriaLabel")}>
          <button type="button" onClick={() => onNavigate("how")}>{t("publicPages.nav.howItWorks")}</button>
          <button type="button" onClick={() => onNavigate("experiences")}>{t("publicPages.nav.experiences")}</button>
          <button type="button" onClick={() => onNavigate("unlock")}>{t("publicPages.nav.unlock")}</button>
          <button type="button" onClick={() => onNavigate("faq")}>{t("publicPages.nav.faq")}</button>
        </nav>
      ) : null}
      {onHost ? (
        <button className="landing-desktop-host-button" type="button" onClick={onHost}>
          {t("publicPages.hostRoom")}
        </button>
      ) : null}
      {onOpenMenu ? (
        <button className="landing-menu-button" type="button" aria-label={resolvedMenuLabel} onClick={onOpenMenu}>
          <span />
          <span />
          <span />
        </button>
      ) : null}
    </header>
  );
}

function PageHeader({ onBack, backLabel }) {
  const { t } = useTranslation();
  const resolvedBackLabel = backLabel || t("common.back");
  return (
    <header className="public-page-header">
      <button className="public-back-button" type="button" aria-label={resolvedBackLabel} onClick={onBack}>
        <span />
      </button>
      <div className="landing-brand-mark" aria-label={t("app.name")}>
        <img src={clearBackgroundLogo} alt={t("app.name")} />
      </div>
    </header>
  );
}

function Footer({ onNavigate }) {
  const { t } = useTranslation();
  return (
    <footer className="landing-footer">
      <div className="social-icon-row" aria-label={t("publicPages.footer.socialsAriaLabel")}>
        {SOCIAL_LINKS.map((link) => (
          <a
            key={link.label}
            className="social-icon"
            href={link.href}
            target="_blank"
            rel="noreferrer"
            aria-label={link.label}
          >
            <img src={link.icon} alt="" aria-hidden="true" />
          </a>
        ))}
      </div>
      {onNavigate ? (
        <nav className="landing-footer-nav" aria-label={t("publicPages.footer.legalAriaLabel")}>
          <button type="button" onClick={() => onNavigate("terms")}>{t("publicPages.footer.terms")}</button>
          <button type="button" onClick={() => onNavigate("privacy")}>{t("publicPages.footer.privacy")}</button>
          <button type="button" onClick={() => onNavigate("contact")}>{t("publicPages.footer.contact")}</button>
        </nav>
      ) : null}
      <div className="landing-footer-rule" />
      <p>{t("publicPages.footer.tagline")}</p>
    </footer>
  );
}

function CookieBanner({ onNavigate }) {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(() => !hasCookieConsentChoice());

  const dismiss = (choice) => {
    setCookieConsentChoice(choice);
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="landing-cookie-banner" role="region" aria-label={t("publicPages.cookie.ariaLabel")}>
      <div className="landing-cookie-content">
        <span className="landing-cookie-icon" aria-hidden="true" />
        <p>
          {t("publicPages.cookie.message")}{" "}
          <button
            type="button"
            onClick={() => {
              dismiss(COOKIE_CONSENT_CHOICES.CLOSED);
              onNavigate?.("privacy");
            }}
          >
            {t("publicPages.cookie.privacyPolicy")}
          </button>
        </p>
      </div>
      <div className="landing-cookie-actions">
        <button type="button" className="landing-cookie-secondary" onClick={() => dismiss(COOKIE_CONSENT_CHOICES.ESSENTIAL)}>
          {t("publicPages.cookie.essentialOnly")}
        </button>
        <button type="button" className="landing-cookie-primary" onClick={() => dismiss(COOKIE_CONSENT_CHOICES.ALLOW)}>
          {t("publicPages.cookie.allow")}
        </button>
        <button type="button" className="landing-cookie-close" aria-label={t("publicPages.cookie.close")} onClick={() => dismiss(COOKIE_CONSENT_CHOICES.CLOSED)}>
          <span aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function CheckList({ items }) {
  return (
    <ul className="landing-check-list">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function renderHeroHeadline(headline) {
  const headlineText = String(headline || "One Room.\nTotal Chaos.").trim();
  const lines = headlineText.split("\n").filter(Boolean);

  if (lines.length > 1) {
    return lines.map((line, index) => (
      <span key={line} className={index > 0 ? "landing-title-accent" : undefined}>
        {line}
      </span>
    ));
  }

  return <span>{headlineText}</span>;
}

export function LandingHome({
  startPageContent,
  onHost,
  onJoin,
  onOpenMenu,
  onNavigate,
  onStartPreview,
  onUnlock,
  availableModes = [],
  selectedModeId = "standard",
  onSelectedModeChange,
  canSelectMode = true
}) {
  const { t } = useTranslation();
  const handleSectionNavigate = (target) => {
    if (target === "faq") {
      onNavigate?.("faq");
      return;
    }

    document.getElementById(`landing-${target}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="landing-screen">
      <BrandHeader onOpenMenu={onOpenMenu} onNavigate={handleSectionNavigate} onHost={onHost} />

      <section className="landing-hero">
        <h1 className="landing-title">{renderHeroHeadline(startPageContent.headline)}</h1>
        <p className="landing-hero-copy">{startPageContent.description}</p>
        <div className="landing-hero-actions">
          <button className="landing-pill-button landing-pill-button-primary" type="button" onClick={onHost}>
            {startPageContent.hostLabel}
          </button>
          <button className="landing-pill-button landing-pill-button-secondary" type="button" onClick={onJoin}>
            {startPageContent.playLabel}
          </button>
        </div>
      </section>

      <section className="landing-section landing-reality-section" aria-labelledby="reality-title">
        <h2 id="reality-title">{t("publicPages.landing.realityTitle")}</h2>
        <div className="landing-reality-card" aria-hidden="true">
          <span className="reality-scanline reality-scanline-a" />
          <span className="reality-scanline reality-scanline-b" />
        </div>
      </section>

      <section id="landing-how" className="landing-section" aria-labelledby="how-title">
        <h2 id="how-title">{t("publicPages.landing.howTitle")}</h2>
        <p className="landing-section-copy">{t("publicPages.landing.howCopy")}</p>
        <div className="landing-info-card">
          <ul>
            <li>{t("publicPages.landing.howItems.host")}</li>
            <li>{t("publicPages.landing.howItems.instant")}</li>
            <li>{t("publicPages.landing.howItems.players")}</li>
          </ul>
        </div>
      </section>

      <section id="landing-experiences" className="landing-section" aria-labelledby="experiences-title">
        <h2 id="experiences-title">{t("publicPages.landing.experiencesTitle")}</h2>
        <p className="landing-section-copy">{t("publicPages.landing.experiencesCopy")}</p>
        <GameModeSelector
          modes={availableModes}
          selectedModeId={selectedModeId}
          onSelectMode={onSelectedModeChange}
          canSelectMode={canSelectMode}
          className="landing"
        />
      </section>

      <section id="landing-unlock" className="landing-section landing-start-section" aria-labelledby="start-title">
        <h2 id="start-title">{t("publicPages.landing.startTitle")}</h2>
        <p className="landing-section-copy">{t("publicPages.landing.startCopy")}</p>

        <div className="pricing-card pricing-card-preview">
          <span className="pricing-badge">{t("publicPages.landing.preview.badge")}</span>
          <h3>{t("publicPages.landing.preview.titlePrefix")} <span>{t("publicPages.landing.preview.titleStrong")}</span></h3>
          <CheckList items={[t("publicPages.landing.preview.items.run"), t("publicPages.landing.preview.items.mode"), t("publicPages.landing.preview.items.join")]} />
          <button className="landing-pill-button landing-pill-button-primary" type="button" onClick={onStartPreview}>
            {t("publicPages.landing.preview.action")}
          </button>
        </div>

        <div className="pricing-card pricing-card-unlock">
          <span className="pricing-badge">{t("publicPages.landing.unlock.badge")}</span>
          <h3>{t("publicPages.landing.unlock.titlePrefix")} <span>{t("publicPages.landing.unlock.titleStrong")}</span></h3>
          <CheckList items={[t("publicPages.landing.unlock.items.experiences"), t("publicPages.landing.unlock.items.access"), t("publicPages.landing.unlock.items.join")]} />
          <button className="landing-pill-button landing-pill-button-primary" type="button" onClick={onUnlock}>
            {t("publicPages.landing.unlock.action")}
          </button>
        </div>
      </section>

      <Footer onNavigate={onNavigate} />
      <CookieBanner onNavigate={onNavigate} />
    </div>
  );
}

export function LandingMenu({ onClose, onNavigate }) {
  const { t } = useTranslation();
  const items = [
    { id: "faq", label: t("publicPages.menu.items.faq") },
    { id: "language", label: t("publicPages.menu.items.language") },
    { id: "terms", label: t("publicPages.menu.items.terms") },
    { id: "privacy", label: t("publicPages.menu.items.privacy") },
    { id: "contact", label: t("publicPages.menu.items.contact") }
  ];

  return (
    <div className="menu-screen">
      <header className="landing-header menu-header">
        <div className="landing-brand-mark" aria-label={t("app.name")}>
          <img src={clearBackgroundLogo} alt={t("app.name")} />
        </div>
        <button className="menu-close-button" type="button" aria-label={t("publicPages.menu.close")} onClick={onClose}>
          <span />
        </button>
      </header>

      <nav className="menu-link-list" aria-label={t("publicPages.menu.pagesAriaLabel")}>
        {items.map((item) => (
          <button key={item.id} type="button" onClick={() => onNavigate(item.id)}>
            {item.label}
          </button>
        ))}
      </nav>

      <Footer />
    </div>
  );
}

export function LanguagePage({ onBack }) {
  const { t } = useTranslation();

  return (
    <article className="public-page language-page">
      <PageHeader onBack={onBack} />
      <div className="public-page-content language-page-content">
        <p className="public-eyebrow">{t("publicPages.language.eyebrow")}</p>
        <h1 className="public-title">{t("publicPages.language.title")}</h1>
        <div className="language-page-list">
          <LanguageSwitcher className="language-page-switcher" variant="menu-list" showLabel={false} />
        </div>
      </div>
      <Footer />
    </article>
  );
}

function FaqAnswer({ item }) {
  return (
    <div className="faq-answer">
      {item.paragraphs?.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
      {item.bullets?.length ? (
        <ul>
          {item.bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      ) : null}
      {item.steps?.length ? (
        <ol>
          {item.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      ) : null}
      {item.outroParagraphs?.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
      {item.outro ? <p>{item.outro}</p> : null}
    </div>
  );
}

export function FaqPage({ onBack }) {
  const { t } = useTranslation();
  const { faqItems } = usePublicPageContent();
  const [openQuestion, setOpenQuestion] = useState(null);

  return (
    <article className="public-page faq-page">
      <PageHeader onBack={onBack} />
      <div className="public-page-content">
        <p className="public-eyebrow">{t("publicPages.faq.eyebrow")}</p>
        <h1 className="public-title">{t("publicPages.faq.title")}</h1>

        <div className="faq-list">
          {faqItems.map((item, index) => {
            const isOpen = openQuestion === index;

            return (
              <section key={item.question} className={`faq-item${isOpen ? " open" : ""}`}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-${index}`}
                  onClick={() => setOpenQuestion(isOpen ? null : index)}
                >
                  <span>{item.question}</span>
                  <span className="faq-toggle-icon" aria-hidden="true" />
                </button>
                {isOpen ? (
                  <div id={`faq-answer-${index}`}>
                    <FaqAnswer item={item} />
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      </div>
      <Footer />
    </article>
  );
}

function LegalBlocks({ blocks }) {
  return blocks.map((block, index) => {
    const key = `${block.type}-${index}`;

    if (block.type === "list") {
      return (
        <ul key={key}>
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      );
    }

    if (block.type === "label") {
      return <p key={key} className="legal-block-label">{block.text}</p>;
    }

    return <p key={key}>{block.text}</p>;
  });
}

export function LegalPage({ kind, onBack }) {
  const { t } = useTranslation();
  const { companyDetails, privacySections, termsSections } = usePublicPageContent();
  const isPrivacy = kind === "privacy";
  const sections = isPrivacy ? privacySections : termsSections;

  return (
    <article className="public-page legal-page">
      <PageHeader onBack={onBack} />
      <div className="public-page-content legal-page-content">
        <p className="public-eyebrow">{isPrivacy ? t("publicPages.legal.privacyEyebrow") : t("publicPages.legal.termsEyebrow")}</p>
        <h1 className="legal-hero-title">{isPrivacy ? t("publicPages.legal.privacyTitle") : t("publicPages.legal.termsTitle")}</h1>
        <div className="legal-meta">
          {companyDetails.map((detail) => (
            <p key={detail}>{detail}</p>
          ))}
        </div>

        <div className="legal-section-list">
          {sections.map((section) => (
            <section key={section.title} className="legal-section">
              <h2>{section.title}</h2>
              <LegalBlocks blocks={section.blocks} />
            </section>
          ))}
        </div>
      </div>
      <Footer />
    </article>
  );
}

export function ContactPage({ onBack }) {
  const { t } = useTranslation();
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!serverUrl) {
      setStatus(t("publicPages.contact.status.notConfigured"));
      return;
    }

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const email = String(form.get("email") || "").trim();
    const subject = String(form.get("subject") || t("publicPages.contact.defaultSubject")).trim();
    const message = String(form.get("message") || "").trim();

    setIsSubmitting(true);
    setStatus(t("publicPages.contact.status.sending"));

    try {
      const response = await fetch(`${serverUrl}/api/contact-messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, subject, message })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || t("publicPages.contact.status.sendFailed"));
      }
      formElement.reset();
      setStatus(t("publicPages.contact.status.sent"));
    } catch (error) {
      setStatus(error.message || t("publicPages.contact.status.sendFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <article className="public-page contact-page">
      <PageHeader onBack={onBack} />
      <div className="public-page-content">
        <p className="public-eyebrow">{t("publicPages.contact.eyebrow")}</p>
        <h1 className="public-title contact-title">{t("publicPages.contact.title")}</h1>
        <p className="contact-subtitle">{t("publicPages.contact.subtitle")}</p>

        <form className="contact-form" onSubmit={handleSubmit}>
          <label>
            <span>{t("publicPages.contact.fields.email")}</span>
            <input name="email" type="email" autoComplete="email" placeholder={t("publicPages.contact.placeholders.email")} required />
          </label>
          <label>
            <span>{t("publicPages.contact.fields.subject")}</span>
            <input name="subject" type="text" placeholder={t("publicPages.contact.placeholders.subject")} required />
          </label>
          <label>
            <span>{t("publicPages.contact.fields.message")}</span>
            <textarea name="message" placeholder={t("publicPages.contact.placeholders.message")} required />
          </label>

          <p className="contact-status" aria-live="polite">{status}</p>

          <button className="landing-pill-button landing-pill-button-primary contact-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? t("publicPages.contact.submitSending") : t("publicPages.contact.submit")}
          </button>
        </form>
      </div>
    </article>
  );
}

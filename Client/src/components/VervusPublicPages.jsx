import { useState } from "react";
import GameModeSelector from "./GameModeSelector.jsx";
import clearBackgroundLogo from "../assets/images/Logos/Logo_ClearBackground.svg";
import discordIcon from "../assets/images/SocialIcons/SocialIcon_Discord.png";
import instagramIcon from "../assets/images/SocialIcons/SocialIcon_Instagram.png";
import tiktokIcon from "../assets/images/SocialIcons/SocialIcon_TikTok.png";
import xIcon from "../assets/images/SocialIcons/SocialIcon_x.png";
import {
  COMPANY_DETAILS,
  FAQ_ITEMS,
  PRIVACY_SECTIONS,
  TERMS_SECTIONS
} from "../data/publicPageContent.js";

const SOCIAL_LINKS = Object.freeze([
  { label: "TikTok", href: "https://www.tiktok.com", icon: tiktokIcon },
  { label: "Discord", href: "https://discord.com", icon: discordIcon },
  { label: "Instagram", href: "https://www.instagram.com", icon: instagramIcon },
  { label: "X", href: "https://x.com/PlayVervus", icon: xIcon }
]);

function BrandHeader({ onOpenMenu, menuLabel = "Open menu" }) {
  return (
    <header className="landing-header">
      <div className="landing-brand-mark" aria-label="Vervus">
        <img src={clearBackgroundLogo} alt="Vervus" />
      </div>
      {onOpenMenu ? (
        <button className="landing-menu-button" type="button" aria-label={menuLabel} onClick={onOpenMenu}>
          <span />
          <span />
          <span />
        </button>
      ) : null}
    </header>
  );
}

function PageHeader({ onBack, backLabel = "Back" }) {
  return (
    <header className="public-page-header">
      <button className="public-back-button" type="button" aria-label={backLabel} onClick={onBack}>
        <span />
      </button>
      <div className="landing-brand-mark" aria-label="Vervus">
        <img src={clearBackgroundLogo} alt="Vervus" />
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="landing-footer">
      <div className="social-icon-row" aria-label="Vervus social links">
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
      <div className="landing-footer-rule" />
      <p>&copy; 2026 Vervus Interactive. Built for chaos.</p>
    </footer>
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
  onStartPreview,
  onUnlock,
  availableModes = [],
  selectedModeId = "standard",
  onSelectedModeChange,
  canSelectMode = true
}) {
  return (
    <div className="landing-screen">
      <BrandHeader onOpenMenu={onOpenMenu} />

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
        <h2 id="reality-title">Different realities.</h2>
        <div className="landing-reality-card" aria-hidden="true">
          <span className="reality-scanline reality-scanline-a" />
          <span className="reality-scanline reality-scanline-b" />
        </div>
      </section>

      <section className="landing-section" aria-labelledby="how-title">
        <h2 id="how-title">How Vervus works.</h2>
        <p className="landing-section-copy">Instant social multiplayer games. Zero friction.</p>
        <div className="landing-info-card">
          <ul>
            <li>One player hosts. Everyone else joins instantly.</li>
            <li>No downloads. No setup. Just play.</li>
            <li>2-4 players. Built for tension.</li>
          </ul>
        </div>
      </section>

      <section className="landing-section" aria-labelledby="experiences-title">
        <h2 id="experiences-title">Experiences.</h2>
        <p className="landing-section-copy">Choose your reality.</p>
        <GameModeSelector
          modes={availableModes}
          selectedModeId={selectedModeId}
          onSelectMode={onSelectedModeChange}
          canSelectMode={canSelectMode}
          className="landing"
        />
      </section>

      <section className="landing-section landing-start-section" aria-labelledby="start-title">
        <h2 id="start-title">Start playing.</h2>
        <p className="landing-section-copy">Try GLiTCH! or unlock everything.</p>

        <div className="pricing-card pricing-card-preview">
          <span className="pricing-badge">Free Preview</span>
          <h3>Play <span>GLiTCH!</span></h3>
          <CheckList items={["Free preview run", "Standard mode only", "Instant join"]} />
          <button className="landing-pill-button landing-pill-button-primary" type="button" onClick={onStartPreview}>
            Start free preview
          </button>
        </div>

        <div className="pricing-card pricing-card-unlock">
          <span className="pricing-badge">All Experiences</span>
          <h3>Unlock <span>Vervus</span></h3>
          <CheckList items={["All experiences & modes", "24-hour access", "Everyone else joins free"]} />
          <button className="landing-pill-button landing-pill-button-primary" type="button" onClick={onUnlock}>
            Unlock Vervus
          </button>
        </div>
      </section>

      <Footer />
    </div>
  );
}

export function LandingMenu({ onClose, onNavigate }) {
  const items = [
    { id: "faq", label: "FAQ" },
    { id: "terms", label: "Terms of Service" },
    { id: "privacy", label: "Privacy Policy" },
    { id: "contact", label: "Contact" }
  ];

  return (
    <div className="menu-screen">
      <header className="landing-header menu-header">
        <div className="landing-brand-mark" aria-label="Vervus">
          <img src={clearBackgroundLogo} alt="Vervus" />
        </div>
        <button className="menu-close-button" type="button" aria-label="Close menu" onClick={onClose}>
          <span />
        </button>
      </header>

      <nav className="menu-link-list" aria-label="Vervus pages">
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
  const [openQuestion, setOpenQuestion] = useState(null);

  return (
    <article className="public-page faq-page">
      <PageHeader onBack={onBack} />
      <div className="public-page-content">
        <p className="public-eyebrow">Support</p>
        <h1 className="public-title">FAQ</h1>

        <div className="faq-list">
          {FAQ_ITEMS.map((item, index) => {
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
  const isPrivacy = kind === "privacy";
  const sections = isPrivacy ? PRIVACY_SECTIONS : TERMS_SECTIONS;

  return (
    <article className="public-page legal-page">
      <PageHeader onBack={onBack} />
      <div className="public-page-content legal-page-content">
        <p className="public-eyebrow">{isPrivacy ? "Privacy Policy" : "Terms of Service"}</p>
        <h1 className="legal-hero-title">{isPrivacy ? "Your privacy matters." : "The rules of the room."}</h1>
        <div className="legal-meta">
          {COMPANY_DETAILS.map((detail) => (
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
  const [isVerified, setIsVerified] = useState(false);

  const handleSubmit = (event) => {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim();
    const subject = String(form.get("subject") || "Vervus support request").trim();
    const message = String(form.get("message") || "").trim();
    const body = [`From: ${email}`, "", message].join("\n");

    window.location.href = `mailto:support@vervus.live?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <article className="public-page contact-page">
      <PageHeader onBack={onBack} />
      <div className="public-page-content">
        <p className="public-eyebrow">Contact</p>
        <h1 className="public-title contact-title">Need help?</h1>
        <p className="contact-subtitle">Send us a message.</p>

        <form className="contact-form" onSubmit={handleSubmit}>
          <label>
            <span>Email</span>
            <input name="email" type="email" autoComplete="email" placeholder="Your email address" required />
          </label>
          <label>
            <span>Subject</span>
            <input name="subject" type="text" placeholder="Brief summary of your request" required />
          </label>
          <label>
            <span>Message</span>
            <textarea name="message" placeholder="How can we help?" required />
          </label>

          <label className="recaptcha-card">
            <input
              type="checkbox"
              checked={isVerified}
              onChange={(event) => setIsVerified(event.target.checked)}
              required
            />
            <span className="recaptcha-box" aria-hidden="true" />
            <span className="recaptcha-label">I'm not a robot</span>
            <span className="recaptcha-brand">
              <span />
              reCAPTCHA
              <small>Privacy - Terms</small>
            </span>
          </label>

          <button className="landing-pill-button landing-pill-button-primary contact-submit" type="submit">
            Send Message
          </button>
        </form>
      </div>
    </article>
  );
}

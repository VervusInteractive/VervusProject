import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES, normalizeLanguage } from "../i18n.js";

function LanguageSwitcher({ className = "", variant = "default", showLabel = true }) {
  const { i18n, t } = useTranslation();
  const activeLanguage = normalizeLanguage(i18n.resolvedLanguage || i18n.language);
  const wrapperClassName = `language-switcher ${className}`.trim();

  if (variant === "menu-list") {
    return (
      <div className={wrapperClassName} aria-label={t("common.languageSelector")} role="group">
        {showLabel ? <p className="menu-language-label">{t("common.languageSelector")}</p> : null}
        <div className="menu-language-list">
          {SUPPORTED_LANGUAGES.map((language) => {
            const isActive = activeLanguage === language;
            return (
              <button
                key={language}
                type="button"
                className={`menu-language-button${isActive ? " active" : ""}`}
                onClick={() => i18n.changeLanguage(language)}
                aria-pressed={isActive}
              >
                <span>{t(`languages.${language}`)}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={wrapperClassName} aria-label={t("common.languageSelector")} role="group">
      {SUPPORTED_LANGUAGES.map((language) => {
        const isActive = activeLanguage === language;
        return (
          <button
            key={language}
            type="button"
            className={`language-switcher-button${isActive ? " active" : ""}`}
            onClick={() => i18n.changeLanguage(language)}
            aria-pressed={isActive}
          >
            {t(`languages.${language}`)}
          </button>
        );
      })}
    </div>
  );
}

export default LanguageSwitcher;

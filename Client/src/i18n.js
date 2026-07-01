import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import afCommon from "./locales/af/common.json";
import enCommon from "./locales/en/common.json";

const DEFAULT_LANGUAGE = "en";
const SUPPORTED_LANGUAGES = ["en", "af", "fr", "nl", "ru", "pt", "es"];

const LANGUAGE_LABELS = {
  en: "English",
  af: "Afrikaans",
  fr: "Français",
  nl: "Nederlands",
  ru: "Русский",
  pt: "Português",
  es: "Español"
};

const LANGUAGE_SELECTOR_LABELS = {
  en: "Language",
  af: "Taal",
  fr: "Langue",
  nl: "Taal",
  ru: "Язык",
  pt: "Idioma",
  es: "Idioma"
};

const isObject = (value) => value && typeof value === "object" && !Array.isArray(value);

const deepMerge = (base, override) => {
  if (Array.isArray(base) || Array.isArray(override) || !isObject(base) || !isObject(override)) {
    return override === undefined ? base : override;
  }

  const result = { ...base };
  for (const [key, value] of Object.entries(override)) {
    result[key] = key in base ? deepMerge(base[key], value) : value;
  }
  return result;
};

const LOCALE_OVERRIDES = {
  fr: {
    appAlerts: {
      claimEntitlementTransferFailed: "Impossible de récupérer le transfert d'accès",
      connectBeforeCheckout: "Connectez-vous au serveur avant de commencer le paiement.",
      connectBeforeTransferLink: "Connectez-vous au serveur avant de créer un lien de transfert.",
      connectionRestoring: "La connexion est encore en cours de restauration. Réessayez dans un instant.",
      entitlementTransferredAway: "Votre accès a été transféré vers un autre appareil. Les accès ont été actualisés.",
      entitlementTransferredHere: "Accès transféré sur cet appareil.",
      loadExperiencesFailed: "Impossible de charger les expériences",
      playerSessionFailed: "Impossible d'établir la session du joueur",
      refreshPurchaseStatusFailed: "Impossible d'actualiser le statut d'achat",
      roomDisbandedTimeout: "Vous avez dépassé le délai, votre salle a donc été dissoute.",
      startCheckoutFailed: "Impossible de démarrer le paiement"
    },
    appOverlay: {
      home: "Accueil",
      purchaseFailedDescription: "L'achat n'a pas été finalisé. Réessayez quand vous êtes prêt.",
      purchaseFailedTitle: "Échec de l'achat",
      purchaseSuccessDescription: "Votre achat est terminé et les déblocages sont maintenant disponibles.",
      purchaseSuccessTitle: "Achat réussi",
      removedRoomDescriptionLine1: "L'hôte vous a retiré de cette session.",
      removedRoomDescriptionLine2: "Vous pouvez créer votre propre salle à tout moment.",
      removedRoomTitle: "Vous avez été retiré de la salle."
    },
    common: {
      back: "Retour",
      cancel: "Annuler",
      close: "Fermer",
      copied: "Copié",
      copy: "Copier",
      continue: "Continuer",
      loading: "Chargement...",
      retry: "Réessayer",
      skip: "Ignorer"
    },
    lobby: {
      ariaLabel: "Salon Vervus",
      desktopPhone: {
        title: "Vervus est conçu pour les téléphones.",
        description: "Vervus est conçu pour un jeu multijoueur rapide basé sur le tactile et optimisé pour les smartphones.",
        secondaryDescription: "Vous pouvez continuer à explorer sur ordinateur, mais le jeu nécessite un appareil mobile.",
        action: "Explorer sur ordinateur"
      },
      hostRoom: "Créer une salle",
      joinRoom: "Rejoindre une salle",
      hostPage: {
        back: "Retour",
        kicker: "Créer une salle",
        headline: "Comment doit-on vous appeler ?",
        description: "Entrez un nom affiché pour créer votre salle.",
        nameLabel: "Nom affiché",
        namePlaceholder: "ex. Alex",
        submitLabel: "Créer la salle"
      },
      playPage: {
        back: "Retour",
        kicker: "Rejoindre une salle",
        headline: "Entrez. On vous attend.",
        description: "Rejoignez la salle et commencez à jouer.\nAucun téléchargement. Aucun compte.",
        nameLabel: "Nom affiché",
        namePlaceholder: "ex. Alex",
        roomCodeLabel: "Code de salle",
        roomCodePlaceholder: "XX-XX-XX",
        submitLabel: "Rejoindre la salle",
        qrButtonLabel: "Scanner le QR code"
      },
      preview: {
        roomFound: "SALLE TROUVÉE",
        players: {
          one: "{{first}} EST DÉJÀ LÀ",
          two: "{{first}} ET {{second}} SONT DÉJÀ LÀ",
          many: "{{first}}, {{second}} ET {{count}} AUTRES SONT DÉJÀ LÀ"
        },
        status: {
          active: "Salle active",
          full: "Salle complète",
          closed: "Salle fermée"
        }
      },
      qrScanner: {
        title: "Scanner le QR code",
        description: "Placez le QR code dans le cadre.",
        cameraPreviewLabel: "Aperçu caméra",
        messages: {
          startingCamera: "Démarrage de la caméra...",
          pointCamera: "Pointez votre caméra vers le QR code de la salle."
        },
        errors: {
          browserUnsupported: "Ce navigateur ne prend pas en charge le scan via la caméra intégrée.",
          httpsRequired: "Le scan de la caméra nécessite HTTPS.",
          invalidInvite: "Ce QR code n'est pas une invitation de salle Vervus.",
          permissionBlocked: "L'autorisation caméra a été bloquée. Autorisez l'accès et réessayez.",
          noCamera: "Aucune caméra n'a été trouvée sur cet appareil.",
          cameraInUse: "La caméra est déjà utilisée par une autre application.",
          unsupportedSettings: "Cette caméra ne peut pas utiliser les paramètres de scan demandés.",
          browserBlocked: "L'accès à la caméra est bloqué par ce navigateur.",
          generic: "La caméra n'a pas pu démarrer. Vérifiez les autorisations et réessayez."
        }
      },
      roomCode: "Code de salle",
      roomCodeNotice: {
        notFound: {
          title: "Salle introuvable",
          body: "Vérifiez le code avec votre hôte, il a peut-être changé."
        },
        full: {
          title: "La salle est complète",
          body: "Cette partie compte déjà 4 joueurs."
        },
        expired: {
          title: "Salle expirée",
          body: "Cette salle est fermée. Relancez une nouvelle partie avec vos amis quand vous voulez."
        }
      }
    },
    modeSelector: {
      aboutMode: "À propos de {{mode}}",
      closeDescription: "Fermer la description du mode",
      gameModeLabel: "Mode de jeu",
      gameModesAriaLabel: "Modes de jeu {{game}}",
      gamesAriaLabel: "Jeux",
      gotIt: "Compris",
      modeDetailsUnavailable: "Les détails du mode ne sont pas encore disponibles.",
      standardGlitch: {
        glitchHelp: "Touchez GLiTCH! si non.",
        line1: "Restez synchronisés.",
        line2: "Tout le monde voit une icône.",
        line3Prefix: "Est-ce que tout le monde voit",
        line3Strong: "exactement la même chose ?",
        line4Prefix: "Quelqu'un va être",
        line4Strong: "accusé.",
        syncHelp: "Touchez SYNC si oui."
      }
    },
    publicPages: {
      contact: {
        defaultSubject: "Demande d'assistance Vervus",
        eyebrow: "Contact",
        fields: {
          email: "E-mail",
          message: "Message",
          subject: "Objet"
        },
        placeholders: {
          email: "Votre adresse e-mail",
          message: "Comment pouvons-nous vous aider ?",
          subject: "Résumé bref de votre demande"
        },
        status: {
          notConfigured: "Le service de contact n'est pas configuré.",
          sendFailed: "Impossible d'envoyer le message.",
          sending: "Envoi du message...",
          sent: "Message envoyé. Nous reviendrons vers vous rapidement."
        },
        submit: "Envoyer le message",
        submitSending: "Envoi...",
        subtitle: "Envoyez-nous un message.",
        title: "Besoin d'aide ?"
      },
      cookie: {
        allow: "Autoriser",
        ariaLabel: "Préférences de cookies",
        close: "Fermer la bannière de cookies",
        essentialOnly: "Essentiel uniquement",
        message: "Nous utilisons des cookies pour l'analyse et les performances.",
        privacyPolicy: "Politique de confidentialité"
      },
      faq: {
        eyebrow: "Assistance",
        title: "FAQ"
      },
      language: {
        eyebrow: "Préférences",
        title: "Langue"
      },
      footer: {
        contact: "Contact",
        legalAriaLabel: "Pages légales Vervus",
        privacy: "Politique de confidentialité",
        socialsAriaLabel: "Liens sociaux Vervus",
        tagline: "© 2026 Vervus Interactive. Conçu pour le chaos.",
        terms: "Conditions d'utilisation"
      },
      hostRoom: "Créer une salle",
      landing: {
        experiencesCopy: "Choisissez votre réalité.",
        experiencesTitle: "Expériences.",
        howCopy: "Jeux multijoueurs sociaux instantanés. Zéro friction.",
        howItems: {
          host: "Un joueur crée la salle. Tous les autres rejoignent instantanément.",
          instant: "Pas de téléchargement. Pas de configuration. Jouez, c'est tout.",
          players: "2 à 4 joueurs. Conçu pour la tension."
        },
        howTitle: "Comment fonctionne Vervus.",
        preview: {
          action: "Lancer l'aperçu gratuit",
          badge: "Aperçu gratuit",
          items: {
            join: "Rejoindre instantanément",
            mode: "Mode standard uniquement",
            run: "Partie d'essai gratuite"
          },
          titlePrefix: "Jouer à",
          titleStrong: "GLiTCH!"
        },
        realityTitle: "Des réalités différentes.",
        startCopy: "Essayez GLiTCH! ou débloquez tout.",
        startTitle: "Commencez à jouer.",
        unlock: {
          action: "Débloquer Vervus",
          badge: "Toutes les expériences",
          items: {
            access: "Accès 24 heures",
            experiences: "Toutes les expériences et tous les modes",
            join: "Tous les autres rejoignent gratuitement"
          },
          titlePrefix: "Débloquer",
          titleStrong: "Vervus"
        }
      },
      legal: {
        privacyEyebrow: "Politique de confidentialité",
        privacyTitle: "Votre vie privée compte.",
        termsEyebrow: "Conditions d'utilisation",
        termsTitle: "Les règles de la salle."
      },
      menu: {
        close: "Fermer le menu",
        items: {
          contact: "Contact",
          faq: "FAQ",
          language: "Langue",
          privacy: "Politique de confidentialité",
          terms: "Conditions d'utilisation"
        },
        open: "Ouvrir le menu",
        pagesAriaLabel: "Pages Vervus"
      },
      nav: {
        experiences: "Expériences",
        faq: "FAQ",
        howItWorks: "Comment fonctionne Vervus",
        sectionsAriaLabel: "Sections Vervus",
        unlock: "Débloquer"
      }
    },
    glitchGame: {
      comboLabel: "COMBO",
      comboAriaLabel: "{{combo}} combo",
      connection: {
        degradedNote: "- latence élevée détectée ; les effets peuvent sembler plus légers.",
        disconnectedNote: "- connexion perdue. Gardez cet onglet ouvert pendant la reconnexion.",
        label: "Connexion :",
        reconnectingNote: "- tentative de restauration de votre session de salle."
      },
      corruptionLevel: "Niveau de corruption {{level}}",
      currentSymbol: "Symbole actuel",
      getReady: "Préparez-vous",
      heatSurgeActive: "Heat Surge actif",
      lastChance: "Dernière chance",
      loadingAssets: "Chargement des ressources",
      orientationWarning: "Mauvaise orientation. Veuillez pivoter vers",
      paused: {
        description: "Un participant s'est déconnecté. La partie reprendra quand tout le monde sera reconnecté.",
        exitRoom: "Quitter la salle",
        title: "Partie en pause"
      },
      playersWhoVoted: "Joueurs ayant voté",
      playerHasNotVoted: "{{name}} n'a pas encore voté",
      playerHasVoted: "{{name}} a voté",
      previewEndsAt: "L'aperçu se termine au combo {{combo}}",
      returnToRoom: "Retour à la salle",
      roomLabel: "Salle {{roomId}}",
      saveIt: "SAUVEZ-LA !",
      stimuli: {
        bolt: "Éclair",
        eye: "Œil",
        screen: "Écran",
        skull: "Crâne",
        smiley: "Smiley",
        star: "Étoile"
      },
      timeLeftAriaLabel: "Temps restant {{time}}",
      waitingForGameState: "En attente de l'état de la partie..."
    },
    room: {
      story: {
        fallbackHostName: "Hôte",
        status: {
          active: "Salle active",
          lobby: "Salon",
          preview: "Aperçu",
          paymentPending: "Paiement en attente",
          premium: "Premium",
          reconnecting: "Reconnexion",
          ended: "Terminé",
          expired: "Expiré"
        },
        hero: {
          hostPrimary: "Envoyez-le.",
          hostSecondary: "Faites entrer tout le monde.",
          joinStatusPrefix: "Salle",
          joinHeadline: "En attente de tout le monde.",
          joinDescription: "{{host}} démarrera dès que tout le monde sera prêt."
        },
        invite: {
          shareLabel: "Partagez avec votre groupe",
          copyLabel: "Copier le lien",
          copySuccess: "Copié",
          copyError: "Échec de la copie",
          openQr: "Ouvrir le QR code",
          qrTitle: "Scannez pour rejoindre la salle {{room}}",
          qrClose: "Fermer"
        },
        players: {
          label: "Joueurs",
          readyCount: "Prêts",
          joinedCount: "rejoints",
          currentPlayer: "Vous",
          host: "Hôte",
          ready: "Prêt",
          waiting: "En attente...",
          reconnecting: "Reconnexion...",
          hostReconnecting: "Hôte en reconnexion...",
          transferringHost: "Transfert de l'hôte...",
          disconnected: "Déconnecté",
          connected: "Connecté",
          removed: "Retiré de la salle",
          inGame: "En jeu",
          changeColor: "Changer votre couleur",
          leaveRoom: "Quitter la salle",
          removePlayer: "Retirer {{player}}"
        },
        mode: {
          previewLabel: "Aperçu gratuit",
          experienceLabel: "Expérience",
          selectedBy: "sélectionné par {{host}}",
          aboutExperience: "À propos de cette expérience",
          unlockButton: "Débloquer Vervus",
          note: "Les salles d’aperçu sont limitées à GLiTCH!."
        },
        actions: {
          waitingForNextGame: "Une partie est en cours. Vous êtes dans la file pour la suivante et pourrez vous préparer à la fin de cette manche.",
          startPreview: "Lancer l’aperçu gratuit",
          startGame: "Lancer la partie",
          ready: "Je suis prêt",
          notReady: "Je ne suis pas prêt"
        }
      },
      connection: {
        degradedNote: "- latence élevée détectée ; les effets peuvent sembler plus légers.",
        disconnectedNote: "- connexion perdue. Gardez cet onglet ouvert pendant la reconnexion.",
        label: "Connexion :",
        reconnectingNote: "- tentative de restauration de votre session de salle."
      },
      debugButton: "Debug",
      desktop: {
        disabledStartReason: "Jouez sur votre téléphone pour commencer",
        footer: {
          contact: "Contact",
          privacy: "Politique de confidentialité",
          tagline: "© 2026 Vervus Interactive. Conçu pour le chaos.",
          terms: "Conditions d'utilisation"
        },
        hostPill: "Créer une salle",
        legalAriaLabel: "Pages légales Vervus",
        nav: {
          experiences: "Expériences",
          faq: "FAQ",
          howItWorks: "Comment fonctionne Vervus",
          unlock: "Débloquer"
        },
        navAriaLabel: "Navigation de la salle",
        sectionsAriaLabel: "Sections Vervus",
        socialsAriaLabel: "Liens sociaux Vervus"
      },
      diagnostics: {
        ariaLabel: "Diagnostics de la salle",
        off: "off",
        syncing: "synchronisation",
        phase: "Phase : {{phase}}",
        ping: "Ping : {{ping}}",
        sync: "Sync : {{quality}}",
        server: "Serveur : {{server}}",
        ready: "Prêts : {{ready}}/{{total}}",
        preview: "Aperçu : {{preview}}"
      },
      entitlement: {
        expired: "Expiré",
        owned: "Possédé",
        preview: "Aperçu",
        purchaseMode: "Mode achat",
        minutesLeft: "{{minutes}}m restantes",
        hoursMinutesLeft: "{{hours}}h {{minutes}}m restantes"
      },
      leave: {
        title: "Quitter la salle ?",
        hostDescription: "Vous êtes l'hôte. Si vous partez, la salle se ferme pour tout le monde.",
        playerDescription: "Vous quitterez cette salle. L'hôte et les autres joueurs pourront continuer.",
        stayAction: "Rester dans la salle",
        leaveAction: "Quitter la salle"
      },
      orientationWarning: {
        prefix: "Mauvaise orientation. Veuillez pivoter vers"
      },
      purchase: {
        steps: {
          selectingExperience: "Sélection de l'expérience",
          checkout: "Démarrage du paiement",
          payment: "Paiement en cours"
        },
        pending: {
          title: "{{host}} débloque Vervus.",
          description: "La salle reste ouverte pendant le paiement. Vous jouerez dans un instant, restez ici."
        },
        failed: {
          waitingTitle: "En attente de {{host}}",
          waitingDescription: "{{host}} peut réessayer le paiement ou lancer un aperçu gratuit.",
          heroTitle: "{{host}} est revenu.",
          heroDescription: "Le paiement n'a visiblement pas abouti. {{host}} va peut-être réessayer."
        }
      },
      qrModal: {
        imageAlt: "QR code pour rejoindre la salle {{room}}"
      }
    },
    store: {
      access: {
        hour: "{{hours}} heure",
        hours: "{{hours}} heures"
      },
      checkout: {
        accessLabel: "Accès",
        empty: "Aucune expérience n'est disponible pour le moment.",
        experienceOptionsAriaLabel: "Options d'expérience",
        headingAllModes: "Toutes les expériences. Tous les modes. {{access}}.",
        headingDefault: "{{product}}. {{access}}.",
        kicker: "Paiement",
        loading: "Chargement des expériences...",
        payAnotherWay: "Payer autrement",
        payButton: "Payer {{price}}",
        privacyPolicy: "Politique de confidentialité",
        roomStaysOpen: "La salle reste ouverte pendant le paiement.",
        securePayment: "Paiement sécurisé via Stripe",
        startingCheckout: "Démarrage du paiement...",
        termsAnd: "et",
        termsOfService: "Conditions d'utilisation",
        termsPrefix: "J'accepte les",
        termsSuffix: ", et je comprends que l'accès numérique commence immédiatement après l'achat et que mon droit de rétractation ne s'applique plus.",
        totalLabel: "Total",
        unlockVervus: "Débloquer Vervus"
      },
      productLabel: {
        allExperiences: "Toutes les expériences",
        defaultExperience: "Expérience",
        multipleExperiences: "{{count}} expériences",
        singleExperience: "{{count}} expérience"
      },
      unlockMenu: {
        or: "ou",
        recoveryEmailHelp: "Pour les reçus et la récupération d'accès",
        recoveryEmailLabel: "Ajouter une adresse e-mail de récupération",
        recoveryEmailPlaceholder: "Adresse e-mail",
        retryTransferLink: "Réessayer le lien de transfert",
        subtitle: "24 heures - parties illimitées",
        title: "Vervus débloqué",
        transferLinkLabel: "Lien de transfert d'accès",
        transferPreparing: "Préparation du lien de transfert...",
        transferUnavailable: "Lien de transfert indisponible"
      }
    }
  },
  nl: {
    common: {
      back: "Terug",
      cancel: "Annuleren",
      close: "Sluiten",
      copied: "Gekopieerd",
      copy: "Kopiëren",
      continue: "Doorgaan",
      loading: "Laden...",
      retry: "Opnieuw proberen",
      skip: "Overslaan"
    },
    appOverlay: {
      home: "Home",
      purchaseFailedTitle: "Aankoop mislukt",
      purchaseSuccessTitle: "Aankoop voltooid",
      removedRoomTitle: "Je bent uit de kamer verwijderd."
    },
    lobby: {
      ariaLabel: "Vervus lobby",
      hostRoom: "Kamer hosten",
      joinRoom: "Kamer joinen",
      hostPage: {
        back: "Terug",
        kicker: "Host kamer",
        headline: "Hoe zullen we je noemen?",
        description: "Voer een weergavenaam in om je kamer te maken.",
        nameLabel: "Weergavenaam",
        namePlaceholder: "bv. Alex",
        submitLabel: "Kamer hosten"
      },
      playPage: {
        back: "Terug",
        kicker: "Kamer joinen",
        headline: "Kom erin. We wachten.",
        description: "Sluit je aan bij de kamer en begin te spelen.\nGeen download. Geen account.",
        nameLabel: "Weergavenaam",
        namePlaceholder: "bv. Alex",
        roomCodeLabel: "Kamercode",
        roomCodePlaceholder: "XX-XX-XX",
        submitLabel: "Kamer joinen",
        qrButtonLabel: "QR-code scannen"
      },
      roomCode: "Kamercode"
    },
    modeSelector: {
      aboutMode: "Over {{mode}}",
      closeDescription: "Modusbeschrijving sluiten",
      gameModeLabel: "Spelmodus",
      gamesAriaLabel: "Spellen",
      gotIt: "Begrepen"
    },
    publicPages: {
      contact: {
        eyebrow: "Contact",
        title: "Hulp nodig?",
        subtitle: "Stuur ons een bericht.",
        submit: "Bericht verzenden",
        submitSending: "Verzenden..."
      },
      cookie: {
        allow: "Toestaan",
        essentialOnly: "Alleen essentieel",
        message: "We gebruiken cookies voor analyse en prestaties.",
        privacyPolicy: "Privacybeleid"
      },
      faq: {
        eyebrow: "Support",
        title: "FAQ"
      },
      language: {
        eyebrow: "Voorkeuren",
        title: "Taal"
      },
      footer: {
        contact: "Contact",
        privacy: "Privacybeleid",
        tagline: "© 2026 Vervus Interactive. Gebouwd voor chaos.",
        terms: "Servicevoorwaarden"
      },
      hostRoom: "Host een kamer",
      landing: {
        experiencesCopy: "Kies je realiteit.",
        experiencesTitle: "Ervaringen.",
        howCopy: "Directe sociale multiplayergames. Geen gedoe.",
        howTitle: "Hoe Vervus werkt.",
        preview: {
          action: "Start gratis preview",
          badge: "Gratis preview",
          titlePrefix: "Speel",
          titleStrong: "GLiTCH!"
        },
        realityTitle: "Verschillende werkelijkheden.",
        startCopy: "Probeer GLiTCH! of ontgrendel alles.",
        startTitle: "Begin met spelen.",
        unlock: {
          action: "Ontgrendel Vervus",
          badge: "Alle ervaringen",
          titlePrefix: "Ontgrendel",
          titleStrong: "Vervus"
        }
      },
      legal: {
        privacyEyebrow: "Privacybeleid",
        privacyTitle: "Jouw privacy telt.",
        termsEyebrow: "Servicevoorwaarden",
        termsTitle: "De regels van de kamer."
      },
      menu: {
        close: "Menu sluiten",
        items: {
          contact: "Contact",
          faq: "FAQ",
          language: "Taal",
          privacy: "Privacybeleid",
          terms: "Servicevoorwaarden"
        },
        open: "Menu openen",
        pagesAriaLabel: "Vervus-pagina's"
      },
      nav: {
        experiences: "Ervaringen",
        faq: "FAQ",
        howItWorks: "Hoe Vervus werkt",
        sectionsAriaLabel: "Vervus-secties",
        unlock: "Ontgrendel"
      }
    },
    glitchGame: {
      getReady: "Maak je klaar",
      loadingAssets: "Assets laden",
      returnToRoom: "Terug naar kamer",
      waitingForGameState: "Wachten op spelstatus..."
    },
    room: {
      story: {
        fallbackHostName: "Host",
        status: {
          active: "Kamer actief",
          lobby: "Lobby",
          preview: "Preview",
          paymentPending: "Betaling in behandeling",
          premium: "Premium",
          reconnecting: "Opnieuw verbinden",
          ended: "Beëindigd",
          expired: "Verlopen"
        },
        hero: {
          hostPrimary: "Verstuur het.",
          hostSecondary: "Krijg iedereen erin.",
          joinStatusPrefix: "Kamer",
          joinHeadline: "Wachten op iedereen.",
          joinDescription: "{{host}} start zodra iedereen klaar is."
        },
        invite: {
          shareLabel: "Deel met je groep",
          copyLabel: "Joinlink kopiëren",
          copySuccess: "Gekopieerd",
          copyError: "Kopiëren mislukt",
          openQr: "QR-code openen",
          qrTitle: "Scan om kamer {{room}} te joinen",
          qrClose: "Sluiten"
        },
        players: {
          label: "Spelers",
          readyCount: "Klaar",
          joinedCount: "aangesloten",
          currentPlayer: "Jij",
          host: "Host",
          ready: "Klaar",
          waiting: "Wachten...",
          reconnecting: "Opnieuw verbinden...",
          hostReconnecting: "Host verbindt opnieuw...",
          transferringHost: "Host wordt overgedragen...",
          disconnected: "Verbroken",
          connected: "Verbonden",
          removed: "Uit kamer verwijderd",
          inGame: "In spel",
          changeColor: "Verander je kleur",
          leaveRoom: "Kamer verlaten",
          removePlayer: "Verwijder {{player}}"
        },
        mode: {
          previewLabel: "Gratis preview",
          experienceLabel: "Ervaring",
          selectedBy: "geselecteerd door {{host}}",
          aboutExperience: "Over deze ervaring",
          unlockButton: "Ontgrendel Vervus",
          note: "Previewkamers zijn vergrendeld op GLiTCH!."
        },
        actions: {
          waitingForNextGame: "Er is momenteel een game bezig. Je staat in de wachtrij voor de volgende game en kunt je klaarmaken zodra deze ronde eindigt.",
          startPreview: "Start gratis preview",
          startGame: "Start game",
          ready: "Ik ben klaar",
          notReady: "Ik ben niet klaar"
        }
      },
      debugButton: "Debug",
      leave: {
        title: "Kamer verlaten?",
        stayAction: "In de kamer blijven",
        leaveAction: "Kamer verlaten"
      }
    },
    store: {
      checkout: {
        accessLabel: "Toegang",
        kicker: "Afrekenen",
        loading: "Ervaringen laden...",
        payButton: "Betaal {{price}}",
        totalLabel: "Totaal",
        unlockVervus: "Ontgrendel Vervus"
      },
      unlockMenu: {
        title: "Vervus ontgrendeld",
        subtitle: "24 uur - onbeperkte sessies",
        or: "of"
      }
    }
  },
  ru: {
    common: {
      back: "Назад",
      cancel: "Отмена",
      close: "Закрыть",
      copied: "Скопировано",
      copy: "Копировать",
      continue: "Продолжить",
      loading: "Загрузка...",
      retry: "Повторить",
      skip: "Пропустить"
    },
    appOverlay: {
      home: "Главная",
      purchaseFailedTitle: "Покупка не удалась",
      purchaseSuccessTitle: "Покупка завершена",
      removedRoomTitle: "Вас удалили из комнаты."
    },
    lobby: {
      ariaLabel: "Лобби Vervus",
      hostRoom: "Создать комнату",
      joinRoom: "Присоединиться",
      hostPage: {
        back: "Назад",
        kicker: "Создать комнату",
        headline: "Как вас назвать?",
        description: "Введите отображаемое имя, чтобы создать комнату.",
        nameLabel: "Отображаемое имя",
        namePlaceholder: "например, Alex",
        submitLabel: "Создать комнату"
      },
      playPage: {
        back: "Назад",
        kicker: "Присоединиться",
        headline: "Заходите. Мы ждём.",
        description: "Присоединяйтесь к комнате и начинайте играть.\nБез загрузки. Без аккаунта.",
        nameLabel: "Отображаемое имя",
        namePlaceholder: "например, Alex",
        roomCodeLabel: "Код комнаты",
        roomCodePlaceholder: "XX-XX-XX",
        submitLabel: "Войти в комнату",
        qrButtonLabel: "Сканировать QR-код"
      },
      roomCode: "Код комнаты"
    },
    modeSelector: {
      aboutMode: "О режиме {{mode}}",
      closeDescription: "Закрыть описание режима",
      gameModeLabel: "Игровой режим",
      gamesAriaLabel: "Игры",
      gotIt: "Понятно"
    },
    publicPages: {
      contact: {
        eyebrow: "Контакт",
        title: "Нужна помощь?",
        subtitle: "Отправьте нам сообщение.",
        submit: "Отправить сообщение",
        submitSending: "Отправка..."
      },
      cookie: {
        allow: "Разрешить",
        essentialOnly: "Только необходимое",
        message: "Мы используем cookie для аналитики и производительности.",
        privacyPolicy: "Политика конфиденциальности"
      },
      faq: {
        eyebrow: "Поддержка",
        title: "FAQ"
      },
      language: {
        eyebrow: "Настройки",
        title: "Язык"
      },
      footer: {
        contact: "Контакт",
        privacy: "Политика конфиденциальности",
        tagline: "© 2026 Vervus Interactive. Создано для хаоса.",
        terms: "Условия использования"
      },
      hostRoom: "Создать комнату",
      landing: {
        experiencesCopy: "Выберите свою реальность.",
        experiencesTitle: "Режимы.",
        howCopy: "Мгновенные социальные многопользовательские игры. Никакого трения.",
        howTitle: "Как работает Vervus.",
        preview: {
          action: "Запустить бесплатный превью",
          badge: "Бесплатный превью",
          titlePrefix: "Играть в",
          titleStrong: "GLiTCH!"
        },
        realityTitle: "Разные реальности.",
        startCopy: "Попробуйте GLiTCH! или откройте всё.",
        startTitle: "Начать играть.",
        unlock: {
          action: "Открыть Vervus",
          badge: "Все режимы",
          titlePrefix: "Открыть",
          titleStrong: "Vervus"
        }
      },
      legal: {
        privacyEyebrow: "Политика конфиденциальности",
        privacyTitle: "Ваша конфиденциальность важна.",
        termsEyebrow: "Условия использования",
        termsTitle: "Правила комнаты."
      },
      menu: {
        close: "Закрыть меню",
        items: {
          contact: "Контакт",
          faq: "FAQ",
          language: "Язык",
          privacy: "Политика конфиденциальности",
          terms: "Условия использования"
        },
        open: "Открыть меню",
        pagesAriaLabel: "Страницы Vervus"
      },
      nav: {
        experiences: "Режимы",
        faq: "FAQ",
        howItWorks: "Как работает Vervus",
        sectionsAriaLabel: "Разделы Vervus",
        unlock: "Открыть"
      }
    },
    glitchGame: {
      getReady: "Приготовьтесь",
      loadingAssets: "Загрузка ресурсов",
      returnToRoom: "Вернуться в комнату",
      waitingForGameState: "Ожидание состояния игры..."
    },
    room: {
      story: {
        fallbackHostName: "Хост",
        status: {
          active: "Комната активна",
          lobby: "Лобби",
          preview: "Превью",
          paymentPending: "Ожидает оплаты",
          premium: "Премиум",
          reconnecting: "Переподключение",
          ended: "Завершено",
          expired: "Истекло"
        },
        hero: {
          hostPrimary: "Отправляй.",
          hostSecondary: "Собери всех.",
          joinStatusPrefix: "Комната",
          joinHeadline: "Ждём всех.",
          joinDescription: "{{host}} начнет, когда все будут готовы."
        },
        invite: {
          shareLabel: "Поделиться с группой",
          copyLabel: "Скопировать ссылку",
          copySuccess: "Скопировано",
          copyError: "Не удалось скопировать",
          openQr: "Открыть QR-код",
          qrTitle: "Сканируйте, чтобы войти в комнату {{room}}",
          qrClose: "Закрыть"
        },
        players: {
          label: "Игроки",
          readyCount: "Готовы",
          joinedCount: "в комнате",
          currentPlayer: "Вы",
          host: "Хост",
          ready: "Готов",
          waiting: "Ожидание...",
          reconnecting: "Переподключение...",
          hostReconnecting: "Хост переподключается...",
          transferringHost: "Передача хоста...",
          disconnected: "Отключён",
          connected: "Подключён",
          removed: "Удалён из комнаты",
          inGame: "В игре",
          changeColor: "Изменить цвет игрока",
          leaveRoom: "Покинуть комнату",
          removePlayer: "Удалить {{player}}"
        },
        mode: {
          previewLabel: "Бесплатное превью",
          experienceLabel: "Опыт",
          selectedBy: "выбрано {{host}}",
          aboutExperience: "Об этой игре",
          unlockButton: "Открыть Vervus",
          note: "Превью-комнаты ограничены GLiTCH!."
        },
        actions: {
          waitingForNextGame: "Сейчас идет игра. Вы в очереди на следующую и сможете подготовиться, когда этот раунд закончится.",
          startPreview: "Запустить бесплатное превью",
          startGame: "Начать игру",
          ready: "Я готов",
          notReady: "Я не готов"
        }
      },
      debugButton: "Debug",
      leave: {
        title: "Покинуть комнату?",
        stayAction: "Остаться в комнате",
        leaveAction: "Покинуть комнату"
      }
    },
    store: {
      checkout: {
        accessLabel: "Доступ",
        kicker: "Оплата",
        loading: "Загрузка режимов...",
        payButton: "Оплатить {{price}}",
        totalLabel: "Итого",
        unlockVervus: "Открыть Vervus"
      },
      unlockMenu: {
        title: "Vervus открыт",
        subtitle: "24 часа - неограниченные сессии",
        or: "или"
      }
    }
  },
  pt: {
    common: {
      back: "Voltar",
      cancel: "Cancelar",
      close: "Fechar",
      copied: "Copiado",
      copy: "Copiar",
      continue: "Continuar",
      loading: "Carregando...",
      retry: "Tentar novamente",
      skip: "Pular"
    },
    appOverlay: {
      home: "Início",
      purchaseFailedTitle: "Compra falhou",
      purchaseSuccessTitle: "Compra concluída",
      removedRoomTitle: "Você foi removido da sala."
    },
    lobby: {
      ariaLabel: "Lobby Vervus",
      hostRoom: "Criar sala",
      joinRoom: "Entrar na sala",
      hostPage: {
        back: "Voltar",
        kicker: "Criar sala",
        headline: "Como devemos chamar você?",
        description: "Digite um nome de exibição para criar sua sala.",
        nameLabel: "Nome de exibição",
        namePlaceholder: "ex.: Alex",
        submitLabel: "Criar sala"
      },
      playPage: {
        back: "Voltar",
        kicker: "Entrar na sala",
        headline: "Entre. Estamos esperando.",
        description: "Entre na sala e comece a jogar.\nSem download. Sem conta.",
        nameLabel: "Nome de exibição",
        namePlaceholder: "ex.: Alex",
        roomCodeLabel: "Código da sala",
        roomCodePlaceholder: "XX-XX-XX",
        submitLabel: "Entrar na sala",
        qrButtonLabel: "Escanear QR code"
      },
      roomCode: "Código da sala"
    },
    modeSelector: {
      aboutMode: "Sobre {{mode}}",
      closeDescription: "Fechar descrição do modo",
      gameModeLabel: "Modo de jogo",
      gamesAriaLabel: "Jogos",
      gotIt: "Entendi"
    },
    publicPages: {
      contact: {
        eyebrow: "Contato",
        title: "Precisa de ajuda?",
        subtitle: "Envie uma mensagem para nós.",
        submit: "Enviar mensagem",
        submitSending: "Enviando..."
      },
      cookie: {
        allow: "Permitir",
        essentialOnly: "Somente essenciais",
        message: "Usamos cookies para análises e desempenho.",
        privacyPolicy: "Política de Privacidade"
      },
      faq: {
        eyebrow: "Suporte",
        title: "FAQ"
      },
      language: {
        eyebrow: "Preferências",
        title: "Idioma"
      },
      footer: {
        contact: "Contato",
        privacy: "Política de Privacidade",
        tagline: "© 2026 Vervus Interactive. Feito para o caos.",
        terms: "Termos de Serviço"
      },
      hostRoom: "Criar uma sala",
      landing: {
        experiencesCopy: "Escolha sua realidade.",
        experiencesTitle: "Experiências.",
        howCopy: "Jogos sociais multiplayer instantâneos. Sem fricção.",
        howTitle: "Como o Vervus funciona.",
        preview: {
          action: "Iniciar prévia grátis",
          badge: "Prévia grátis",
          titlePrefix: "Jogue",
          titleStrong: "GLiTCH!"
        },
        realityTitle: "Realidades diferentes.",
        startCopy: "Experimente GLiTCH! ou desbloqueie tudo.",
        startTitle: "Comece a jogar.",
        unlock: {
          action: "Desbloquear Vervus",
          badge: "Todas as experiências",
          titlePrefix: "Desbloqueie",
          titleStrong: "Vervus"
        }
      },
      legal: {
        privacyEyebrow: "Política de Privacidade",
        privacyTitle: "Sua privacidade importa.",
        termsEyebrow: "Termos de Serviço",
        termsTitle: "As regras da sala."
      },
      menu: {
        close: "Fechar menu",
        items: {
          contact: "Contato",
          faq: "FAQ",
          language: "Idioma",
          privacy: "Política de Privacidade",
          terms: "Termos de Serviço"
        },
        open: "Abrir menu",
        pagesAriaLabel: "Páginas Vervus"
      },
      nav: {
        experiences: "Experiências",
        faq: "FAQ",
        howItWorks: "Como o Vervus funciona",
        sectionsAriaLabel: "Seções Vervus",
        unlock: "Desbloquear"
      }
    },
    glitchGame: {
      getReady: "Prepare-se",
      loadingAssets: "Carregando recursos",
      returnToRoom: "Voltar para a sala",
      waitingForGameState: "Aguardando estado do jogo..."
    },
    room: {
      story: {
        fallbackHostName: "Host",
        status: {
          active: "Sala ativa",
          lobby: "Lobby",
          preview: "Prévia",
          paymentPending: "Pagamento pendente",
          premium: "Premium",
          reconnecting: "Reconectando",
          ended: "Encerrado",
          expired: "Expirado"
        },
        hero: {
          hostPrimary: "Manda ver.",
          hostSecondary: "Coloque todo mundo dentro.",
          joinStatusPrefix: "Sala",
          joinHeadline: "Esperando todo mundo.",
          joinDescription: "{{host}} vai começar assim que todos estiverem prontos."
        },
        invite: {
          shareLabel: "Compartilhe com seu grupo",
          copyLabel: "Copiar link",
          copySuccess: "Copiado",
          copyError: "Falha ao copiar",
          openQr: "Abrir QR code",
          qrTitle: "Escaneie para entrar na sala {{room}}",
          qrClose: "Fechar"
        },
        players: {
          label: "Jogadores",
          readyCount: "Prontos",
          joinedCount: "entraram",
          currentPlayer: "Você",
          host: "Host",
          ready: "Pronto",
          waiting: "Esperando...",
          reconnecting: "Reconectando...",
          hostReconnecting: "Host reconectando...",
          transferringHost: "Transferindo host...",
          disconnected: "Desconectado",
          connected: "Conectado",
          removed: "Removido da sala",
          inGame: "Em jogo",
          changeColor: "Mude sua cor",
          leaveRoom: "Sair da sala",
          removePlayer: "Remover {{player}}"
        },
        mode: {
          previewLabel: "Prévia grátis",
          experienceLabel: "Experiência",
          selectedBy: "selecionado por {{host}}",
          aboutExperience: "Sobre esta experiência",
          unlockButton: "Desbloquear Vervus",
          note: "As salas de prévia ficam limitadas a GLiTCH!."
        },
        actions: {
          waitingForNextGame: "Uma partida está em andamento. Você entrou na fila da próxima e poderá se preparar quando esta rodada terminar.",
          startPreview: "Iniciar prévia grátis",
          startGame: "Iniciar jogo",
          ready: "Estou pronto",
          notReady: "Não estou pronto"
        }
      },
      debugButton: "Debug",
      leave: {
        title: "Sair da sala?",
        stayAction: "Ficar na sala",
        leaveAction: "Sair da sala"
      }
    },
    store: {
      checkout: {
        accessLabel: "Acesso",
        kicker: "Checkout",
        loading: "Carregando experiências...",
        payButton: "Pagar {{price}}",
        totalLabel: "Total",
        unlockVervus: "Desbloquear Vervus"
      },
      unlockMenu: {
        title: "Vervus desbloqueado",
        subtitle: "24 horas - sessões ilimitadas",
        or: "ou"
      }
    }
  },
  es: {
    common: {
      back: "Atrás",
      cancel: "Cancelar",
      close: "Cerrar",
      copied: "Copiado",
      copy: "Copiar",
      continue: "Continuar",
      loading: "Cargando...",
      retry: "Reintentar",
      skip: "Omitir"
    },
    appOverlay: {
      home: "Inicio",
      purchaseFailedTitle: "Compra fallida",
      purchaseSuccessTitle: "Compra completada",
      removedRoomTitle: "Fuiste eliminado de la sala."
    },
    lobby: {
      ariaLabel: "Lobby de Vervus",
      hostRoom: "Crear sala",
      joinRoom: "Unirse a la sala",
      hostPage: {
        back: "Atrás",
        kicker: "Crear sala",
        headline: "¿Cómo debemos llamarte?",
        description: "Ingresa un nombre visible para crear tu sala.",
        nameLabel: "Nombre visible",
        namePlaceholder: "p. ej. Alex",
        submitLabel: "Crear sala"
      },
      playPage: {
        back: "Atrás",
        kicker: "Unirse a la sala",
        headline: "Entra. Te esperamos.",
        description: "Únete a la sala y empieza a jugar.\nSin descargas. Sin cuenta.",
        nameLabel: "Nombre visible",
        namePlaceholder: "p. ej. Alex",
        roomCodeLabel: "Código de sala",
        roomCodePlaceholder: "XX-XX-XX",
        submitLabel: "Unirse a la sala",
        qrButtonLabel: "Escanear código QR"
      },
      roomCode: "Código de sala"
    },
    modeSelector: {
      aboutMode: "Sobre {{mode}}",
      closeDescription: "Cerrar descripción del modo",
      gameModeLabel: "Modo de juego",
      gamesAriaLabel: "Juegos",
      gotIt: "Entendido"
    },
    publicPages: {
      contact: {
        eyebrow: "Contacto",
        title: "¿Necesitas ayuda?",
        subtitle: "Envíanos un mensaje.",
        submit: "Enviar mensaje",
        submitSending: "Enviando..."
      },
      cookie: {
        allow: "Permitir",
        essentialOnly: "Solo esenciales",
        message: "Usamos cookies para analítica y rendimiento.",
        privacyPolicy: "Política de Privacidad"
      },
      faq: {
        eyebrow: "Soporte",
        title: "FAQ"
      },
      language: {
        eyebrow: "Preferencias",
        title: "Idioma"
      },
      footer: {
        contact: "Contacto",
        privacy: "Política de Privacidad",
        tagline: "© 2026 Vervus Interactive. Creado para el caos.",
        terms: "Términos del Servicio"
      },
      hostRoom: "Crear una sala",
      landing: {
        experiencesCopy: "Elige tu realidad.",
        experiencesTitle: "Experiencias.",
        howCopy: "Juegos sociales multijugador instantáneos. Sin fricción.",
        howTitle: "Cómo funciona Vervus.",
        preview: {
          action: "Iniciar vista previa gratis",
          badge: "Vista previa gratis",
          titlePrefix: "Juega",
          titleStrong: "GLiTCH!"
        },
        realityTitle: "Realidades diferentes.",
        startCopy: "Prueba GLiTCH! o desbloquéalo todo.",
        startTitle: "Empieza a jugar.",
        unlock: {
          action: "Desbloquear Vervus",
          badge: "Todas las experiencias",
          titlePrefix: "Desbloquea",
          titleStrong: "Vervus"
        }
      },
      legal: {
        privacyEyebrow: "Política de Privacidad",
        privacyTitle: "Tu privacidad importa.",
        termsEyebrow: "Términos del Servicio",
        termsTitle: "Las reglas de la sala."
      },
      menu: {
        close: "Cerrar menú",
        items: {
          contact: "Contacto",
          faq: "FAQ",
          language: "Idioma",
          privacy: "Política de Privacidad",
          terms: "Términos del Servicio"
        },
        open: "Abrir menú",
        pagesAriaLabel: "Páginas de Vervus"
      },
      nav: {
        experiences: "Experiencias",
        faq: "FAQ",
        howItWorks: "Cómo funciona Vervus",
        sectionsAriaLabel: "Secciones de Vervus",
        unlock: "Desbloquear"
      }
    },
    glitchGame: {
      getReady: "Prepárate",
      loadingAssets: "Cargando recursos",
      returnToRoom: "Volver a la sala",
      waitingForGameState: "Esperando el estado del juego..."
    },
    room: {
      story: {
        fallbackHostName: "Host",
        status: {
          active: "Sala activa",
          lobby: "Lobby",
          preview: "Vista previa",
          paymentPending: "Pago pendiente",
          premium: "Premium",
          reconnecting: "Reconectando",
          ended: "Finalizado",
          expired: "Expirado"
        },
        hero: {
          hostPrimary: "Envíalo.",
          hostSecondary: "Haz entrar a todos.",
          joinStatusPrefix: "Sala",
          joinHeadline: "Esperando a todos.",
          joinDescription: "{{host}} empezará cuando todos estén listos."
        },
        invite: {
          shareLabel: "Compártelo con tu grupo",
          copyLabel: "Copiar enlace",
          copySuccess: "Copiado",
          copyError: "Error al copiar",
          openQr: "Abrir código QR",
          qrTitle: "Escanea para unirte a la sala {{room}}",
          qrClose: "Cerrar"
        },
        players: {
          label: "Jugadores",
          readyCount: "Listos",
          joinedCount: "unidos",
          currentPlayer: "Tú",
          host: "Host",
          ready: "Listo",
          waiting: "Esperando...",
          reconnecting: "Reconectando...",
          hostReconnecting: "Host reconectando...",
          transferringHost: "Transfiriendo host...",
          disconnected: "Desconectado",
          connected: "Conectado",
          removed: "Eliminado de la sala",
          inGame: "En juego",
          changeColor: "Cambia tu color",
          leaveRoom: "Salir de la sala",
          removePlayer: "Eliminar a {{player}}"
        },
        mode: {
          previewLabel: "Vista previa gratis",
          experienceLabel: "Experiencia",
          selectedBy: "seleccionado por {{host}}",
          aboutExperience: "Sobre esta experiencia",
          unlockButton: "Desbloquear Vervus",
          note: "Las salas de vista previa están bloqueadas en GLiTCH!."
        },
        actions: {
          waitingForNextGame: "Hay una partida activa en este momento. Estás en cola para la siguiente y podrás prepararte cuando esta ronda termine.",
          startPreview: "Iniciar vista previa gratis",
          startGame: "Iniciar partida",
          ready: "Estoy listo",
          notReady: "No estoy listo"
        }
      },
      debugButton: "Debug",
      leave: {
        title: "¿Salir de la sala?",
        stayAction: "Quedarse en la sala",
        leaveAction: "Salir de la sala"
      }
    },
    store: {
      checkout: {
        accessLabel: "Acceso",
        kicker: "Pago",
        loading: "Cargando experiencias...",
        payButton: "Pagar {{price}}",
        totalLabel: "Total",
        unlockVervus: "Desbloquear Vervus"
      },
      unlockMenu: {
        title: "Vervus desbloqueado",
        subtitle: "24 horas - sesiones ilimitadas",
        or: "o"
      }
    }
  }
};

const buildLocaleCommon = (baseCommon, languageCode, overrides = {}) => deepMerge({
  ...baseCommon,
  app: {
    ...baseCommon.app,
    language: LANGUAGE_LABELS[languageCode]
  },
  common: {
    ...baseCommon.common,
    languageSelector: LANGUAGE_SELECTOR_LABELS[languageCode]
  },
  languages: LANGUAGE_LABELS
}, overrides);

const normalizeLanguage = (language) => {
  const normalized = String(language || "").trim().toLowerCase();
  if (!normalized) return DEFAULT_LANGUAGE;

  const exactMatch = SUPPORTED_LANGUAGES.find((value) => value === normalized);
  if (exactMatch) return exactMatch;

  const baseLanguage = normalized.split("-")[0];
  return SUPPORTED_LANGUAGES.includes(baseLanguage) ? baseLanguage : DEFAULT_LANGUAGE;
};

const getInitialLanguage = () => {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;
  return normalizeLanguage(window.localStorage.getItem("vervusLanguage") || navigator.language);
};

const resources = {
  af: {
    common: buildLocaleCommon(afCommon, "af")
  },
  en: {
    common: buildLocaleCommon(enCommon, "en")
  },
  fr: {
    common: buildLocaleCommon(enCommon, "fr", LOCALE_OVERRIDES.fr)
  },
  nl: {
    common: buildLocaleCommon(enCommon, "nl", LOCALE_OVERRIDES.nl)
  },
  ru: {
    common: buildLocaleCommon(enCommon, "ru", LOCALE_OVERRIDES.ru)
  },
  pt: {
    common: buildLocaleCommon(enCommon, "pt", LOCALE_OVERRIDES.pt)
  },
  es: {
    common: buildLocaleCommon(enCommon, "es", LOCALE_OVERRIDES.es)
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: getInitialLanguage(),
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES,
    defaultNS: "common",
    ns: ["common"],
    interpolation: {
      escapeValue: false
    }
  });

if (typeof document !== "undefined") {
  document.documentElement.lang = i18n.resolvedLanguage || DEFAULT_LANGUAGE;
}

i18n.on("languageChanged", (language) => {
  if (typeof window !== "undefined") {
    window.localStorage.setItem("vervusLanguage", language);
  }

  if (typeof document !== "undefined") {
    document.documentElement.lang = language;
  }
});

export { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, normalizeLanguage };
export default i18n;

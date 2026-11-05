/**
 * Privacy Policy and Terms & Conditions content.
 *
 * The text describes how this app actually behaves today (local-first, no
 * servers, no tracking). Update `contactEmail` and `jurisdiction` before
 * publishing, and bump `version` whenever the documents change — the version
 * is stored with every user's consent record.
 */
export const LEGAL = {
  appName: "Cali's Task",
  version: "2026-11-04",
  effectiveDate: "November 4, 2026",
  contactEmail: "privacy@example.com",
  jurisdiction: "the country in which the service owner is established",
};

export interface LegalSection {
  id: string;
  title: string;
  body: (string | string[])[];
}

export interface LegalDoc {
  slug: "privacy-policy" | "terms-and-conditions";
  title: string;
  summary: string;
  sections: LegalSection[];
}

const { appName, contactEmail, jurisdiction } = LEGAL;

export const PRIVACY_POLICY: LegalDoc = {
  slug: "privacy-policy",
  title: "Privacy Policy",
  summary: `How ${appName} collects, uses and protects your information.`,
  sections: [
    {
      id: "introduction",
      title: "Introduction",
      body: [
        `${appName} ("we", "us", "the app") is a personal task and sprint monitoring tool. This Privacy Policy explains what information the app handles when you create an account and use it, where that information is kept, and the choices you have.`,
        `By creating an account you confirm that you have read this policy. If you do not agree with it, please do not use the app.`,
      ],
    },
    {
      id: "information-we-collect",
      title: "Information We Collect",
      body: [
        "We collect only what is needed to run your workspace:",
        [
          "Account details: your full name, email address and username.",
          "Credentials: your password, which is never stored in readable form — only a salted, one-way hash (PBKDF2-SHA-256) is kept.",
          "Workspace content: tasks, sprints, notes, blockers, time logs and activity history that you enter.",
          "Consent record: the version of these documents you accepted and the date and time you accepted them.",
          "Preferences: theme, sidebar layout and intro-animation settings.",
        ],
        "We do not collect payment details, precise location, contacts, or device identifiers.",
      ],
    },
    {
      id: "how-we-use",
      title: "How We Use Your Information",
      body: [
        [
          "To create and secure your account and sign you in.",
          "To store and display your tasks, sprints, reports and notifications.",
          "To remember your preferences between visits.",
          "To keep a record of your consent to these terms.",
        ],
        "We do not use your information for advertising, profiling, or automated decision-making, and we do not sell it.",
      ],
    },
    {
      id: "storage-and-security",
      title: "Data Storage and Security",
      body: [
        `In the current version, all account and workspace data is stored locally in your web browser's storage on the device you use. It is not sent to or stored on our servers.`,
        "Passwords are salted and hashed before they are saved. Anyone with access to your device and browser profile may still be able to access locally stored data, so protect your device with a screen lock and sign out on shared computers.",
        "If a future version introduces cloud sync, this policy will be updated before any data leaves your device, and you will be asked to accept the new version.",
      ],
    },
    {
      id: "sharing",
      title: "Data Sharing and Disclosure",
      body: [
        "We do not share, sell, rent or trade your personal information with third parties.",
        "Because data stays on your device, we cannot access or disclose it. If you export a backup file, you are responsible for where you store or send it.",
      ],
    },
    {
      id: "cookies",
      title: "Cookies and Tracking",
      body: [
        `${appName} does not use advertising or analytics cookies, tracking pixels, or third-party trackers.`,
        "The app uses your browser's local storage and session storage strictly to keep you signed in (when you choose \"Remember me\" or for the current session), save your workspace, and remember your preferences. These are essential for the app to work.",
      ],
    },
    {
      id: "user-rights",
      title: "User Rights and Data Access",
      body: [
        "You have the right to access, correct, export and delete your information. In the app you can:",
        [
          "View and edit all of your workspace content at any time.",
          "Export your workspace as a JSON file from Settings → Data.",
          "Change your display name in Settings → Profile.",
          "Delete your data by resetting the workspace or clearing this site's data in your browser settings.",
        ],
        `For any other request, contact us at ${contactEmail}.`,
      ],
    },
    {
      id: "retention",
      title: "Data Retention",
      body: [
        "Your information is kept on your device until you delete it, reset your workspace, or clear your browser's site data. Signing out ends your session but does not delete your workspace.",
      ],
    },
    {
      id: "children",
      title: "Children's Privacy",
      body: [
        `${appName} is not directed at children under 13 (or the minimum age required in your country), and we do not knowingly collect information from them. If you believe a child has created an account, contact us and we will help remove it.`,
      ],
    },
    {
      id: "contact",
      title: "Contact Information",
      body: [`If you have questions about this Privacy Policy or your data, contact us at ${contactEmail}.`],
    },
  ],
};

export const TERMS: LegalDoc = {
  slug: "terms-and-conditions",
  title: "Terms & Conditions",
  summary: `The rules for using ${appName}.`,
  sections: [
    {
      id: "acceptance",
      title: "Acceptance of Terms",
      body: [
        `These Terms & Conditions ("Terms") govern your use of ${appName}. By creating an account or using the app, you agree to these Terms and to our Privacy Policy. If you do not agree, do not use the app.`,
      ],
    },
    {
      id: "registration",
      title: "Account Registration",
      body: [
        [
          "You must provide accurate information when you register and keep it up to date.",
          "You are responsible for keeping your password confidential and for all activity under your account.",
          "You must be at least 13 years old, or the minimum age required in your country, to create an account.",
        ],
      ],
    },
    {
      id: "responsibilities",
      title: "User Responsibilities",
      body: [
        [
          "Keep your device secure and sign out on shared computers.",
          "Make regular backups using the export feature; locally stored data can be lost if your browser data is cleared.",
          "Make sure you have the right to store any information you enter, including information about other people or your employer.",
        ],
      ],
    },
    {
      id: "acceptable-use",
      title: "Acceptable Use",
      body: [
        "You agree not to:",
        [
          "Use the app for any unlawful purpose or to store unlawful content.",
          "Attempt to interfere with, reverse engineer, or disrupt the app or its security features.",
          "Access another person's account without permission.",
        ],
      ],
    },
    {
      id: "ip",
      title: "Intellectual Property",
      body: [
        `The app, its design, code, logos and branding are owned by the ${appName} owner and protected by intellectual property laws. You keep full ownership of the content you create in your workspace.`,
      ],
    },
    {
      id: "privacy",
      title: "Privacy and Data Protection",
      body: [
        "Your use of the app is also governed by our Privacy Policy, which explains how your information is collected, stored and protected. Your consent and its timestamp are recorded when you register.",
      ],
    },
    {
      id: "termination",
      title: "Account Suspension and Termination",
      body: [
        "You may stop using the app and delete your data at any time. We may suspend or end access to the app if these Terms are seriously or repeatedly breached, or if required by law.",
      ],
    },
    {
      id: "availability",
      title: "Service Availability",
      body: [
        `${appName} is provided on an "as is" and "as available" basis. We aim to keep it working well but do not guarantee it will be uninterrupted, error-free, or that locally stored data cannot be lost. Features may change over time.`,
      ],
    },
    {
      id: "liability",
      title: "Limitation of Liability",
      body: [
        "To the fullest extent permitted by law, we are not liable for any indirect, incidental or consequential damages, or for loss of data, profits or business, arising from your use of or inability to use the app. Nothing in these Terms limits liability that cannot be limited under applicable law.",
      ],
    },
    {
      id: "changes",
      title: "Changes to Terms",
      body: [
        "We may update these Terms from time to time. When we do, we will update the effective date and, for material changes, ask you to review and accept the new version before continuing to use the app.",
      ],
    },
    {
      id: "law",
      title: "Governing Law",
      body: [`These Terms are governed by the laws of ${jurisdiction}, without regard to conflict-of-law rules.`],
    },
    {
      id: "contact",
      title: "Contact Information",
      body: [`Questions about these Terms? Contact us at ${contactEmail}.`],
    },
  ],
};

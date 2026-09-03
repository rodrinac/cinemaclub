import React from "react";
import LegalDocumentPage from "@/components/LegalDocumentPage";

const LAST_UPDATED = "September 3, 2026";

const PrivacyPolicy = () => (
  <LegalDocumentPage
    title="PRIVACY POLICY"
    lastUpdated={LAST_UPDATED}
    testID="privacy-policy-page"
    sections={[
      {
        heading: "Overview",
        body: "Cinema Club is a movie discovery app. This placeholder Privacy Policy explains, in general terms, what information the app handles and how. Replace this text with your organization's reviewed legal copy before shipping to production.",
      },
      {
        heading: "Information We Collect",
        body: "Cinema Club stores your favorites/bookmarks and content preferences (such as the adult-content filter and genre filters) locally on your device. The app does not require account creation and does not collect personal information such as your name, email address, or precise location.",
      },
      {
        heading: "Third-Party Services",
        body: "Movie data, images, and trailers are provided by The Movie Database (TMDB) via a proxy API. Requests to load movie information are sent to that proxy, which forwards them to TMDB; no personal data is included in these requests beyond what is necessary to fetch movie details.",
      },
      {
        heading: "Data Storage",
        body: "Your bookmarks and settings are stored locally on your device (via on-device storage) and are not transmitted to or stored on any Cinema Club server.",
      },
      {
        heading: "Your Choices",
        body: "You can clear your bookmarks and preferences at any time by clearing the app's local storage, or by uninstalling the app.",
      },
      {
        heading: "Contact",
        body: "If you have questions about this Privacy Policy, please reach out via the feedback option in Settings.",
      },
    ]}
  />
);

export default PrivacyPolicy;

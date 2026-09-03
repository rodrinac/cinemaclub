import React from "react";
import LegalDocumentPage from "@/components/LegalDocumentPage";

const LAST_UPDATED = "September 3, 2026";

const TermsOfService = () => (
  <LegalDocumentPage
    title="TERMS OF SERVICE"
    lastUpdated={LAST_UPDATED}
    testID="terms-of-service-page"
    sections={[
      {
        heading: "Acceptance of Terms",
        body: "By using Cinema Club, you agree to these Terms of Service. This is placeholder copy — replace it with your organization's reviewed legal terms before shipping to production.",
      },
      {
        heading: "Use of the App",
        body: "Cinema Club lets you browse, search, and bookmark movies using data provided by The Movie Database (TMDB). You agree to use the app only for lawful, personal, non-commercial purposes.",
      },
      {
        heading: "Content",
        body: "Movie titles, images, descriptions, and trailers displayed in the app are provided by TMDB and its data partners. Cinema Club does not claim ownership of this content and displays it under TMDB's terms of use.",
      },
      {
        heading: "No Warranty",
        body: "Cinema Club is provided \"as is\" without warranties of any kind. Movie information, availability, and trailers may be inaccurate, incomplete, or unavailable at times, since they depend on third-party data.",
      },
      {
        heading: "Changes to These Terms",
        body: "These Terms may be updated from time to time. Continued use of the app after changes are made constitutes acceptance of the revised Terms.",
      },
      {
        heading: "Contact",
        body: "If you have questions about these Terms, please reach out via the feedback option in Settings.",
      },
    ]}
  />
);

export default TermsOfService;

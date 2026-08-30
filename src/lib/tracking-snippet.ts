/**
 * The one place the website tracking embed is defined. Used by the settings
 * page (a client copying their own snippet) and the admin Client Setup panel
 * (Marcel grabbing a specific client's snippet) so the two can never drift.
 * t.js posts page views to this portal's /api/track keyed by data-client-id.
 */
export function buildTrackingSnippet(clientId: string): string {
  return `<script defer src="https://portal.nexli.net/t.js" data-client-id="${clientId}"></script>`;
}

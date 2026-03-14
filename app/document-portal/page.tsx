import type { Metadata } from 'next';
import DocumentPortal from '../../components/DocumentPortal';

export const metadata: Metadata = {
  title: 'Secure Document Portal | CPA Client Document Collection | Nexli',
  description: "Collect client tax documents securely through your firm's branded portal. AES-256 encryption, per-firm isolated storage, IRS Pub 4557 compliant. No more emailing W-2s.",
  alternates: { canonical: '/document-portal' },
};

export default function DocumentPortalPage() {
  return <DocumentPortal />;
}

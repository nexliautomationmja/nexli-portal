import type { Metadata } from 'next';
import TermsAndConditions from '../../components/TermsAndConditions';

export const metadata: Metadata = {
  title: 'Terms and Conditions | Nexli Automation',
  description: 'Nexli Automation terms and conditions of service.',
  alternates: { canonical: '/terms' },
  robots: 'noindex, nofollow',
};

export default function TermsPage() {
  return <TermsAndConditions />;
}

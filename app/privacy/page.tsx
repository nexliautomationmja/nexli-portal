import type { Metadata } from 'next';
import PrivacyPolicy from '../../components/PrivacyPolicy';

export const metadata: Metadata = {
  title: 'Privacy Policy | Nexli Automation',
  description: 'Nexli Automation privacy policy. Learn how we collect, use, and protect your personal information.',
  alternates: { canonical: '/privacy' },
  robots: 'noindex, nofollow',
};

export default function PrivacyPage() {
  return <PrivacyPolicy />;
}

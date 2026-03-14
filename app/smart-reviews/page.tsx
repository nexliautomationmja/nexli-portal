import type { Metadata } from 'next';
import SmartReviews from '../../components/SmartReviews';

export const metadata: Metadata = {
  title: 'Smart Reviews | Automated Google Review Management for CPAs | Nexli',
  description: 'Automatically request, route, and manage Google reviews for your CPA or accounting firm. Build your online reputation and strengthen trust with the prospects already finding you.',
  alternates: { canonical: '/smart-reviews' },
};

export default function SmartReviewsPage() {
  return <SmartReviews />;
}

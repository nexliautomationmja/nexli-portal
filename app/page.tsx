import type { Metadata } from 'next';
import HomeContent from '../components/HomeContent';

export const metadata: Metadata = {
  title: 'CPA Website Design & Automation | Nexli | Premium Websites for CPAs & Accounting Firms',
  description: 'Premium website design and AI automation for established CPAs and accounting firms. We help firms streamline operations, automate client intake, and scale capacity — so you can serve more clients without adding headcount.',
  alternates: { canonical: '/' },
};

export default function HomePage() {
  return <HomeContent />;
}

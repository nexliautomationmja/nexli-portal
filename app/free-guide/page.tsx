import type { Metadata } from 'next';
import FreeGuide from '../../components/FreeGuide';

export const metadata: Metadata = {
  title: 'Free Guide | How Established CPA Firms Scale Client Capacity | Nexli',
  description: 'Download the free guide for established CPAs and accounting firms on streamlining operations and scaling your practice through premium website design and AI-powered automation.',
  alternates: { canonical: '/free-guide' },
};

export default function FreeGuidePage() {
  return <FreeGuide />;
}

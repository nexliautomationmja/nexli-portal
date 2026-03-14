import type { Metadata } from 'next';
import Portfolio from '../../components/Portfolio';

export const metadata: Metadata = {
  title: 'Portfolio | Premium CPA & Accounting Firm Website Designs | Nexli',
  description: 'Explore our portfolio of premium website designs for CPAs and accounting firms. Each project is custom-crafted to convert visitors into clients.',
  alternates: { canonical: '/portfolio' },
};

export default function PortfolioPage() {
  return <Portfolio />;
}

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import SummitTaxGroup from './portfolio/SummitTaxGroup';
import ClarityAdvisory from './portfolio/ClarityAdvisory';
import MeridianFinancial from './portfolio/MeridianFinancial';
import HarborWealth from './portfolio/HarborWealth';

const PORTFOLIO_FIRMS: Record<string, React.FC<{ navigate?: (view: string, slug?: string) => void }>> = {
  'summit-tax-group': SummitTaxGroup,
  'clarity-advisory': ClarityAdvisory,
  'meridian-financial': MeridianFinancial,
  'harbor-wealth': HarborWealth,
};

const VIEW_TO_PATH: Record<string, string> = {
  home: '/',
  portfolio: '/portfolio',
  services: '/rainmaker',
  blog: '/blog',
  guide: '/free-guide',
  smartReviews: '/smart-reviews',
  documentPortal: '/document-portal',
  privacy: '/privacy',
  terms: '/terms',
  portfolioFirm: '/portfolio',
  blogPost: '/blog',
};

export default function PortfolioFirmContent({ slug }: { slug: string }) {
  const router = useRouter();
  const FirmComponent = PORTFOLIO_FIRMS[slug];

  const navigate = (view: string, extraSlug?: string) => {
    if (view === 'portfolioFirm' && extraSlug) {
      router.push(`/portfolio/${extraSlug}`);
    } else if (view === 'blogPost' && extraSlug) {
      router.push(`/blog/${extraSlug}`);
    } else {
      router.push(VIEW_TO_PATH[view] || '/');
    }
  };

  if (!FirmComponent) return null;

  return <FirmComponent navigate={navigate} />;
}

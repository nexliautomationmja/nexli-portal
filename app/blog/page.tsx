import type { Metadata } from 'next';
import Blog from '../../components/Blog';

export const metadata: Metadata = {
  title: 'Blog | CPA & Accounting Firm Insights | Nexli',
  description: 'Expert insights on CPA website design, accounting firm operations, SEO, AI automation, and practice scaling strategies for established firms.',
  alternates: { canonical: '/blog' },
};

export default function BlogPage() {
  return <Blog />;
}

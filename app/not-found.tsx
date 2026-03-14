import type { Metadata } from 'next';
import NotFound from '../components/NotFound';

export const metadata: Metadata = {
  title: 'Page Not Found | Nexli Automation',
  description: 'The page you are looking for could not be found.',
  robots: 'noindex, nofollow',
};

export default function NotFoundPage() {
  return <NotFound />;
}

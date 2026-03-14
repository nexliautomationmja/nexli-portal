import { Suspense } from 'react';
import type { Metadata } from 'next';
import BookingConfirmed from '../../components/BookingConfirmed';

export const metadata: Metadata = {
  title: 'Booking Confirmed | Your Strategy Session is Set | Nexli',
  description: 'Your Digital Rainmaker strategy session is confirmed. Watch the welcome video, share your firm details, and prepare for your call with Nexli.',
  alternates: { canonical: '/booking-confirmed' },
  robots: 'noindex, nofollow',
};

export default function BookingConfirmedPage() {
  return (
    <Suspense fallback={null}>
      <BookingConfirmed />
    </Suspense>
  );
}

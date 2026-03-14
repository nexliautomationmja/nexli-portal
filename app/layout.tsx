import type { Metadata } from 'next';
import Script from 'next/script';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import ThemeProvider from '../components/ThemeProvider';
import QualificationProvider from '../components/QualificationProvider';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'CPA Website Design & Automation | Nexli | Premium Websites for CPAs & Accounting Firms',
    template: '%s',
  },
  description: 'Premium website design and AI automation for established CPAs and accounting firms. We help firms streamline operations, automate client intake, and scale capacity — so you can serve more clients without adding headcount.',
  keywords: 'CPA website design, accounting firm website, CPA automation, CPA practice management, accounting firm operations, tax professional website, CPA workflow automation, accounting firm technology',
  authors: [{ name: 'Nexli Automation' }],
  robots: 'index, follow',
  metadataBase: new URL('https://www.nexli.net'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    url: 'https://www.nexli.net/',
    title: 'CPA Website Design & Automation | Nexli | Premium Websites for CPAs & Accounting Firms',
    description: 'Premium website design and AI automation for established CPAs and accounting firms. Streamline operations and scale your client capacity.',
    images: [{ url: '/og-image.png' }],
    siteName: 'Nexli Automation',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CPA Website Design & Automation | Nexli | Premium Websites for CPAs & Accounting Firms',
    description: 'Premium website design and AI automation for established CPAs and accounting firms. Streamline operations and scale your client capacity.',
    images: ['/og-image.png'],
    site: '@nexliautomation',
  },
  icons: {
    icon: '/logos/nexli-icon-gradient.png',
    apple: '/logos/nexli-icon-gradient.png',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': 'https://www.nexli.net/#organization',
      name: 'Nexli Automation',
      url: 'https://www.nexli.net',
      logo: {
        '@type': 'ImageObject',
        url: 'https://www.nexli.net/logos/nexli-icon-gradient.png',
      },
      description: 'Premium website design and AI automation for CPAs and accounting firms.',
      email: 'mail@nexli.net',
      sameAs: [],
    },
    {
      '@type': 'WebSite',
      '@id': 'https://www.nexli.net/#website',
      url: 'https://www.nexli.net',
      name: 'Nexli Automation',
      publisher: { '@id': 'https://www.nexli.net/#organization' },
      description: 'Premium website design and AI automation for CPAs and accounting firms.',
    },
    {
      '@type': 'ProfessionalService',
      '@id': 'https://www.nexli.net/#service',
      name: 'Nexli Automation',
      url: 'https://www.nexli.net',
      logo: 'https://www.nexli.net/logos/nexli-icon-gradient.png',
      image: 'https://www.nexli.net/og-image.png',
      description: 'We build premium websites and AI automation systems for established CPAs and accounting firms to streamline operations and scale client capacity.',
      priceRange: '$$$',
      serviceType: [
        'CPA Website Design',
        'Accounting Firm Website Development',
        'AI Automation for CPAs',
        'Practice Automation for Accounting Firms',
        'CPA Marketing Services',
        'Tax Professional Website Design',
      ],
      areaServed: { '@type': 'Country', name: 'United States' },
      hasOfferCatalog: {
        '@type': 'OfferCatalog',
        name: 'Digital Rainmaker System',
        itemListElement: [
          {
            '@type': 'Offer',
            itemOffered: {
              '@type': 'Service',
              name: 'Premium Website Design',
              description: 'Custom, conversion-optimized websites for CPAs and accounting firms that build trust and convert the prospects already finding you.',
            },
          },
          {
            '@type': 'Offer',
            itemOffered: {
              '@type': 'Service',
              name: 'AI Automation Layer',
              description: '24/7 lead capture, automated booking, missed-call text-back, and intelligent nurture sequences.',
            },
          },
          {
            '@type': 'Offer',
            itemOffered: {
              '@type': 'Service',
              name: 'Google Review Amplification',
              description: 'Systematically request and route reviews to build your online reputation.',
            },
          },
        ],
      },
    },
    {
      '@type': 'FAQPage',
      '@id': 'https://www.nexli.net/#faq',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'What makes a good CPA website?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'A good CPA website builds trust quickly through professional design, clear value propositions, social proof from client testimonials, mobile-responsive layouts, and strategic calls-to-action that convert visitors into consultations.',
          },
        },
        {
          '@type': 'Question',
          name: 'How can established CPA firms handle more clients without adding staff?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Established CPA firms can scale their client capacity through AI-powered automation that handles intake processing, follow-up sequences, appointment scheduling, and client communication — freeing up the team to focus on high-value accounting work instead of administrative tasks.',
          },
        },
        {
          '@type': 'Question',
          name: 'What is the Digital Rainmaker System?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'The Digital Rainmaker System is a three-part solution that combines a premium website, AI automation layer for 24/7 inbound processing and follow-up, and a Google review amplification engine — helping established CPA and accounting firms streamline operations and scale their client capacity.',
          },
        },
      ],
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>
        {/* Meta Pixel */}
        <noscript>
          <img
            height="1"
            width="1"
            style={{ display: 'none' }}
            src="https://www.facebook.com/tr?id=910151701422761&ev=PageView&noscript=1"
            alt=""
          />
        </noscript>

        <ThemeProvider>
          <QualificationProvider>
            <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-main)] transition-colors duration-300">
              {children}
              <Navbar />
              <Footer />
            </div>
          </QualificationProvider>
        </ThemeProvider>

        <SpeedInsights />
        <Analytics />

        {/* Meta Pixel Script */}
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '910151701422761');
          fbq('track', 'PageView');`}
        </Script>

        {/* Nexli Analytics */}
        <Script
          src="https://portal.nexli.net/t.js"
          data-client-id="481a4b0a-f225-46d8-b96f-537b0528533f"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}

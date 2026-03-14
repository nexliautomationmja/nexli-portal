const BASE_URL = 'https://www.nexli.net';
const SITE_NAME = 'Nexli Automation';
const DEFAULT_OG_IMAGE = `${BASE_URL}/og-image.png`;

interface SEOConfig {
  title: string;
  description: string;
  canonical: string;
  ogType?: string;
  ogImage?: string;
  ogImageAlt?: string;
  twitterCard?: string;
  noIndex?: boolean;
  jsonLd?: object[];
}

function setMetaTag(attribute: string, key: string, content: string) {
  let el = document.querySelector(`meta[${attribute}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attribute, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setCanonical(url: string) {
  let el = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', url);
}

function setJsonLd(id: string, data: object) {
  let el = document.getElementById(id) as HTMLScriptElement | null;
  if (!el) {
    el = document.createElement('script');
    el.id = id;
    el.type = 'application/ld+json';
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

function removeJsonLd(id: string) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

export function updateSEO(config: SEOConfig) {
  // Title
  document.title = config.title;

  // Meta description
  setMetaTag('name', 'description', config.description);

  // Robots
  if (config.noIndex) {
    setMetaTag('name', 'robots', 'noindex, nofollow');
  } else {
    setMetaTag('name', 'robots', 'index, follow');
  }

  // Canonical
  setCanonical(config.canonical);

  // Open Graph
  setMetaTag('property', 'og:type', config.ogType || 'website');
  setMetaTag('property', 'og:url', config.canonical);
  setMetaTag('property', 'og:title', config.title);
  setMetaTag('property', 'og:description', config.description);
  setMetaTag('property', 'og:image', config.ogImage || DEFAULT_OG_IMAGE);
  setMetaTag('property', 'og:site_name', SITE_NAME);
  setMetaTag('property', 'og:locale', 'en_US');

  // Twitter Card
  setMetaTag('name', 'twitter:card', config.twitterCard || 'summary_large_image');
  setMetaTag('name', 'twitter:url', config.canonical);
  setMetaTag('name', 'twitter:title', config.title);
  setMetaTag('name', 'twitter:description', config.description);
  setMetaTag('name', 'twitter:image', config.ogImage || DEFAULT_OG_IMAGE);
  setMetaTag('name', 'twitter:site', '@nexliautomation');

  // Clean up dynamic JSON-LD (page-specific ones only)
  removeJsonLd('seo-jsonld-page');
  removeJsonLd('seo-jsonld-breadcrumb');
  removeJsonLd('seo-jsonld-video');

  // Inject page-specific JSON-LD
  if (config.jsonLd && config.jsonLd.length > 0) {
    config.jsonLd.forEach((schema, i) => {
      const id = i === 0 ? 'seo-jsonld-page' : `seo-jsonld-page-${i}`;
      setJsonLd(id, schema);
    });
  }
}

// --- Page-specific SEO configs ---

export function getHomeSEO(): SEOConfig {
  return {
    title: 'CPA Website Design & Automation | Nexli | Premium Websites for CPAs & Accounting Firms',
    description: 'Premium website design and AI automation for established CPAs and accounting firms. We help firms streamline operations, automate client intake, and scale capacity — so you can serve more clients without adding headcount.',
    canonical: `${BASE_URL}/`,
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'VideoObject',
        'name': 'Nexli Automation Hero Video',
        'description': 'Premium website design and AI automation for CPAs and accounting firms.',
        'thumbnailUrl': DEFAULT_OG_IMAGE,
        'uploadDate': '2026-01-01',
        'contentUrl': `${BASE_URL}/hero-video.mp4`,
        'embedUrl': `${BASE_URL}/`,
        'publisher': {
          '@type': 'Organization',
          'name': SITE_NAME,
          'logo': {
            '@type': 'ImageObject',
            'url': `${BASE_URL}/logos/nexli-icon-gradient.png`,
          },
        },
      },
    ],
  };
}

export function getBlogListSEO(): SEOConfig {
  return {
    title: 'Blog | CPA & Accounting Firm Insights | Nexli',
    description: 'Expert insights on CPA website design, accounting firm operations, SEO, AI automation, and practice scaling strategies for established firms.',
    canonical: `${BASE_URL}/blog`,
  };
}

export function getBlogPostSEO(post: {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  src: string;
  author?: string;
  publishedAt?: string;
  sections: { heading: string; content: string }[];
}): SEOConfig {
  const canonical = `${BASE_URL}/blog/${post.slug}`;
  const ogImage = post.src.startsWith('http') ? post.src : `${BASE_URL}${post.src}`;
  const wordCount = post.sections.reduce((acc, s) => acc + s.content.split(/\s+/).length, 0) + post.excerpt.split(/\s+/).length;

  return {
    title: `${post.title} | Nexli Blog`,
    description: post.excerpt.length > 160 ? post.excerpt.substring(0, 157) + '...' : post.excerpt,
    canonical,
    ogType: 'article',
    ogImage,
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        'headline': post.title,
        'description': post.excerpt,
        'image': ogImage,
        'author': {
          '@type': 'Organization',
          'name': post.author || SITE_NAME,
          'url': BASE_URL,
        },
        'publisher': {
          '@type': 'Organization',
          'name': SITE_NAME,
          'logo': {
            '@type': 'ImageObject',
            'url': `${BASE_URL}/logos/nexli-icon-gradient.png`,
          },
        },
        'datePublished': post.publishedAt || '2026-02-06',
        'dateModified': post.publishedAt || '2026-02-06',
        'mainEntityOfPage': {
          '@type': 'WebPage',
          '@id': canonical,
        },
        'articleSection': post.category,
        'wordCount': wordCount,
        'url': canonical,
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        'itemListElement': [
          {
            '@type': 'ListItem',
            'position': 1,
            'name': 'Home',
            'item': BASE_URL,
          },
          {
            '@type': 'ListItem',
            'position': 2,
            'name': 'Blog',
            'item': `${BASE_URL}/blog`,
          },
          {
            '@type': 'ListItem',
            'position': 3,
            'name': post.title,
            'item': canonical,
          },
        ],
      },
    ],
  };
}

export function getPortfolioListSEO(): SEOConfig {
  return {
    title: 'Portfolio | Premium CPA & Accounting Firm Website Designs | Nexli',
    description: 'Explore our portfolio of premium website designs for CPAs and accounting firms. Each project is custom-crafted to convert visitors into clients.',
    canonical: `${BASE_URL}/portfolio`,
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        'itemListElement': [
          {
            '@type': 'ListItem',
            'position': 1,
            'name': 'Home',
            'item': BASE_URL,
          },
          {
            '@type': 'ListItem',
            'position': 2,
            'name': 'Portfolio',
            'item': `${BASE_URL}/portfolio`,
          },
        ],
      },
    ],
  };
}

const PORTFOLIO_META: Record<string, { title: string; description: string }> = {
  'summit-tax-group': {
    title: 'Summit Tax Group | CPA Firm Website Design | Nexli Portfolio',
    description: 'See how Nexli designed a premium, high-converting website for Summit Tax Group, a CPA firm. Custom design that builds trust and converts prospects into clients.',
  },
  'clarity-advisory': {
    title: 'Clarity Advisory | CPA Firm Website Design | Nexli Portfolio',
    description: 'Explore the custom website design for Clarity Advisory, a CPA firm. Premium digital experience built to convert prospects and reflect advisory excellence.',
  },
  'meridian-financial': {
    title: 'Meridian Financial | Accounting Firm Website Design | Nexli Portfolio',
    description: 'See the premium website Nexli designed for Meridian Financial. Built to convert prospects into long-term clients.',
  },
  'harbor-wealth': {
    title: 'Harbor Wealth | Accounting Firm Website Design | Nexli Portfolio',
    description: 'Explore the custom website design for Harbor Wealth. A premium digital experience that communicates trust and expertise.',
  },
};

export function getPortfolioFirmSEO(slug: string): SEOConfig {
  const meta = PORTFOLIO_META[slug] || {
    title: `Portfolio | Nexli`,
    description: 'Premium website design for CPAs and accounting firms by Nexli Automation.',
  };
  const canonical = `${BASE_URL}/portfolio/${slug}`;

  return {
    title: meta.title,
    description: meta.description,
    canonical,
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        'itemListElement': [
          {
            '@type': 'ListItem',
            'position': 1,
            'name': 'Home',
            'item': BASE_URL,
          },
          {
            '@type': 'ListItem',
            'position': 2,
            'name': 'Portfolio',
            'item': `${BASE_URL}/portfolio`,
          },
          {
            '@type': 'ListItem',
            'position': 3,
            'name': meta.title.split(' | ')[0],
            'item': canonical,
          },
        ],
      },
    ],
  };
}

export function getServicesSEO(): SEOConfig {
  return {
    title: 'Digital Rainmaker System | CPA Website Design & AI Automation | Nexli',
    description: 'The Digital Rainmaker System combines premium website design, AI automation, and Google review amplification to help established CPA firms streamline operations and scale client capacity.',
    canonical: `${BASE_URL}/rainmaker`,
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        'itemListElement': [
          {
            '@type': 'ListItem',
            'position': 1,
            'name': 'Home',
            'item': BASE_URL,
          },
          {
            '@type': 'ListItem',
            'position': 2,
            'name': 'Digital Rainmaker System',
            'item': `${BASE_URL}/rainmaker`,
          },
        ],
      },
    ],
  };
}

export function getFreeGuideSEO(): SEOConfig {
  return {
    title: 'Free Guide | How Established CPA Firms Scale Client Capacity | Nexli',
    description: 'Download the free guide for established CPAs and accounting firms on streamlining operations and scaling your practice through premium website design and AI-powered automation.',
    canonical: `${BASE_URL}/free-guide`,
  };
}

export function getSmartReviewsSEO(): SEOConfig {
  return {
    title: 'Smart Reviews | Automated Google Review Management for CPAs | Nexli',
    description: 'Automatically request, route, and manage Google reviews for your CPA or accounting firm. Build your online reputation and strengthen trust with the prospects already finding you.',
    canonical: `${BASE_URL}/smart-reviews`,
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        'itemListElement': [
          {
            '@type': 'ListItem',
            'position': 1,
            'name': 'Home',
            'item': BASE_URL,
          },
          {
            '@type': 'ListItem',
            'position': 2,
            'name': 'Smart Reviews',
            'item': `${BASE_URL}/smart-reviews`,
          },
        ],
      },
    ],
  };
}

export function getDocumentPortalSEO(): SEOConfig {
  return {
    title: 'Secure Document Portal | CPA Client Document Collection | Nexli',
    description: 'Collect client tax documents securely through your firm\'s branded portal. AES-256 encryption, per-firm isolated storage, IRS Pub 4557 compliant. No more emailing W-2s.',
    canonical: `${BASE_URL}/document-portal`,
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        'itemListElement': [
          {
            '@type': 'ListItem',
            'position': 1,
            'name': 'Home',
            'item': BASE_URL,
          },
          {
            '@type': 'ListItem',
            'position': 2,
            'name': 'Document Portal',
            'item': `${BASE_URL}/document-portal`,
          },
        ],
      },
    ],
  };
}

export function getPrivacySEO(): SEOConfig {
  return {
    title: 'Privacy Policy | Nexli Automation',
    description: 'Nexli Automation privacy policy. Learn how we collect, use, and protect your personal information.',
    canonical: `${BASE_URL}/privacy`,
    noIndex: true,
  };
}

export function getTermsSEO(): SEOConfig {
  return {
    title: 'Terms and Conditions | Nexli Automation',
    description: 'Nexli Automation terms and conditions of service.',
    canonical: `${BASE_URL}/terms`,
    noIndex: true,
  };
}

export function get404SEO(): SEOConfig {
  return {
    title: 'Page Not Found | Nexli Automation',
    description: 'The page you are looking for could not be found.',
    canonical: `${BASE_URL}/`,
    noIndex: true,
  };
}

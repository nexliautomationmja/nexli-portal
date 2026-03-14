export interface FirmBrandConfig {
  firmName: string;
  colors: {
    navBg: string;
    text: string;
    textMuted: string;
    accent: string;
    border: string;
  };
  fonts: {
    heading: string;
    body: string;
  };
  navLinks: string[];
  style: 'glass' | 'solid' | 'minimal';
}

export const summitTaxConfig: FirmBrandConfig = {
  firmName: 'Summit Tax Group',
  colors: {
    navBg: 'rgba(76, 29, 149, 0.95)',
    text: '#ffffff',
    textMuted: 'rgba(255, 255, 255, 0.6)',
    accent: '#a78bfa',
    border: 'rgba(167, 139, 250, 0.2)',
  },
  fonts: {
    heading: "'Inter', system-ui, sans-serif",
    body: "'Inter', system-ui, sans-serif",
  },
  navLinks: ['Services', 'Tax Planning', 'About', 'Contact'],
  style: 'glass',
};

export const clarityConfig: FirmBrandConfig = {
  firmName: 'Clarity Advisory',
  colors: {
    navBg: 'rgba(10, 14, 26, 0.95)',
    text: '#f5f0eb',
    textMuted: 'rgba(245, 240, 235, 0.5)',
    accent: '#c9a96e',
    border: 'rgba(201, 169, 110, 0.2)',
  },
  fonts: {
    heading: "Georgia, 'Times New Roman', serif",
    body: "system-ui, -apple-system, sans-serif",
  },
  navLinks: ['Services', 'Insights', 'About', 'Contact'],
  style: 'glass',
};

export const meridianConfig: FirmBrandConfig = {
  firmName: 'Meridian Financial',
  colors: {
    navBg: 'rgba(12, 12, 12, 0.98)',
    text: '#ffffff',
    textMuted: 'rgba(255, 255, 255, 0.5)',
    accent: '#f97316',
    border: 'rgba(249, 115, 22, 0.15)',
  },
  fonts: {
    heading: "'Inter', system-ui, sans-serif",
    body: "'Inter', system-ui, sans-serif",
  },
  navLinks: ['Wealth Management', 'Advisory', 'About', 'Contact'],
  style: 'solid',
};

export const harborConfig: FirmBrandConfig = {
  firmName: 'Harbor Wealth',
  colors: {
    navBg: '#ffffff',
    text: '#000000',
    textMuted: 'rgba(0, 0, 0, 0.45)',
    accent: '#84cc16',
    border: '#e5e7eb',
  },
  fonts: {
    heading: "system-ui, -apple-system, sans-serif",
    body: "system-ui, -apple-system, sans-serif",
  },
  navLinks: ['Global Wealth', 'Services', 'About', 'Contact'],
  style: 'minimal',
};

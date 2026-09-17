import type { Metadata, Viewport } from 'next';
import './globals.css';
import { DEFAULT_LANG, getDict, htmlLang } from '@/lib/i18n';
import { SiteFooter } from '@/components/world/SiteFooter';

const dict = getDict(DEFAULT_LANG);

export const metadata: Metadata = {
  title: {
    default: `${dict.siteName} · ${dict.siteTagline}`,
    template: `%s · ${dict.siteName}`,
  },
  description: dict.siteDescription,
  applicationName: dict.siteName,
};

export const viewport: Viewport = {
  themeColor: '#0d1017',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang={htmlLang(DEFAULT_LANG)} data-scroll-behavior="smooth" className="h-full">
      <body className="min-h-full">
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}

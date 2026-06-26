import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Read our privacy policy to understand how we collect, use, and protect your information when playing Cards Against Humanity Online.",
  alternates: {
    canonical: '/privacy',
  },
  openGraph: {
    title: "Privacy Policy | Cards Against Humanity Online",
    description: "Learn how we handle your personal data and privacy settings.",
  },
};

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

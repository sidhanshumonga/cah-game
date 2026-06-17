import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Review the terms and conditions for playing Cards Against Humanity Online. By playing, you agree to our community rules and service guidelines.",
  openGraph: {
    title: "Terms of Service | Cards Against Humanity Online",
    description: "Read the rules, terms, and conditions for playing Cards Against Humanity Online.",
  },
};

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

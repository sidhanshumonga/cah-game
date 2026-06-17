import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to your Cards Against Humanity Online account to sync your coin balance, customized card packs, and game history.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

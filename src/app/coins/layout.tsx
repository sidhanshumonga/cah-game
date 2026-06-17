import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Get Coins",
  description: "Buy coins to purchase expansion packs and upgrades in Cards Against Humanity Online.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function CoinsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

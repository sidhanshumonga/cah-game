import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Playing Cards Against Humanity",
  robots: {
    index: false,
    follow: false,
  },
};

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

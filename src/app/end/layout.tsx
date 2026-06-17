import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Game Over",
  robots: {
    index: false,
    follow: false,
  },
};

export default function EndLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

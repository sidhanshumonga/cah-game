import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "How to Play Cards Against Humanity Online",
  description: "Learn how to play Cards Against Humanity Online with friends. Read the rules, setup, judge rotations, scoring, and gameplay tips.",
  openGraph: {
    title: "How to Play | Cards Against Humanity Online",
    description: "Read the dynamic, simple step-by-step game rules and start playing with your friends instantly.",
  },
};

export default function HowToLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

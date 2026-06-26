import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Feedback & Roadmap",
  description: "Suggest new feature ideas, vote on the roadmap, report bugs, and shape the future of Cards Against Humanity Online.",
  alternates: {
    canonical: "/feedback",
  },
  openGraph: {
    title: "Feedback & Roadmap | Cards Against Humanity Online",
    description: "Submit suggestions, report bugs, vote on community feature requests, and follow our development roadmap.",
  },
};

export default function FeedbackLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

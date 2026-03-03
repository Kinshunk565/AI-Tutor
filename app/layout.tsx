import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NeuralTutor — AI-Powered Adaptive Learning",
  description:
    "An intelligent tutoring system that adapts to your learning pace with personalized questions, performance tracking, and knowledge gap detection.",
  keywords: ["AI tutor", "adaptive learning", "education", "knowledge tracing"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}

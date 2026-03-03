import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "../lib/contexts/AuthContext";

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
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}

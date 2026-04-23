import type { Metadata } from "next";
import "./globals.css";
import SnowfoxLogo from "@/components/SnowfoxLogo";

export const metadata: Metadata = {
  title: "SnowFox AI Readiness Assessment",
  description:
    "A 10-minute agentic assessment that scores your business 1–100 on AI readiness. Get a tailored roadmap from SnowFox Solutions.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex flex-col">
          <header className="border-b border-snow-200 bg-snow-50">
            <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
              <a href="/" className="flex items-center gap-3 text-navy-900">
                <SnowfoxLogo variant="horizontal" className="h-8" />
                <span className="hidden sm:inline text-ink-400 text-sm pl-1 border-l border-snow-200 ml-1">
                  AI Readiness Assessment
                </span>
              </a>
              <a
                href="https://snowfoxsolutions.com"
                className="text-sm text-ink-500 hover:text-navy-700"
              >
                snowfoxsolutions.com
              </a>
            </div>
          </header>
          <main className="flex-1">{children}</main>
          <footer className="border-t border-snow-200 bg-snow-50">
            <div className="max-w-5xl mx-auto px-6 py-4 text-sm text-ink-400 flex items-center justify-between">
              <span>© {new Date().getFullYear()} SnowFox Solutions, LLC</span>
              <span>Blue Ash, Ohio · Serving clients nationwide</span>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}

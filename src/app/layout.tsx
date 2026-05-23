import type { Metadata } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";

import { ScrollToTop } from "@/components/ScrollToTop";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jbmono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Personalization Performance Doctor",
  description:
    "AI diagnostic agent auditing Bloomreach Discovery personalization health.",
};

const themeScript = `(function(){try{var t=localStorage.getItem('ppd-theme');document.documentElement.setAttribute('data-theme',t==='dark'?'dark':'light')}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${fraunces.variable} ${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col bg-bg text-text-body">
        {children}
        <ScrollToTop />
      </body>
    </html>
  );
}

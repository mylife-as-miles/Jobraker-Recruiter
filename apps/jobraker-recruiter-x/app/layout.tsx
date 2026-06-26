import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jobraker Recruiter X",
  description: "Jobraker Recruiter X interface",
};

const apiBase =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:3002";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `window.config = { apiBase: ${JSON.stringify(apiBase)} };`,
          }}
        />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}

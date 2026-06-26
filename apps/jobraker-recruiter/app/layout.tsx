import "./globals.css";
import { ThemeProvider } from "./providers/theme-provider";
import { Inter } from "next/font/google";
import { Providers } from "./providers";
import { Metadata } from "next";
import { HelpModalProvider } from "./providers/help-modal-provider";
import { Auth0Provider } from "@auth0/nextjs-auth0";
import Script from "next/script";
import { PendoProvider } from "./providers/pendo-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "Jobraker Recruiter",
    template: "%s | Jobraker Recruiter",
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <html lang="en" className="h-dvh">
    <Script id="pendo-snippet" strategy="afterInteractive">{`(function(apiKey){
    (function(p,e,n,d,o){var v,w,x,y,z;o=p[d]=p[d]||{};o._q=o._q||[];
    v=['initialize','identify','updateOptions','pageLoad','track','trackAgent'];for(w=0,x=v.length;w<x;++w)(function(m){
    o[m]=o[m]||function(){o._q[m===v[0]?'unshift':'push']([m].concat([].slice.call(arguments,0)));};})(v[w]);
    y=e.createElement(n);y.async=!0;y.src='https://cdn.pendo.io/agent/static/'+apiKey+'/pendo.js';
    z=e.getElementsByTagName(n)[0];z.parentNode.insertBefore(y,z);})(window,document,'script','pendo');
})('77413874-9f6d-4c1e-b2ba-a8b042808326');`}</Script>
    <Auth0Provider>
      <ThemeProvider>
        <body className={`${inter.className} h-full text-base [scrollbar-width:thin] bg-background`}>
          <PendoProvider />
          <Providers className='h-full flex flex-col'>
            <HelpModalProvider>
              {children}
            </HelpModalProvider>
          </Providers>
        </body>
      </ThemeProvider>
    </Auth0Provider>
  </html>;
}

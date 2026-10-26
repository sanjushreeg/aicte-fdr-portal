import "./globals.css";
import { ReactNode } from "react";
import { Providers } from "@/components/Providers";

export const metadata = {
  title: "AICTE FDR Management Portal",
  description: "Secure portal for managing security deposits and FDRs - Ministry of Education, Govt. of India",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head />
      <body className="bg-slate-50 font-sans text-slate-900 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

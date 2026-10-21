import type { Metadata } from 'next';
import './globals.css';
import { QueryProvider } from '../providers/QueryProvider';
import { AuthProvider } from '../providers/AuthProvider';
import { ToastProvider } from '../providers/ToastProvider';

export const metadata: Metadata = {
  title: 'KD-IOMS — Kandarp Drugs Pharmacy Portal',
  description: 'Pharmacy Inventory and Order Management System',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full bg-slate-50 antialiased" style={{ colorScheme: 'light' }}>
      <head>
        <style
          dangerouslySetInnerHTML={{
            __html: `
              input, textarea, select {
                color: #000000 !important;
                -webkit-text-fill-color: #000000 !important;
                color-scheme: light !important;
              }
              input::placeholder, textarea::placeholder {
                color: #64748b !important;
                -webkit-text-fill-color: #64748b !important;
                opacity: 1 !important;
              }
              input:-webkit-autofill,
              input:-webkit-autofill:hover,
              input:-webkit-autofill:focus,
              textarea:-webkit-autofill {
                -webkit-text-fill-color: #000000 !important;
                -webkit-box-shadow: 0 0 0 1000px #ffffff inset !important;
                box-shadow: 0 0 0 1000px #ffffff inset !important;
              }
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col font-sans text-slate-900" style={{ color: '#0f172a' }}>
        <QueryProvider>
          <AuthProvider>
            <ToastProvider>
              {children}
            </ToastProvider>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}

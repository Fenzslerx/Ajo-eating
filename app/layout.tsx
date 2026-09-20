import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { AppStoreProvider } from '@/lib/app-store'
import { AppShell } from '@/components/app-shell'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'


export const metadata: Metadata = {
  title: 'DogMeal — บันทึกมื้ออาหารน้องหมา',
  description: 'แอปสำหรับคนในบ้านร่วมกันบันทึกว่าน้องหมากินอาหารหมดหรือไม่',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  userScalable: false,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fffaf5' },
    { media: '(prefers-color-scheme: dark)', color: '#241a15' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AppStoreProvider>
            <AppShell>{children}</AppShell>
            <Toaster position="top-center" />
          </AppStoreProvider>
        </ThemeProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}

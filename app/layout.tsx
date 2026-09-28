import type { Metadata } from "next";
import { Inter, Outfit, Noto_Sans_Arabic } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { getDictionary, getLocale } from "@/dictionaries";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const notoArabic = Noto_Sans_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic"],
});

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.meta.title, description: dict.meta.description };
}

// Le thème (classe sur <html>) est appliqué avant le premier rendu pour éviter
// un flash du thème par défaut ; ThemeSwitcher le met ensuite à jour.
const scriptTheme = `try{var t=localStorage.getItem('ds-theme');if(t&&t!=='theme-academie')document.documentElement.classList.add(t)}catch(e){}`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    <html
      lang={locale}
      dir={dir}
      suppressHydrationWarning
      className={`${inter.variable} ${outfit.variable} ${notoArabic.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptTheme }} />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster position={dir === "rtl" ? "top-left" : "top-right"} richColors />
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const NOMBRE_APP = "Citas Dentales";

export const metadata: Metadata = {
  title: {
    default: `${NOMBRE_APP}: agenda de consultorios dentales`,
    template: `%s | ${NOMBRE_APP}`,
  },
  description:
    "Sistema de citas para consultorios dentales: los pacientes reservan con o sin cuenta y el consultorio gestiona su agenda, disponibilidad y recordatorios por correo.",
  applicationName: NOMBRE_APP,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

import "./globals.css";

export const metadata = {
  title: "Rapi — Todo pribadi",
  description: "Kelola tugas harian dengan sederhana dan fokus.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}

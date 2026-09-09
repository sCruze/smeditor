import "@smeditor/theme-default";
import type { ReactNode } from "react";

export const metadata = {
  title: "SMEditor · Next.js example",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 32, maxWidth: 800 }}>{children}</body>
    </html>
  );
}

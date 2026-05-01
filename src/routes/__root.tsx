import { Outlet, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import appCss from "../styles.css?url";
import { AuthProvider } from "@/lib/auth";
import { Toaster } from "sonner";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "AffLink — Creator Affiliate Platform" },
      { name: "description", content: "Post reviews. Drop links. Earn with style. The creator platform for affiliate marketers." },
      { property: "og:title", content: "AffLink — Creator Affiliate Platform" },
      { property: "og:description", content: "Post reviews. Drop links. Earn with style. The creator platform for affiliate marketers." },
      { name: "twitter:title", content: "AffLink — Creator Affiliate Platform" },
      { name: "twitter:description", content: "Post reviews. Drop links. Earn with style. The creator platform for affiliate marketers." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/2ca29796-e7a1-419a-a41c-2cd15262b977/id-preview-0a0bcb7f--975aa214-1de6-43f3-ae47-53dcd14a975c.lovable.app-1777631559338.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/2ca29796-e7a1-419a-a41c-2cd15262b977/id-preview-0a0bcb7f--975aa214-1de6-43f3-ae47-53dcd14a975c.lovable.app-1777631559338.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Raleway:wght@400;500;600;700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: () => (
    <AuthProvider>
      <Outlet />
      <Toaster position="top-center" richColors />
    </AuthProvider>
  ),
  notFoundComponent: () => (
    <div className="min-h-screen grid place-items-center">
      <div className="text-center">
        <h1 className="text-6xl font-serif">404</h1>
        <p className="mt-2 text-muted-foreground">Page not found</p>
        <a href="/" className="inline-block mt-4 px-4 py-2 rounded-md bg-deep-pink text-primary-foreground">Go home</a>
      </div>
    </div>
  ),
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

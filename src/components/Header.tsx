import { Link, useRouter } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

export function Header() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  return (
    <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 bg-background/85 backdrop-blur border-b border-border">
      <Link to="/" className="flex items-center gap-2 font-serif text-2xl font-bold tracking-wide">
        <span className="inline-block w-2 h-2 rounded-full bg-rose shadow-[0_0_12px_var(--rose)] animate-pulse" />
        AffLink
      </Link>
      <div className="flex items-center gap-2">
        <Link to="/" className="px-3 py-1.5 text-sm font-semibold rounded-md hover:bg-accent">Explore</Link>
        {user ? (
          <>
            <Link to="/dashboard" className="px-3 py-1.5 text-sm font-semibold rounded-md hover:bg-accent">Dashboard</Link>
            <button
              onClick={async () => { await signOut(); router.navigate({ to: "/" }); }}
              className="px-3 py-1.5 text-sm font-semibold rounded-md hover:bg-accent"
            >
              Sign out
            </button>
          </>
        ) : (
          <Link to="/auth" className="px-4 py-1.5 text-sm font-semibold rounded-md bg-deep-pink text-primary-foreground hover:opacity-90">
            Sign in
          </Link>
        )}
      </div>
    </nav>
  );
}

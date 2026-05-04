import { Link, useRouter } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Bell } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function Header() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) { setUnread(0); return; }
    let active = true;
    const load = async () => {
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("read", false);
      if (active) setUnread(count ?? 0);
    };
    load();
    const ch = supabase
      .channel(`notif-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => setUnread((n) => n + 1))
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, [user]);

  return (
    <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 bg-background/85 backdrop-blur border-b border-border">
      <Link to="/" className="flex items-center gap-2 font-serif text-2xl font-bold tracking-wide">
        <span className="inline-block w-2 h-2 rounded-full bg-rose shadow-[0_0_12px_var(--rose)] animate-pulse" />
        AffLink
      </Link>
      <div className="flex items-center gap-1 sm:gap-2">
        <Link to="/" className="px-3 py-1.5 text-sm font-semibold rounded-md hover:bg-accent">Explore</Link>
        {user ? (
          <>
            <Link to="/dashboard" className="px-3 py-1.5 text-sm font-semibold rounded-md hover:bg-accent inline-flex items-center gap-1.5">
              Dashboard
              {unread > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-deep-pink text-primary-foreground text-[10px] font-bold">
                  {unread}
                </span>
              )}
            </Link>
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

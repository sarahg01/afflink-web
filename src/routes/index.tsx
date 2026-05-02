import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";

export const Route = createFileRoute("/")({
  component: Home,
});

type FeedPost = {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  created_at: string;
  user_id: string;
  profiles: { display_name: string | null; avatar_url: string | null } | null;
};

function Home() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("posts")
        .select("id, title, description, thumbnail_url, created_at, user_id, profiles(display_name, avatar_url)")
        .eq("published", true)
        .order("created_at", { ascending: false })
        .limit(60);
      setPosts((data as any) ?? []);
      setLoading(false);
    })();
  }, []);

  const visible = posts.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return p.title.toLowerCase().includes(q) || (p.description ?? "").toLowerCase().includes(q);
  });

  return (
    <div className="min-h-screen">
      <Header />

      {/* Hero */}
      <section className="px-6 py-20 text-center">
        <h1 className="text-5xl md:text-6xl font-serif font-bold leading-tight max-w-3xl mx-auto">
          Post Reviews.<br/>Drop Links.<br/>
          <em className="not-italic text-deep-pink">Earn with Style.</em>
        </h1>
        <p className="max-w-xl mx-auto mt-6 text-muted-foreground">
          Join our creator platform, showcase products, and earn commissions effortlessly. Manage all your links in one beautiful hub.
        </p>
        <div className="mt-8 flex gap-3 justify-center flex-wrap">
          <Link to="/auth" className="px-6 py-3 rounded-lg bg-deep-pink text-primary-foreground font-semibold hover:opacity-90 transition">
            Get Started
          </Link>
          <a href="#explore" className="px-6 py-3 rounded-lg border-2 border-deep-pink text-deep-pink font-semibold hover:bg-deep-pink hover:text-primary-foreground transition">
            Explore
          </a>
        </div>
      </section>

      {/* Ticker */}
      <div className="bg-card border-y border-border py-2 overflow-hidden">
        <div className="flex whitespace-nowrap animate-[ticker_40s_linear_infinite]">
          {Array.from({ length: 2 }).map((_, k) => (
            <div key={k} className="flex">
              {["🔥 New creators joining daily", "💥 Trending product reviews", "🏆 Top earners this week", "✨ Drop your first link in 60s"].map((t, i) => (
                <span key={i} className="px-12 text-sm text-muted-foreground">{t}</span>
              ))}
            </div>
          ))}
        </div>
        <style>{`@keyframes ticker { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }`}</style>
      </div>

      {/* Feed */}
      <section id="explore" className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <h2 className="text-3xl font-serif font-bold">Latest Reviews</h2>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Search reviews by product name…"
            className="w-full sm:w-80 px-4 py-3 rounded-full border border-border bg-card focus:outline-none focus:ring-2 focus:ring-deep-pink"
          />
        </div>
        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : visible.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-xl border border-border">
            <p className="text-2xl mb-2">🌸</p>
            <p className="text-muted-foreground">No posts yet — be the first to share!</p>
            <Link to="/auth" className="inline-block mt-4 px-4 py-2 rounded-md bg-deep-pink text-primary-foreground font-semibold">
              Become a creator
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {visible.map((p) => (
              <Link
                key={p.id}
                to="/post/$postId"
                params={{ postId: p.id }}
                className="group bg-card rounded-xl border border-border overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition"
              >
                <div className="aspect-[4/3] bg-gradient-to-br from-accent to-rose flex items-center justify-center text-5xl">
                  {p.thumbnail_url ? (
                    <img src={p.thumbnail_url} alt={p.title} className="w-full h-full object-cover" loading="lazy" />
                  ) : "🌸"}
                </div>
                <div className="p-4">
                  <h3 className="font-serif font-bold text-lg line-clamp-1">{p.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{p.description}</p>
                  <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                    {p.profiles?.avatar_url && (
                      <img src={p.profiles.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                    )}
                    <span>by {p.profiles?.display_name ?? "creator"}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <footer className="px-6 py-8 bg-accent/40 border-t border-border text-sm text-muted-foreground text-center">
        © 2026 AffLink · Built for creators
      </footer>
    </div>
  );
}

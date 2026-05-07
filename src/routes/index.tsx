import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { useAuth } from "@/lib/auth";
import { Heart, Bookmark, BadgeCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  component: Home,
});

type FeedPost = {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  niche: string | null;
  created_at: string;
  user_id: string;
  profiles: { display_name: string | null; avatar_url: string | null } | null;
};

const NICHES = ["beauty", "tech", "fashion", "home", "fitness", "food"];

function Home() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"all" | "following">("all");
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [verifiedIds, setVerifiedIds] = useState<Set<string>>(new Set());
  const [upvoted, setUpvoted] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("posts")
        .select("id, title, description, thumbnail_url, niche, created_at, user_id, profiles(display_name, avatar_url)")
        .eq("published", true)
        .order("created_at", { ascending: false })
        .limit(60);
      const list = (data as any) ?? [];
      setPosts(list);
      setLoading(false);

      const ids = list.map((p: FeedPost) => p.id);
      if (ids.length) {
        // verified posts: tracking_links with confirmed orders
        const { data: tl } = await supabase
          .from("tracking_links")
          .select("post_id, orders!inner(status)")
          .in("post_id", ids)
          .eq("orders.status", "confirmed");
        setVerifiedIds(new Set(((tl as any) ?? []).map((r: any) => r.post_id).filter(Boolean)));

        // upvote counts
        const { data: ups } = await supabase.from("upvotes").select("post_id").in("post_id", ids);
        const c: Record<string, number> = {};
        ((ups as any) ?? []).forEach((u: any) => { c[u.post_id] = (c[u.post_id] ?? 0) + 1; });
        setCounts(c);
      }
    })();
  }, []);

  useEffect(() => {
    if (!user) { setUpvoted(new Set()); setSaved(new Set()); setFollowingIds(new Set()); return; }
    (async () => {
      const [{ data: u }, { data: s }, { data: f }] = await Promise.all([
        supabase.from("upvotes").select("post_id").eq("user_id", user.id),
        supabase.from("saves").select("post_id").eq("user_id", user.id),
        supabase.from("follows").select("following_id").eq("follower_id", user.id),
      ]);
      setUpvoted(new Set(((u as any) ?? []).map((x: any) => x.post_id)));
      setSaved(new Set(((s as any) ?? []).map((x: any) => x.post_id)));
      setFollowingIds(new Set(((f as any) ?? []).map((x: any) => x.following_id)));
    })();
  }, [user]);

  const visible = useMemo(() => {
    let v = posts;
    if (tab === "following") {
      if (!user) return [];
      v = v.filter((p) => followingIds.has(p.user_id));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      v = v.filter((p) => p.title.toLowerCase().includes(q) || (p.description ?? "").toLowerCase().includes(q));
    }
    return v;
  }, [posts, search, tab, followingIds, user]);

  const toggleUpvote = async (postId: string) => {
    if (!user) return toast.error("Sign in to upvote");
    if (upvoted.has(postId)) {
      await supabase.from("upvotes").delete().eq("user_id", user.id).eq("post_id", postId);
      setUpvoted((s) => { const n = new Set(s); n.delete(postId); return n; });
      setCounts((c) => ({ ...c, [postId]: Math.max(0, (c[postId] ?? 1) - 1) }));
    } else {
      await supabase.from("upvotes").insert({ user_id: user.id, post_id: postId });
      setUpvoted((s) => new Set(s).add(postId));
      setCounts((c) => ({ ...c, [postId]: (c[postId] ?? 0) + 1 }));
    }
  };

  const toggleSave = async (postId: string) => {
    if (!user) return toast.error("Sign in to save");
    if (saved.has(postId)) {
      await supabase.from("saves").delete().eq("user_id", user.id).eq("post_id", postId);
      setSaved((s) => { const n = new Set(s); n.delete(postId); return n; });
    } else {
      await supabase.from("saves").insert({ user_id: user.id, post_id: postId });
      setSaved((s) => new Set(s).add(postId));
      toast.success("Saved to wishlist");
    }
  };

  return (
    <div className="min-h-screen">
      <Header />

      <section className="px-6 py-20 text-center">
        <h1 className="text-5xl md:text-6xl font-serif font-bold leading-tight max-w-3xl mx-auto">
          Post Reviews.<br/>Drop Links.<br/>
          <em className="not-italic text-deep-pink">Earn with Style.</em>
        </h1>
        <p className="max-w-xl mx-auto mt-6 text-muted-foreground">
          Honest reviews from creators who actually used the product. Verified by real sales.
        </p>
        <div className="mt-8 flex gap-3 justify-center flex-wrap">
          <Link to="/auth" className="px-6 py-3 rounded-lg bg-deep-pink text-primary-foreground font-semibold hover:opacity-90 transition">Get Started</Link>
          <a href="#explore" className="px-6 py-3 rounded-lg border-2 border-deep-pink text-deep-pink font-semibold hover:bg-deep-pink hover:text-primary-foreground transition">Explore</a>
        </div>
      </section>

      {/* Niche chips */}
      <div className="max-w-6xl mx-auto px-6 flex gap-2 flex-wrap">
        {NICHES.map((n) => (
          <Link key={n} to="/n/$niche" params={{ niche: n }}
                className="px-4 py-1.5 text-sm rounded-full border border-border bg-card hover:bg-accent capitalize">
            #{n}
          </Link>
        ))}
      </div>

      <section id="explore" className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-3xl font-serif font-bold">Latest Reviews</h2>
            <div className="flex gap-1 mt-3">
              {(["all", "following"] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)}
                        className={`px-4 py-1.5 text-sm font-semibold rounded-full ${tab === t ? "bg-deep-pink text-primary-foreground" : "bg-card border border-border hover:bg-accent"}`}>
                  {t === "all" ? "For you" : "Following"}
                </button>
              ))}
            </div>
          </div>
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
            <p className="text-muted-foreground">
              {tab === "following" ? "Follow creators to see their posts here." : "No posts yet — be the first to share!"}
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {visible.map((p) => {
              const isVerified = verifiedIds.has(p.id);
              const isUp = upvoted.has(p.id);
              const isSaved = saved.has(p.id);
              return (
                <div key={p.id} className="bg-card rounded-xl border border-border overflow-hidden hover:shadow-lg transition">
                  <Link to="/post/$postId" params={{ postId: p.id }} className="block">
                    <div className="relative aspect-[4/3] bg-gradient-to-br from-accent to-rose flex items-center justify-center text-5xl">
                      {p.thumbnail_url ? (
                        <img src={p.thumbnail_url} alt={p.title} className="w-full h-full object-cover" loading="lazy" />
                      ) : "🌸"}
                      {isVerified && (
                        <span className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-background/90 text-xs font-semibold text-deep-pink">
                          <BadgeCheck size={14} /> Verified review
                        </span>
                      )}
                      {p.niche && (
                        <span className="absolute top-2 right-2 px-2 py-1 rounded-full bg-background/80 text-[10px] font-semibold uppercase">#{p.niche}</span>
                      )}
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
                  <div className="px-4 pb-3 flex items-center gap-3 border-t border-border pt-3">
                    <button onClick={() => toggleUpvote(p.id)}
                            className={`inline-flex items-center gap-1.5 text-sm ${isUp ? "text-deep-pink" : "text-muted-foreground hover:text-foreground"}`}>
                      <Heart size={16} fill={isUp ? "currentColor" : "none"} /> {counts[p.id] ?? 0}
                    </button>
                    <button onClick={() => toggleSave(p.id)}
                            className={`inline-flex items-center gap-1.5 text-sm ml-auto ${isSaved ? "text-deep-pink" : "text-muted-foreground hover:text-foreground"}`}>
                      <Bookmark size={16} fill={isSaved ? "currentColor" : "none"} />
                      {isSaved ? "Saved" : "Save"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <footer className="px-6 py-8 bg-accent/40 border-t border-border text-sm text-muted-foreground text-center">
        © 2026 AffLink · Built for creators
      </footer>
    </div>
  );
}

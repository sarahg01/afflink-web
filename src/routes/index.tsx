import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { useAuth } from "@/lib/auth";
import { Heart, Bookmark, BadgeCheck, Sparkles, ShieldCheck, Wallet, TrendingUp, Star, ArrowRight } from "lucide-react";
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

const NICHES = [
  { slug: "beauty", emoji: "💄" },
  { slug: "tech", emoji: "📱" },
  { slug: "fashion", emoji: "👗" },
  { slug: "home", emoji: "🏡" },
  { slug: "fitness", emoji: "💪" },
  { slug: "food", emoji: "🍜" },
];

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
        const { data: tl } = await supabase
          .from("tracking_links")
          .select("post_id, orders!inner(status)")
          .in("post_id", ids)
          .eq("orders.status", "confirmed");
        setVerifiedIds(new Set(((tl as any) ?? []).map((r: any) => r.post_id).filter(Boolean)));

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

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-hero">
        {/* floating blobs */}
        <div aria-hidden className="absolute -top-24 -left-20 w-80 h-80 rounded-full bg-deep-pink/30 blur-3xl animate-[blob_12s_ease-in-out_infinite]" />
        <div aria-hidden className="absolute top-20 -right-24 w-96 h-96 rounded-full bg-gold/30 blur-3xl animate-[blob_15s_ease-in-out_infinite]" />
        <div aria-hidden className="absolute -bottom-32 left-1/3 w-80 h-80 rounded-full bg-rose/40 blur-3xl animate-[blob_18s_ease-in-out_infinite]" />

        <div className="relative max-w-6xl mx-auto px-6 py-24 md:py-32 text-center">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass border border-border text-xs font-semibold mb-6 animate-[fade-up_0.5s_ease-out_both]">
            <Sparkles size={14} className="text-deep-pink" />
            Trusted by creators · Verified by real sales
          </span>
          <h1 className="text-5xl md:text-7xl font-serif font-bold leading-[1.05] max-w-4xl mx-auto animate-[fade-up_0.6s_ease-out_0.1s_both]">
            Honest reviews.
            <br />
            <span className="text-gradient">Real earnings.</span>
            <br />
            <span className="italic">Zero noise.</span>
          </h1>
          <p className="max-w-xl mx-auto mt-6 text-lg text-muted-foreground animate-[fade-up_0.6s_ease-out_0.2s_both]">
            The creator-first affiliate platform where every recommendation is backed by a real purchase — and every sale pays you instantly.
          </p>
          <div className="mt-10 flex gap-3 justify-center flex-wrap animate-[fade-up_0.6s_ease-out_0.3s_both]">
            <Link to="/auth"
                  className="group px-7 py-3.5 rounded-full bg-gradient-pink text-primary-foreground font-semibold shadow-soft hover:shadow-glow transition-all hover:-translate-y-0.5 inline-flex items-center gap-2">
              Start earning
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <a href="#explore"
               className="px-7 py-3.5 rounded-full glass border border-border font-semibold hover:bg-accent transition-all hover:-translate-y-0.5">
              Browse reviews
            </a>
          </div>

          {/* stat strip */}
          <div className="mt-16 grid grid-cols-3 gap-4 max-w-2xl mx-auto animate-[fade-up_0.6s_ease-out_0.4s_both]">
            {[
              { v: "100%", l: "Verified sales" },
              { v: "20%", l: "Flat platform fee" },
              { v: "₹50", l: "Min payout" },
            ].map((s) => (
              <div key={s.l} className="glass rounded-2xl border border-border px-3 py-5">
                <div className="text-2xl md:text-3xl font-serif font-bold text-deep-pink">{s.v}</div>
                <div className="text-xs text-muted-foreground mt-1">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-serif font-bold">Built for creators who care</h2>
          <p className="text-muted-foreground mt-3">Trust-first features competitors don't have.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {[
            { icon: ShieldCheck, title: "Verified by sales", desc: "Reviews earn the badge only after producing real, confirmed orders. No fake hype." },
            { icon: Wallet, title: "Instant wallet", desc: "Every confirmed sale credits your wallet automatically. Withdraw from ₹50." },
            { icon: TrendingUp, title: "Niche communities", desc: "Beauty, tech, fashion, home — your audience finds you in their hub." },
          ].map((f) => (
            <div key={f.title}
                 className="group relative bg-card border border-border rounded-2xl p-6 hover:shadow-soft hover:-translate-y-1 transition-all overflow-hidden">
              <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-deep-pink/10 group-hover:bg-deep-pink/20 transition-colors blur-2xl" />
              <div className="relative">
                <div className="w-12 h-12 rounded-xl bg-gradient-pink text-primary-foreground flex items-center justify-center shadow-soft mb-4">
                  <f.icon size={22} />
                </div>
                <h3 className="font-serif font-bold text-xl mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Niche chips */}
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex gap-2 flex-wrap justify-center">
          {NICHES.map((n) => (
            <Link key={n.slug} to="/n/$niche" params={{ niche: n.slug }}
                  className="px-4 py-2 text-sm rounded-full border border-border bg-card hover:bg-gradient-pink hover:text-primary-foreground hover:border-transparent transition-all capitalize inline-flex items-center gap-1.5">
              <span>{n.emoji}</span> {n.slug}
            </Link>
          ))}
        </div>
      </div>

      {/* Explore */}
      <section id="explore" className="max-w-6xl mx-auto px-6 py-16">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
          <div>
            <h2 className="text-3xl md:text-4xl font-serif font-bold">Latest reviews</h2>
            <div className="flex gap-1 mt-4">
              {(["all", "following"] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)}
                        className={`px-5 py-2 text-sm font-semibold rounded-full transition-all ${tab === t ? "bg-gradient-pink text-primary-foreground shadow-soft" : "bg-card border border-border hover:bg-accent"}`}>
                  {t === "all" ? "✨ For you" : "💗 Following"}
                </button>
              ))}
            </div>
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Search reviews…"
            className="w-full sm:w-80 px-5 py-3 rounded-full border border-border bg-card focus:outline-none focus:ring-2 focus:ring-deep-pink shadow-sm"
          />
        </div>

        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-card rounded-2xl border border-border overflow-hidden animate-pulse">
                <div className="aspect-[4/3] bg-muted" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="text-center py-20 bg-card rounded-2xl border border-border">
            <p className="text-5xl mb-4">🌸</p>
            <p className="text-muted-foreground">
              {tab === "following" ? "Follow creators to see their posts here." : "No posts yet — be the first to share!"}
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {visible.map((p, i) => {
              const isVerified = verifiedIds.has(p.id);
              const isUp = upvoted.has(p.id);
              const isSaved = saved.has(p.id);
              return (
                <div key={p.id}
                     style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
                     className="group bg-card rounded-2xl border border-border overflow-hidden hover:shadow-soft hover:-translate-y-1 transition-all animate-[fade-up_0.5s_ease-out_both]">
                  <Link to="/post/$postId" params={{ postId: p.id }} className="block">
                    <div className="relative aspect-[4/3] bg-gradient-to-br from-rose via-accent to-gold flex items-center justify-center text-6xl overflow-hidden">
                      {p.thumbnail_url ? (
                        <img src={p.thumbnail_url} alt={p.title}
                             className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                             loading="lazy" />
                      ) : "🌸"}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      {isVerified && (
                        <span className="absolute top-3 left-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full glass border border-border text-xs font-semibold text-deep-pink shadow-sm">
                          <BadgeCheck size={14} /> Verified
                        </span>
                      )}
                      {p.niche && (
                        <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full glass border border-border text-[10px] font-bold uppercase tracking-wider">
                          #{p.niche}
                        </span>
                      )}
                    </div>
                    <div className="p-5">
                      <h3 className="font-serif font-bold text-lg line-clamp-1 group-hover:text-deep-pink transition-colors">{p.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1.5">{p.description}</p>
                      <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground">
                        {p.profiles?.avatar_url ? (
                          <img src={p.profiles.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover ring-2 ring-deep-pink/30" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-gradient-pink flex items-center justify-center text-primary-foreground text-[10px] font-bold">
                            {(p.profiles?.display_name ?? "C")[0].toUpperCase()}
                          </div>
                        )}
                        <span className="font-medium">by {p.profiles?.display_name ?? "creator"}</span>
                      </div>
                    </div>
                  </Link>
                  <div className="px-5 pb-4 flex items-center gap-3 border-t border-border pt-3">
                    <button onClick={() => toggleUpvote(p.id)}
                            className={`inline-flex items-center gap-1.5 text-sm font-semibold transition-all hover:scale-105 ${isUp ? "text-deep-pink" : "text-muted-foreground hover:text-foreground"}`}>
                      <Heart size={16} fill={isUp ? "currentColor" : "none"} /> {counts[p.id] ?? 0}
                    </button>
                    <button onClick={() => toggleSave(p.id)}
                            className={`inline-flex items-center gap-1.5 text-sm font-semibold ml-auto transition-all hover:scale-105 ${isSaved ? "text-deep-pink" : "text-muted-foreground hover:text-foreground"}`}>
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

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-pink p-10 md:p-16 text-center text-primary-foreground shadow-glow">
          <div aria-hidden className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white/20 blur-3xl" />
          <div aria-hidden className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full bg-gold/40 blur-3xl" />
          <div className="relative">
            <div className="flex justify-center gap-1 mb-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} size={20} fill="currentColor" className="text-gold" />
              ))}
            </div>
            <h2 className="text-3xl md:text-5xl font-serif font-bold leading-tight">
              Your reviews deserve <em className="not-italic">real</em> rewards.
            </h2>
            <p className="mt-4 text-primary-foreground/90 max-w-xl mx-auto">
              Join the creators turning honest opinions into a steady income.
            </p>
            <Link to="/auth"
                  className="inline-flex items-center gap-2 mt-8 px-8 py-3.5 rounded-full bg-background text-deep-pink font-bold hover:scale-105 transition-transform shadow-lg">
              Create your free account
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      <footer className="px-6 py-10 border-t border-border text-sm text-muted-foreground text-center">
        <div className="font-serif text-xl font-bold text-foreground mb-2">AffLink</div>
        © 2026 AffLink · Built for creators who tell the truth.
      </footer>
    </div>
  );
}

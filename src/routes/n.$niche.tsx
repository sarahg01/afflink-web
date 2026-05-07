import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";

export const Route = createFileRoute("/n/$niche")({
  component: NicheHub,
});

type FeedPost = {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  niche: string | null;
  profiles: { display_name: string | null; avatar_url: string | null } | null;
};

function NicheHub() {
  const { niche } = Route.useParams();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("posts")
        .select("id, title, description, thumbnail_url, niche, profiles(display_name, avatar_url)")
        .eq("published", true)
        .eq("niche", niche)
        .order("created_at", { ascending: false });
      setPosts((data as any) ?? []);
      setLoading(false);
    })();
  }, [niche]);

  return (
    <div className="min-h-screen">
      <Header />
      <section className="max-w-6xl mx-auto px-6 py-10">
        <Link to="/" className="text-sm text-muted-foreground">← All reviews</Link>
        <h1 className="mt-3 text-4xl font-serif font-bold capitalize">/n/{niche}</h1>
        <p className="text-muted-foreground mt-1">Honest reviews from the {niche} community.</p>

        <div className="mt-8">
          {loading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : posts.length === 0 ? (
            <p className="text-muted-foreground">No posts in this niche yet.</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {posts.map((p) => (
                <Link key={p.id} to="/post/$postId" params={{ postId: p.id }}
                      className="group bg-card rounded-xl border border-border overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition">
                  <div className="aspect-[4/3] bg-gradient-to-br from-accent to-rose flex items-center justify-center text-5xl">
                    {p.thumbnail_url ? <img src={p.thumbnail_url} alt={p.title} className="w-full h-full object-cover" /> : "🌸"}
                  </div>
                  <div className="p-4">
                    <h3 className="font-serif font-bold text-lg line-clamp-1">{p.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{p.description}</p>
                    <p className="text-xs text-muted-foreground mt-2">by {p.profiles?.display_name ?? "creator"}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

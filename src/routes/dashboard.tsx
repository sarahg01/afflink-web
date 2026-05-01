import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Header } from "@/components/Header";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  component: Dashboard,
});

type Profile = {
  id: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  instagram_handle: string | null;
  social_links: Record<string, string> | null;
  click_rate: number;
};
type Post = { id: string; title: string; thumbnail_url: string | null; created_at: string };

function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [stats, setStats] = useState({ totalClicks: 0, totalPosts: 0, earnings: 0 });
  const [tab, setTab] = useState<"posts" | "profile" | "new">("posts");

  useEffect(() => {
    if (!authLoading && !user) router.navigate({ to: "/auth" });
  }, [user, authLoading, router]);

  const load = async () => {
    if (!user) return;
    const [{ data: p }, { data: ps }, { data: links }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase.from("posts").select("id, title, thumbnail_url, created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("affiliate_links").select("clicks").eq("user_id", user.id),
    ]);
    setProfile(p as any);
    setPosts((ps as any) ?? []);
    const totalClicks = (links ?? []).reduce((s: number, l: any) => s + (l.clicks ?? 0), 0);
    const rate = (p as any)?.click_rate ?? 1;
    setStats({ totalClicks, totalPosts: ps?.length ?? 0, earnings: totalClicks * Number(rate) });
  };

  useEffect(() => { load(); }, [user]);

  if (authLoading || !user || !profile) return <div className="min-h-screen"><Header /><p className="p-12 text-center text-muted-foreground">Loading…</p></div>;

  return (
    <div className="min-h-screen">
      <Header />
      <div className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="text-3xl font-serif font-bold">Hey, {profile.display_name ?? "creator"} ✨</h1>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          {[
            { label: "Posts", value: stats.totalPosts },
            { label: "Total Clicks", value: stats.totalClicks },
            { label: "Earnings (₹)", value: stats.earnings.toFixed(2) },
          ].map((s) => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-5">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-serif font-bold mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-8 border-b border-border">
          {(["posts", "new", "profile"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-semibold capitalize border-b-2 -mb-px ${
                tab === t ? "border-deep-pink text-deep-pink" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "new" ? "+ New post" : t}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {tab === "posts" && <PostsTab posts={posts} onChange={load} />}
          {tab === "new" && <NewPostTab userId={user.id} onCreated={() => { setTab("posts"); load(); }} />}
          {tab === "profile" && <ProfileTab profile={profile} onSaved={load} />}
        </div>
      </div>
    </div>
  );
}

function PostsTab({ posts, onChange }: { posts: Post[]; onChange: () => void }) {
  const del = async (id: string) => {
    if (!confirm("Delete this post?")) return;
    const { error } = await supabase.from("posts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    onChange();
  };
  if (posts.length === 0) return <p className="text-muted-foreground">No posts yet. Create your first!</p>;
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {posts.map((p) => (
        <div key={p.id} className="bg-card border border-border rounded-xl overflow-hidden">
          <Link to="/post/$postId" params={{ postId: p.id }} className="block aspect-[4/3] bg-gradient-to-br from-accent to-rose">
            {p.thumbnail_url && <img src={p.thumbnail_url} alt="" className="w-full h-full object-cover" />}
          </Link>
          <div className="p-3 flex items-center justify-between">
            <p className="font-semibold text-sm line-clamp-1">{p.title}</p>
            <button onClick={() => del(p.id)} className="text-muted-foreground hover:text-destructive">
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function NewPostTab({ userId, onCreated }: { userId: string; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [thumb, setThumb] = useState<File | null>(null);
  const [links, setLinks] = useState<{ label: string; url: string }[]>([{ label: "", url: "" }]);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      let thumbnail_url: string | null = null;
      if (thumb) {
        const path = `${userId}/${Date.now()}-${thumb.name}`;
        const { error: upErr } = await supabase.storage.from("thumbnails").upload(path, thumb);
        if (upErr) throw upErr;
        thumbnail_url = supabase.storage.from("thumbnails").getPublicUrl(path).data.publicUrl;
      }
      const { data: post, error } = await supabase
        .from("posts")
        .insert({ user_id: userId, title, description, thumbnail_url })
        .select().single();
      if (error) throw error;

      const valid = links.filter((l) => l.label && l.url);
      if (valid.length) {
        const { error: lErr } = await supabase.from("affiliate_links").insert(
          valid.map((l, i) => ({ post_id: post.id, user_id: userId, label: l.label, url: l.url, position: i }))
        );
        if (lErr) throw lErr;
      }
      toast.success("Post published!");
      onCreated();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 max-w-2xl">
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Post title" required
             className="w-full px-4 py-3 rounded-lg border border-border bg-background" />
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description / review"
                rows={4} className="w-full px-4 py-3 rounded-lg border border-border bg-background" />
      <div>
        <label className="block text-sm font-semibold mb-1">Thumbnail</label>
        <input type="file" accept="image/*" onChange={(e) => setThumb(e.target.files?.[0] ?? null)} />
      </div>

      <div>
        <label className="block text-sm font-semibold mb-2">Affiliate Links</label>
        {links.map((l, i) => (
          <div key={i} className="flex gap-2 mb-2">
            <input value={l.label} onChange={(e) => { const c = [...links]; c[i].label = e.target.value; setLinks(c); }}
                   placeholder="Label (e.g. Buy on Amazon)"
                   className="flex-1 px-3 py-2 rounded-md border border-border bg-background" />
            <input value={l.url} onChange={(e) => { const c = [...links]; c[i].url = e.target.value; setLinks(c); }}
                   placeholder="https://..." type="url"
                   className="flex-1 px-3 py-2 rounded-md border border-border bg-background" />
            <button type="button" onClick={() => setLinks(links.filter((_, idx) => idx !== i))}
                    className="px-2 text-muted-foreground hover:text-destructive"><Trash2 size={16} /></button>
          </div>
        ))}
        <button type="button" onClick={() => setLinks([...links, { label: "", url: "" }])}
                className="text-sm text-deep-pink font-semibold flex items-center gap-1">
          <Plus size={14} /> Add link
        </button>
      </div>

      <button disabled={saving} className="px-6 py-3 rounded-lg bg-deep-pink text-primary-foreground font-semibold disabled:opacity-50">
        {saving ? "Publishing…" : "Publish post"}
      </button>
    </form>
  );
}

function ProfileTab({ profile, onSaved }: { profile: Profile; onSaved: () => void }) {
  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [insta, setInsta] = useState(profile.instagram_handle ?? "");
  const [yt, setYt] = useState(profile.social_links?.youtube ?? "");
  const [x, setX] = useState(profile.social_links?.x ?? "");
  const [avatar, setAvatar] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      let avatar_url = profile.avatar_url;
      if (avatar) {
        const path = `${profile.id}/${Date.now()}-${avatar.name}`;
        const { error: upErr } = await supabase.storage.from("avatars").upload(path, avatar, { upsert: true });
        if (upErr) throw upErr;
        avatar_url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
      }
      const { error } = await supabase.from("profiles").update({
        display_name: displayName,
        bio,
        instagram_handle: insta,
        social_links: { youtube: yt, x: x },
        avatar_url,
      }).eq("id", profile.id);
      if (error) throw error;
      toast.success("Profile updated");
      onSaved();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-4">
        {profile.avatar_url && <img src={profile.avatar_url} alt="" className="w-16 h-16 rounded-full object-cover" />}
        <input type="file" accept="image/*" onChange={(e) => setAvatar(e.target.files?.[0] ?? null)} />
      </div>
      <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display name"
             className="w-full px-4 py-3 rounded-lg border border-border bg-background" />
      <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Short bio" rows={3}
                className="w-full px-4 py-3 rounded-lg border border-border bg-background" />
      <input value={insta} onChange={(e) => setInsta(e.target.value)} placeholder="Instagram handle (without @)"
             className="w-full px-4 py-3 rounded-lg border border-border bg-background" />
      <input value={yt} onChange={(e) => setYt(e.target.value)} placeholder="YouTube URL"
             className="w-full px-4 py-3 rounded-lg border border-border bg-background" />
      <input value={x} onChange={(e) => setX(e.target.value)} placeholder="X (Twitter) URL"
             className="w-full px-4 py-3 rounded-lg border border-border bg-background" />
      <button disabled={saving} className="px-6 py-3 rounded-lg bg-deep-pink text-primary-foreground font-semibold disabled:opacity-50">
        {saving ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}

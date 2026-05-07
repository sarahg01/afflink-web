
-- Niche on posts
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS niche text;
CREATE INDEX IF NOT EXISTS idx_posts_niche ON public.posts(niche);

-- Saves / wishlist
CREATE TABLE IF NOT EXISTS public.saves (
  user_id uuid NOT NULL,
  post_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);
ALTER TABLE public.saves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads saves" ON public.saves FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Owner creates saves" ON public.saves FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner deletes saves" ON public.saves FOR DELETE USING (auth.uid() = user_id);

-- Follows
CREATE TABLE IF NOT EXISTS public.follows (
  follower_id uuid NOT NULL,
  following_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Follows readable by everyone" ON public.follows FOR SELECT USING (true);
CREATE POLICY "Owner creates follows" ON public.follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Owner deletes follows" ON public.follows FOR DELETE USING (auth.uid() = follower_id);

-- Upvotes
CREATE TABLE IF NOT EXISTS public.upvotes (
  user_id uuid NOT NULL,
  post_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);
ALTER TABLE public.upvotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Upvotes readable by everyone" ON public.upvotes FOR SELECT USING (true);
CREATE POLICY "Owner creates upvotes" ON public.upvotes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner deletes upvotes" ON public.upvotes FOR DELETE USING (auth.uid() = user_id);

-- Helper: post is "verified review" if any of its tracking_links produced a confirmed order
CREATE OR REPLACE FUNCTION public.post_is_verified(_post_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tracking_links tl
    JOIN public.orders o ON o.tracking_link_id = tl.id
    WHERE tl.post_id = _post_id AND o.status = 'confirmed'
  );
$$;

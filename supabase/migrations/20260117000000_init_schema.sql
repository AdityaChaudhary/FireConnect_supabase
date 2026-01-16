-- 1. Create Public Tables

-- Users Table (Matches Auth UID)
CREATE TABLE public.users (
  id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
  username TEXT UNIQUE,
  email TEXT,
  display_name TEXT,
  bio TEXT,
  gender TEXT,
  location TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  interests TEXT[],
  user_type TEXT DEFAULT 'HUMAN' CHECK (user_type IN ('HUMAN', 'AI')),
  stripe_role TEXT DEFAULT 'FREE' CHECK (stripe_role IN ('FREE', 'PRO', 'MAX')),
  spy_credits INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profile Images Table
CREATE TABLE public.profile_images (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users NOT NULL,
  url TEXT NOT NULL,
  blurred_url TEXT,
  is_profile BOOLEAN DEFAULT FALSE,
  display_order INTEGER DEFAULT 0,
  visibility TEXT DEFAULT 'PUBLIC' CHECK (visibility IN ('PUBLIC', 'PRIVATE', 'CONNECTIONS')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Connections Table
CREATE TABLE public.connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id UUID REFERENCES public.users NOT NULL,
  recipient_id UUID REFERENCES public.users NOT NULL,
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONNECTED', 'DECLINED')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(requester_id, recipient_id)
);

-- Threads Table
CREATE TABLE public.threads (
  id TEXT PRIMARY KEY, -- Deterministic: [uid1, uid2].sort().join('_')
  participants UUID[] NOT NULL,
  last_message TEXT,
  last_message_time TIMESTAMPTZ,
  last_read JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages Table
CREATE TABLE public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id TEXT REFERENCES public.threads NOT NULL,
  sender_id UUID REFERENCES public.users NOT NULL,
  text TEXT,
  media_url TEXT,
  type TEXT DEFAULT 'text' CHECK (type IN ('text', 'image')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Online Status Table
CREATE TABLE public.user_online_status (
  user_id UUID REFERENCES public.users NOT NULL PRIMARY KEY,
  last_seen_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stories Table
CREATE TABLE public.stories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users NOT NULL,
  media_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Notification Check Table
CREATE TABLE public.notification_check (
  user_id UUID REFERENCES public.users NOT NULL PRIMARY KEY,
  last_checked_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable Row Level Security (RLS)

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_online_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_check ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies

-- Public Users: Everyone can read for discovery, only self can update
CREATE POLICY "Users are viewable by everyone" ON public.users FOR SELECT USING (true);
CREATE POLICY "Users can update own record" ON public.users FOR UPDATE USING (auth.uid() = id);

-- Profile Images: 
-- 1. Everyone can see PUBLIC images.
-- 2. Owner can see all own images.
-- 3. PRO/MAX users can see PRIVATE images.
CREATE POLICY "Anyone can view public profile images" ON public.profile_images 
  FOR SELECT USING (visibility = 'PUBLIC');
CREATE POLICY "Users can view own profile images" ON public.profile_images 
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Pro users can view private profile images" ON public.profile_images 
  FOR SELECT USING (
    visibility = 'PRIVATE' AND 
    (SELECT stripe_role FROM public.users WHERE id = auth.uid()) IN ('PRO', 'MAX')
  );
CREATE POLICY "Users can manage own profile images" ON public.profile_images 
  FOR ALL USING (auth.uid() = user_id);

-- Connections: Requester or recipient can see/manage
CREATE POLICY "Users can view own connections" ON public.connections 
  FOR SELECT USING (auth.uid() = requester_id OR auth.uid() = recipient_id);
CREATE POLICY "Users can manage own connections" ON public.connections 
  FOR ALL USING (auth.uid() = requester_id OR auth.uid() = recipient_id);

-- Threads: Participants can see
CREATE POLICY "Threads are viewable by participants" ON public.threads 
  FOR SELECT USING (auth.uid() = ANY(participants));

-- Messages: Thread participants can see/create
CREATE POLICY "Messages are viewable by thread participants" ON public.messages 
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.threads 
      WHERE threads.id = messages.thread_id 
      AND auth.uid() = ANY(threads.participants)
    )
  );
CREATE POLICY "Users can send messages to own threads" ON public.messages 
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM public.threads 
      WHERE threads.id = messages.thread_id 
      AND auth.uid() = ANY(threads.participants)
    )
  );

-- Online Status: Everyone can see
CREATE POLICY "Online status viewable by everyone" ON public.user_online_status FOR SELECT USING (true);
CREATE POLICY "Users can update own online status" ON public.user_online_status FOR ALL USING (auth.uid() = user_id);

-- Stories: Everyone can see, only owner can manage
CREATE POLICY "Stories viewable by everyone" ON public.stories FOR SELECT USING (expires_at > NOW());
CREATE POLICY "Users can manage own stories" ON public.stories FOR ALL USING (auth.uid() = user_id);

-- Notification Check: Only self
CREATE POLICY "Notification check viewable/updatable by owner" ON public.notification_check 
  FOR ALL USING (auth.uid() = user_id);

-- 4. Triggers and Functions

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, display_name, username)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'display_name'),
    COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1))
  );
  
  INSERT INTO public.user_online_status (user_id) VALUES (NEW.id);
  INSERT INTO public.notification_check (user_id) VALUES (NEW.id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to sync public.users stripe_role to auth.users metadata
CREATE OR REPLACE FUNCTION public.sync_user_role_to_auth()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data = 
    COALESCE(raw_app_meta_data, '{}'::jsonb) || 
    jsonb_build_object('stripe_role', NEW.stripe_role)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for stripe_role update
DROP TRIGGER IF EXISTS on_user_role_update ON public.users;
CREATE TRIGGER on_user_role_update
  AFTER UPDATE OF stripe_role ON public.users
  FOR EACH ROW
  WHEN (OLD.stripe_role IS DISTINCT FROM NEW.stripe_role)
  EXECUTE FUNCTION public.sync_user_role_to_auth();

-- 5. Indexes for Performance

CREATE INDEX idx_profile_images_user_id ON public.profile_images(user_id);
CREATE INDEX idx_connections_requester_recipient ON public.connections(requester_id, recipient_id);
CREATE INDEX idx_messages_thread_id ON public.messages(thread_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX idx_threads_participants ON public.threads USING GIN (participants);
CREATE INDEX idx_stories_user_id ON public.stories(user_id);
CREATE INDEX idx_stories_expires_at ON public.stories(expires_at);

ALTER TABLE public.threads ADD COLUMN last_message_sender_id UUID REFERENCES public.users(id);

-- Enable realtime for settings table
ALTER TABLE public.settings REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.settings;
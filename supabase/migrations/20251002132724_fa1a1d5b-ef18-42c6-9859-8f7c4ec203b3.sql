-- Make user@example.com an admin
INSERT INTO public.user_roles (user_id, role)
VALUES ('834daaaa-cc76-4a34-8dc5-5d07af59cc4e', 'admin'::app_role)
ON CONFLICT (user_id, role) DO NOTHING;
-- Create indexes on connections table to improve performance
CREATE INDEX IF NOT EXISTS connections_recipient_id_idx ON public.connections USING btree (recipient_id);
CREATE INDEX IF NOT EXISTS connections_status_idx ON public.connections USING btree (status);

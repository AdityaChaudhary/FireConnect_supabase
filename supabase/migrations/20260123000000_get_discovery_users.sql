-- Migration to add randomized discovery fetching RPC

CREATE OR REPLACE FUNCTION public.get_discovery_users(
  p_user_id UUID,
  p_seed TEXT,
  p_offset INTEGER DEFAULT 0,
  p_limit INTEGER DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_agg(u_data)
  INTO result
  FROM (
    SELECT 
      u.*,
      (
        SELECT row_to_json(uos)
        FROM public.user_online_status uos
        WHERE uos.user_id = u.id
      ) as user_online_status,
      (
        SELECT json_agg(pi)
        FROM (
          SELECT *
          FROM public.profile_images
          WHERE user_id = u.id
          ORDER BY is_profile DESC, display_order ASC
        ) pi
      ) as profile_images
    FROM public.users u
    WHERE u.id != p_user_id
    ORDER BY md5(u.id::text || p_seed)
    LIMIT p_limit
    OFFSET p_offset
  ) u_data;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

-- Grant access to authenticated users and anonymous users (if needed for public discovery)
GRANT EXECUTE ON FUNCTION public.get_discovery_users(UUID, TEXT, INTEGER, INTEGER) TO anon, authenticated, service_role;

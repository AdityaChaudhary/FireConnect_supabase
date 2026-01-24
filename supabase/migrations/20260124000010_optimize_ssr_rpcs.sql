-- RPC for Loading ChatList Data
CREATE OR REPLACE FUNCTION get_chat_view_data(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result json;
    connections_data json;
    threads_data json;
    participants_data json;
    all_participant_ids uuid[];
BEGIN
    -- 1. Get Connections (Active and Pending)
    SELECT json_agg(
        json_build_object(
            'id', c.id,
            'status', c.status,
            'requester_id', c.requester_id,
            'recipient_id', c.recipient_id,
            'requester', (SELECT json_build_object(
                'id', u.id, 'username', u.username, 'display_name', u.display_name, 
                'profile_picture_url', u.profile_picture_url, 'gender', u.gender, 'user_type', u.user_type, 'stripe_role', u.stripe_role,
                'user_online_status', (SELECT json_agg(uos.*) FROM user_online_status uos WHERE uos.user_id = u.id)
            ) FROM users u WHERE u.id = c.requester_id),
            'recipient', (SELECT json_build_object(
                'id', u.id, 'username', u.username, 'display_name', u.display_name, 
                'profile_picture_url', u.profile_picture_url, 'gender', u.gender, 'user_type', u.user_type, 'stripe_role', u.stripe_role,
                 'user_online_status', (SELECT json_agg(uos.*) FROM user_online_status uos WHERE uos.user_id = u.id)
            ) FROM users u WHERE u.id = c.recipient_id)
        )
    ) INTO connections_data
    FROM connections c
    WHERE c.requester_id = p_user_id OR c.recipient_id = p_user_id;

    -- 2. Get Threads
    SELECT json_agg(
        json_build_object(
            'id', t.id,
            'participants', t.participants,
            'last_message', t.last_message,
            'last_message_time', t.last_message_time,
            'last_message_sender_id', t.last_message_sender_id,
            'last_read', t.last_read
        ) ORDER BY t.last_message_time DESC
    ) INTO threads_data
    FROM threads t
    WHERE t.participants @> ARRAY[p_user_id];

    -- 3. Collect Participant IDs for threads
    WITH thread_participants AS (
        SELECT unnest(t.participants) as user_id_uuid
        FROM threads t
        WHERE t.participants @> ARRAY[p_user_id]
    )
    SELECT array_agg(DISTINCT tp.user_id_uuid)
    INTO all_participant_ids
    FROM thread_participants tp
    WHERE tp.user_id_uuid <> p_user_id;

    -- 4. Get Participants Data
    IF all_participant_ids IS NOT NULL THEN
        SELECT json_object_agg(
            u.id::text,
            json_build_object(
                'id', u.id,
                'username', u.username,
                'display_name', u.display_name,
                'profile_picture_url', u.profile_picture_url,
                'gender', u.gender,
                'user_type', u.user_type,
                'stripe_role', u.stripe_role,
                'user_online_status', (SELECT json_agg(uos.*) FROM user_online_status uos WHERE uos.user_id = u.id)
            )
        ) INTO participants_data
        FROM users u
        WHERE u.id = ANY(all_participant_ids);
    ELSE
        participants_data := '{}'::json;
    END IF;

    -- Construct Final Result
    result := json_build_object(
        'connections', COALESCE(connections_data, '[]'::json),
        'threads', COALESCE(threads_data, '[]'::json),
        'participants', COALESCE(participants_data, '{}'::json)
    );

    RETURN result;
END;
$$;

-- RPC for Loading Profile Data (Self or Other) - Already correct
CREATE OR REPLACE FUNCTION get_profile_view_data(p_target_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result json;
    images_data json;
    spy_count_val bigint;
BEGIN
    -- 1. Get Profile Images
    SELECT json_agg(
        json_build_object(
            'id', pi.id,
            'url', pi.url,
            'visibility', pi.visibility,
            'is_profile', pi.is_profile,
            'display_order', pi.display_order,
            'blurred_url', pi.blurred_url
        ) ORDER BY pi.display_order ASC
    ) INTO images_data
    FROM profile_images pi
    WHERE pi.user_id = p_target_user_id;

    -- 2. Get Spy Count
    SELECT count(*) INTO spy_count_val
    FROM spied_profiles sp
    WHERE sp.user_id = p_target_user_id;

    result := json_build_object(
        'images', COALESCE(images_data, '[]'::json),
        'spy_count', COALESCE(spy_count_val, 0)
    );

    RETURN result;
END;
$$;

-- RPC for Landing Page Data
CREATE OR REPLACE FUNCTION get_landing_page_data()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result json;
    products_data json;
    ai_users_data json;
BEGIN
    -- 1. Get Active Products
    SELECT json_agg(p) INTO products_data FROM get_active_plans() p;

    -- 2. Get AI Users
    SELECT json_agg(
        json_build_object(
            'id', u.id,
            'username', u.username,
            'display_name', u.display_name,
            'profile_picture_url', u.profile_picture_url,
            'gender', u.gender,
            'user_type', u.user_type,
            'interests', u.interests,
            'location', u.location,
            'user_online_status', (SELECT json_agg(uos.*) FROM user_online_status uos WHERE uos.user_id = u.id)
        )
    ) INTO ai_users_data
    FROM users u
    WHERE u.user_type = 'AI'
    ORDER BY u.created_at DESC
    LIMIT 20;

    result := json_build_object(
        'products', COALESCE(products_data, '[]'::json),
        'ai_users', COALESCE(ai_users_data, '[]'::json)
    );

    RETURN result;
END;
$$;

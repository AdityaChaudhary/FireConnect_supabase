-- RPC for Loading Notifications Data
CREATE OR REPLACE FUNCTION get_notifications_view_data(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result json;
    incoming_requests json;
    accepted_connections json;
    spied_alerts json;
BEGIN
    -- 1. Incoming Connection Requests (received)
    SELECT json_agg(
        json_build_object(
            'id', c.id,
            'created_at', c.created_at,
            'updated_at', c.updated_at,
            'status', c.status,
            'requester_id', c.requester_id,
            'recipient_id', c.recipient_id,
            'requester', (SELECT json_build_object(
                'id', u.id, 'username', u.username, 'display_name', u.display_name, 
                'profile_picture_url', u.profile_picture_url, 'gender', u.gender, 'user_type', u.user_type, 'stripe_role', u.stripe_role
            ) FROM users u WHERE u.id = c.requester_id)
        ) ORDER BY c.created_at DESC
    ) INTO incoming_requests
    FROM connections c
    WHERE c.recipient_id = p_user_id AND c.status = 'PENDING';

    -- 2. Accepted Connections (outgoing, accepted by other)
    SELECT json_agg(
        json_build_object(
            'id', c.id,
            'created_at', c.created_at,
            'updated_at', c.updated_at,
            'status', c.status,
            'requester_id', c.requester_id,
            'recipient_id', c.recipient_id,
            'actor', (SELECT json_build_object(
                'id', u.id, 'username', u.username, 'display_name', u.display_name, 
                'profile_picture_url', u.profile_picture_url, 'gender', u.gender, 'user_type', u.user_type, 'stripe_role', u.stripe_role
            ) FROM users u WHERE u.id = c.recipient_id)
        ) ORDER BY c.updated_at DESC
    ) INTO accepted_connections
    FROM connections c
    WHERE c.requester_id = p_user_id AND c.status = 'CONNECTED';

    -- 3. Spied Alerts
    SELECT json_agg(
        json_build_object(
            'id', s.id,
            'created_at', s.created_at,
            'user_id', s.user_id,
            'target_user_id', s.target_user_id,
            'user', (SELECT json_build_object(
                'id', u.id, 'username', u.username, 'display_name', u.display_name, 
                'profile_picture_url', u.profile_picture_url, 'gender', u.gender, 'user_type', u.user_type, 'stripe_role', u.stripe_role
            ) FROM users u WHERE u.id = s.user_id)
        ) ORDER BY s.created_at DESC
    ) INTO spied_alerts
    FROM spied_profiles s
    WHERE s.target_user_id = p_user_id;

    result := json_build_object(
        'incoming_requests', COALESCE(incoming_requests, '[]'::json),
        'accepted_connections', COALESCE(accepted_connections, '[]'::json),
        'spied_alerts', COALESCE(spied_alerts, '[]'::json)
    );

    RETURN result;
END;
$$;

-- RPC for Loading Profile Preview Data
CREATE OR REPLACE FUNCTION get_profile_preview_data(p_viewer_id uuid, p_target_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result json;
    user_data json;
    images_data json;
    connection_data json;
    spied_data json;
    has_message boolean;
BEGIN
    -- 1. Target User Data
    SELECT json_build_object(
        'id', u.id,
        'username', u.username,
        'display_name', u.display_name,
        'bio', u.bio,
        'gender', u.gender,
        'location', u.location,
        'interests', u.interests,
        'profile_picture_url', u.profile_picture_url,
        'user_type', u.user_type,
        'stripe_role', u.stripe_role,
        'user_online_status', (SELECT json_agg(uos.*) FROM user_online_status uos WHERE uos.user_id = u.id)
    ) INTO user_data
    FROM users u
    WHERE u.id = p_target_user_id;

    -- 2. Profile Images
    SELECT json_agg(
        json_build_object(
            'id', pi.id,
            'url', pi.url,
            'visibility', pi.visibility,
            'is_profile', pi.is_profile,
            'display_order', pi.display_order,
            'blurred_url', pi.blurred_url
        ) ORDER BY pi.is_profile DESC, pi.display_order ASC
    ) INTO images_data
    FROM profile_images pi
    WHERE pi.user_id = p_target_user_id;

    -- 3. Connection Status
    IF p_viewer_id IS NOT NULL THEN
        SELECT json_build_object(
            'id', c.id,
            'status', c.status,
            'requester_id', c.requester_id,
            'recipient_id', c.recipient_id,
            'created_at', c.created_at,
            'updated_at', c.updated_at
        ) INTO connection_data
        FROM connections c
        WHERE (c.requester_id = p_viewer_id AND c.recipient_id = p_target_user_id)
           OR (c.requester_id = p_target_user_id AND c.recipient_id = p_viewer_id)
        LIMIT 1;
    END IF;

    -- 4. Spied Status
    IF p_viewer_id IS NOT NULL THEN
        SELECT json_build_object(
            'id', s.id,
            'created_at', s.created_at
        ) INTO spied_data
        FROM spied_profiles s
        WHERE s.user_id = p_viewer_id AND s.target_user_id = p_target_user_id
        LIMIT 1;
    END IF;

    -- 5. Has Received Message (Thread check)
    IF p_viewer_id IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1 
            FROM threads t
            JOIN messages m ON m.thread_id = t.id
            WHERE t.participants @> ARRAY[p_viewer_id, p_target_user_id]
              AND m.sender_id = p_target_user_id
        ) INTO has_message;
    ELSE
        has_message := false;
    END IF;

    result := json_build_object(
        'user', user_data,
        'images', COALESCE(images_data, '[]'::json),
        'connection', connection_data,
        'spied', spied_data,
        'has_received_message', COALESCE(has_message, false)
    );

    RETURN result;
END;
$$;

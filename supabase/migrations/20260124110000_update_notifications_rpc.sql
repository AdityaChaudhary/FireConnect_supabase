-- Update RPC for Loading Notifications Data to include last_checked_at
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
    last_check timestamptz;
BEGIN
    -- 0. Get Last Checked At
    SELECT last_checked_at INTO last_check
    FROM notification_check
    WHERE user_id = p_user_id;

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
        'spied_alerts', COALESCE(spied_alerts, '[]'::json),
        'last_checked_at', last_check
    );

    RETURN result;
END;
$$;

-- Function to mark notifications as read using server time
CREATE OR REPLACE FUNCTION mark_notifications_as_read(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO notification_check (user_id, last_checked_at)
    VALUES (p_user_id, NOW())
    ON CONFLICT (user_id)
    DO UPDATE SET last_checked_at = NOW();
END;
$$;

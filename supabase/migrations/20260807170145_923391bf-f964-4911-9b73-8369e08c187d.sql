CREATE OR REPLACE FUNCTION public.has_area(_user_id uuid, _area text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND (
        ur.role = 'admin'::public.app_role
        OR _area = ANY(ur.areas_extras)
        OR EXISTS (
          SELECT 1 FROM unnest(COALESCE(ur.areas_extras, '{}'::text[])) AS a
          WHERE split_part(split_part(a, ':', 1), '.', 1) = _area
        )
      )
  )
$function$;
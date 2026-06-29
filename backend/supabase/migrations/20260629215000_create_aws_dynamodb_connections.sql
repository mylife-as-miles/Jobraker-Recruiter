CREATE TABLE IF NOT EXISTS public.recruiter_aws_dynamodb_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.recruiter_workspaces(id) ON DELETE CASCADE,
  region text NOT NULL,
  table_name text NOT NULL,
  access_key_id text NOT NULL,
  secret_access_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  last_test_at timestamptz,
  last_test_status text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recruiter_aws_dynamodb_connections_workspace_key UNIQUE (workspace_id),
  CONSTRAINT recruiter_aws_dynamodb_connections_status_check
    CHECK (last_test_status IS NULL OR last_test_status IN ('success', 'error'))
);

ALTER TABLE public.recruiter_aws_dynamodb_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their DynamoDB connection"
  ON public.recruiter_aws_dynamodb_connections
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert their DynamoDB connection"
  ON public.recruiter_aws_dynamodb_connections
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1
      FROM public.recruiter_workspaces w
      WHERE w.id = workspace_id
        AND w.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can update their DynamoDB connection"
  ON public.recruiter_aws_dynamodb_connections
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1
      FROM public.recruiter_workspaces w
      WHERE w.id = workspace_id
        AND w.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can delete their DynamoDB connection"
  ON public.recruiter_aws_dynamodb_connections
  FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE OR REPLACE FUNCTION public.set_recruiter_aws_dynamodb_connections_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_recruiter_aws_dynamodb_connections_updated_at
  ON public.recruiter_aws_dynamodb_connections;

CREATE TRIGGER set_recruiter_aws_dynamodb_connections_updated_at
  BEFORE UPDATE ON public.recruiter_aws_dynamodb_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.set_recruiter_aws_dynamodb_connections_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.recruiter_aws_dynamodb_connections
  TO authenticated;

import { DescribeTableCommand, DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { handleOptions, json, readPayload } from '../_shared/http.ts'
import { requireWorkspace } from '../_shared/supabase.ts'

type DynamoConfigRow = {
  id: string
  region: string
  table_name: string
  access_key_id: string
  secret_access_key: string
  enabled: boolean
  last_test_at: string | null
  last_test_status: string | null
  last_error: string | null
}

const maskAccessKey = (value: string | null | undefined) => {
  const key = (value ?? '').trim()
  if (!key) return ''
  if (key.length <= 8) return `${key.slice(0, 2)}••••`
  return `${key.slice(0, 4)}••••${key.slice(-4)}`
}

const sanitizeRegion = (value: unknown) => String(value ?? '').trim()
const sanitizeTableName = (value: unknown) => String(value ?? '').trim()
const sanitizeSecret = (value: unknown) => String(value ?? '').trim()

const publicConfig = (row: DynamoConfigRow | null) => ({
  configured: Boolean(row?.access_key_id && row?.secret_access_key && row?.region && row?.table_name),
  enabled: row?.enabled ?? false,
  region: row?.region ?? '',
  tableName: row?.table_name ?? '',
  accessKeyIdMasked: maskAccessKey(row?.access_key_id),
  lastTestAt: row?.last_test_at ?? null,
  lastTestStatus: row?.last_test_status ?? null,
  lastError: row?.last_error ?? null,
})

const testDynamoTable = async (config: {
  region: string
  tableName: string
  accessKeyId: string
  secretAccessKey: string
}) => {
  const client = new DynamoDBClient({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  })

  const result = await client.send(new DescribeTableCommand({ TableName: config.tableName }))
  return {
    tableName: result.Table?.TableName ?? config.tableName,
    tableStatus: result.Table?.TableStatus ?? null,
    itemCount: result.Table?.ItemCount ?? null,
  }
}

Deno.serve(async (req) => {
  const early = handleOptions(req)
  if (early) return early

  try {
    const { channel = '', args = {} } = await readPayload(req)
    const { supabase, user, workspaceId } = await requireWorkspace(req)

    const loadConfig = async () => {
      const result = await supabase
        .from('recruiter_aws_dynamodb_connections')
        .select('id, region, table_name, access_key_id, secret_access_key, enabled, last_test_at, last_test_status, last_error')
        .eq('workspace_id', workspaceId)
        .maybeSingle()
      if (result.error) throw result.error
      return (result.data ?? null) as DynamoConfigRow | null
    }

    switch (channel) {
      case 'aws-dynamodb:getConfig': {
        const config = await loadConfig()
        return json(publicConfig(config))
      }

      case 'aws-dynamodb:saveConfig': {
        const region = sanitizeRegion(args.region)
        const tableName = sanitizeTableName(args.tableName)
        const accessKeyId = sanitizeSecret(args.accessKeyId)
        const secretAccessKey = sanitizeSecret(args.secretAccessKey)
        const enabled = args.enabled !== false

        if (!region || !tableName || !accessKeyId || !secretAccessKey) {
          return json({ error: 'Region, table name, access key ID, and secret access key are required.' }, 400)
        }

        const result = await supabase
          .from('recruiter_aws_dynamodb_connections')
          .upsert({
            user_id: user.id,
            workspace_id: workspaceId,
            region,
            table_name: tableName,
            access_key_id: accessKeyId,
            secret_access_key: secretAccessKey,
            enabled,
            last_test_status: null,
            last_error: null,
          }, { onConflict: 'workspace_id' })
          .select('id, region, table_name, access_key_id, secret_access_key, enabled, last_test_at, last_test_status, last_error')
          .single()

        if (result.error) throw result.error
        return json(publicConfig(result.data as DynamoConfigRow))
      }

      case 'aws-dynamodb:testConfig': {
        const existing = await loadConfig()
        const region = sanitizeRegion(args.region) || existing?.region || ''
        const tableName = sanitizeTableName(args.tableName) || existing?.table_name || ''
        const accessKeyId = sanitizeSecret(args.accessKeyId) || existing?.access_key_id || ''
        const secretAccessKey = sanitizeSecret(args.secretAccessKey) || existing?.secret_access_key || ''

        if (!region || !tableName || !accessKeyId || !secretAccessKey) {
          return json({ error: 'Save or enter complete DynamoDB credentials before testing.' }, 400)
        }

        try {
          const test = await testDynamoTable({ region, tableName, accessKeyId, secretAccessKey })
          if (existing?.id) {
            await supabase
              .from('recruiter_aws_dynamodb_connections')
              .update({ last_test_at: new Date().toISOString(), last_test_status: 'success', last_error: null })
              .eq('id', existing.id)
          }
          return json({ ok: true, ...test })
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          if (existing?.id) {
            await supabase
              .from('recruiter_aws_dynamodb_connections')
              .update({ last_test_at: new Date().toISOString(), last_test_status: 'error', last_error: message })
              .eq('id', existing.id)
          }
          return json({ ok: false, error: message }, 400)
        }
      }

      case 'aws-dynamodb:setEnabled': {
        const enabled = Boolean(args.enabled)
        const result = await supabase
          .from('recruiter_aws_dynamodb_connections')
          .update({ enabled })
          .eq('workspace_id', workspaceId)
          .select('id, region, table_name, access_key_id, secret_access_key, enabled, last_test_at, last_test_status, last_error')
          .maybeSingle()
        if (result.error) throw result.error
        return json(publicConfig((result.data ?? null) as DynamoConfigRow | null))
      }

      case 'aws-dynamodb:removeConfig': {
        const result = await supabase
          .from('recruiter_aws_dynamodb_connections')
          .delete()
          .eq('workspace_id', workspaceId)
        if (result.error) throw result.error
        return json(publicConfig(null))
      }

      default:
        return json({ error: `Unsupported DynamoDB channel: ${channel}` }, 400)
    }
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : String(error) },
      error instanceof Error && error.message === 'Authentication required' ? 401 : 500,
    )
  }
})

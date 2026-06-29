import {
  DescribeTableCommand,
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
} from '@aws-sdk/client-dynamodb'
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'
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
  if (key.length <= 8) return `${key.slice(0, 2)}****`
  return `${key.slice(0, 4)}****${key.slice(-4)}`
}

const sanitizeRegion = (value: unknown) => String(value ?? '').trim()
const sanitizeTableName = (value: unknown) => String(value ?? '').trim()
const sanitizeSecret = (value: unknown) => String(value ?? '').trim()
const randomId = () => crypto.randomUUID()

const safeRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}

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

const createDynamoClient = (config: {
  region: string
  access_key_id?: string
  secret_access_key?: string
  accessKeyId?: string
  secretAccessKey?: string
}) =>
  new DynamoDBClient({
    region: config.region,
    credentials: {
      accessKeyId: config.access_key_id ?? config.accessKeyId ?? '',
      secretAccessKey: config.secret_access_key ?? config.secretAccessKey ?? '',
    },
  })

const assertConfigured = (config: DynamoConfigRow | null) => {
  if (!config?.enabled) {
    throw new Error('DynamoDB is not configured or enabled.')
  }
  return config
}

const testDynamoTable = async (config: {
  region: string
  tableName: string
  accessKeyId: string
  secretAccessKey: string
}) => {
  const client = createDynamoClient(config)
  const result = await client.send(new DescribeTableCommand({ TableName: config.tableName }))
  const keySchema = result.Table?.KeySchema ?? []
  const hasPartitionKey = keySchema.some((key) => key.AttributeName === 'pk' && key.KeyType === 'HASH')
  const hasSortKey = keySchema.some((key) => key.AttributeName === 'sk' && key.KeyType === 'RANGE')
  if (!hasPartitionKey || !hasSortKey) {
    throw new Error('DynamoDB table must use pk as the partition key and sk as the sort key.')
  }
  return {
    tableName: result.Table?.TableName ?? config.tableName,
    tableStatus: result.Table?.TableStatus ?? null,
    itemCount: result.Table?.ItemCount ?? null,
  }
}

const writeOperationalEvent = async (
  config: DynamoConfigRow,
  workspaceId: string,
  userId: string,
  args: Record<string, unknown>,
) => {
  const now = new Date().toISOString()
  const eventType = String(args.eventType ?? args.type ?? 'activity').toLowerCase()
  const recordType =
    eventType === 'audit' ? 'AUDIT' :
    eventType === 'workflow_state' ? 'WORKFLOW_STATE' :
    'ACTIVITY'
  const entityType = String(args.entityType ?? 'workspace')
  const entityId = String(args.entityId ?? randomId())
  const action = String(args.action ?? 'updated')

  const item = {
    pk: `WORKSPACE#${workspaceId}`,
    sk: recordType === 'WORKFLOW_STATE'
      ? `WORKFLOW_STATE#${entityType}#${entityId}`
      : `${recordType}#${now}#${randomId()}`,
    gsi1pk: `${recordType}#${workspaceId}`,
    gsi1sk: now,
    recordType,
    workspaceId,
    userId,
    action,
    entityType,
    entityId,
    title: String(args.title ?? action),
    message: String(args.message ?? ''),
    status: args.status ? String(args.status) : undefined,
    metadata: safeRecord(args.metadata),
    createdAt: now,
    updatedAt: now,
  }

  await createDynamoClient(config).send(new PutItemCommand({
    TableName: config.table_name,
    Item: marshall(item, { removeUndefinedValues: true }),
  }))

  return item
}

const listOperationalEvents = async (
  config: DynamoConfigRow,
  workspaceId: string,
  recordType: 'ACTIVITY' | 'AUDIT',
) => {
  const result = await createDynamoClient(config).send(new QueryCommand({
    TableName: config.table_name,
    KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
    ExpressionAttributeValues: marshall({
      ':pk': `WORKSPACE#${workspaceId}`,
      ':prefix': `${recordType}#`,
    }),
    ScanIndexForward: false,
    Limit: 50,
  }))
  return (result.Items ?? []).map((item) => unmarshall(item))
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

      case 'aws-dynamodb:recordEvent': {
        const config = assertConfigured(await loadConfig())
        const record = await writeOperationalEvent(config, workspaceId, user.id, args)
        return json({ ok: true, record })
      }

      case 'aws-dynamodb:listActivity': {
        const config = assertConfigured(await loadConfig())
        const items = await listOperationalEvents(config, workspaceId, 'ACTIVITY')
        return json({ ok: true, items })
      }

      case 'aws-dynamodb:listAudit': {
        const config = assertConfigured(await loadConfig())
        const items = await listOperationalEvents(config, workspaceId, 'AUDIT')
        return json({ ok: true, items })
      }

      case 'aws-dynamodb:getWorkflowState': {
        const config = assertConfigured(await loadConfig())
        const entityType = String(args.entityType ?? 'background-task')
        const entityId = String(args.entityId ?? '')
        if (!entityId) return json({ error: 'Workflow entity ID is required.' }, 400)
        const result = await createDynamoClient(config).send(new GetItemCommand({
          TableName: config.table_name,
          Key: marshall({
            pk: `WORKSPACE#${workspaceId}`,
            sk: `WORKFLOW_STATE#${entityType}#${entityId}`,
          }),
        }))
        return json({ ok: true, item: result.Item ? unmarshall(result.Item) : null })
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

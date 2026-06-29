type OperationalEventType = 'activity' | 'audit' | 'workflow_state'

type OperationalEvent = {
  eventType: OperationalEventType
  action: string
  entityType: string
  entityId?: string
  title: string
  message?: string
  status?: string
  metadata?: Record<string, unknown>
}

async function recordOperationalEvent(event: OperationalEvent): Promise<void> {
  try {
    if (!window.ipc) return
    await window.ipc.invoke('aws-dynamodb:recordEvent' as never, event as never)
  } catch {
    // DynamoDB is an optional operational layer; product flows should not fail if it is not configured.
  }
}

export function recordRecruiterActivity(event: Omit<OperationalEvent, 'eventType'>): void {
  void recordOperationalEvent({ ...event, eventType: 'activity' })
}

export function recordRecruiterAudit(event: Omit<OperationalEvent, 'eventType'>): void {
  void recordOperationalEvent({ ...event, eventType: 'audit' })
}

export function updateWorkflowState(event: Omit<OperationalEvent, 'eventType'>): void {
  void recordOperationalEvent({ ...event, eventType: 'workflow_state' })
}

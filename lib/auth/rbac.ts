import { AuditAction, type User } from '@/lib/db/schema';
import { logAuditEvent } from '@/lib/db/queries';

export type Role = 'ADMIN' | 'LEARNER' | 'AGENT';
export type Environment = 'staging' | 'prod';

export function isAdmin(user: User) {
  return user.role === 'ADMIN';
}

export function isAgent(user: User) {
  return user.role === 'AGENT';
}

export function isLearner(user: User) {
  return user.role === 'LEARNER';
}

export async function requireRole(
  user: User,
  roles: Role[],
  context: { action: string; entityType?: string; entityId?: string; environment?: Environment }
) {
  if (roles.includes(user.role as Role)) {
    return;
  }

  await logAuditEvent({
    actorUserId: user.id,
    actorRole: user.role,
    action: AuditAction.ACCESS_DENIED,
    entityType: context.entityType,
    entityId: context.entityId,
    environment: context.environment,
    success: false,
    detailsJson: {
      requiredRoles: roles,
      attemptedAction: context.action,
    },
  });

  throw new Error('ACCESS_DENIED');
}

export async function requireEnvironmentWrite(
  user: User,
  environment: Environment,
  context: { action: string; entityType?: string; entityId?: string }
) {
  if (user.role === 'ADMIN') {
    return;
  }

  if (user.role === 'AGENT' && environment === 'staging') {
    return;
  }

  await logAuditEvent({
    actorUserId: user.id,
    actorRole: user.role,
    action: AuditAction.ACCESS_DENIED,
    entityType: context.entityType,
    entityId: context.entityId,
    environment,
    success: false,
    detailsJson: {
      attemptedAction: context.action,
    },
  });

  throw new Error('ACCESS_DENIED');
}

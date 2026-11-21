export type Assignment = { key: string; userId: string; assigneeName?: string; name: string; description: string; type: 'leader' | 'member' };

export const assignmentKey = (actorId: number, id?: number | null) => `cm:assignment-draft:${actorId}:${id ?? 'new'}`;

export function readAssignments(actorId: number, id?: number | null): Assignment[] {
  const raw = localStorage.getItem(assignmentKey(actorId, id));
  if (raw === null) return [];
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object' || !('v' in value) || value.v !== 1 ||
    !('assignments' in value) || !Array.isArray(value.assignments) || !value.assignments.every((item: unknown) => {
      if (!item || typeof item !== 'object') return false;
      const row = item as Record<string, unknown>;
      return ['key', 'userId', 'name', 'description'].every((key) => typeof row[key] === 'string') &&
        (row.assigneeName === undefined || typeof row.assigneeName === 'string') && (row.type === 'leader' || row.type === 'member');
    })) throw new Error('Invalid assignment draft.');
  return value.assignments as Assignment[];
}

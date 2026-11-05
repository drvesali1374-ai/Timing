// ═══════════════════════════════════════════════════════════
// کلیدهای TanStack Query — قرارداد واحد برای کل برنامه
// ═══════════════════════════════════════════════════════════
export const qk = {
  projects: (params?: { q?: string; sort?: string; dir?: string }) =>
    ['projects', params ?? {}] as const,
  project: (id: string) => ['project', id] as const,
  projectSummary: (id: string) => ['project-summary', id] as const,
  projectCalcSettings: (id: string) => ['project-calc-settings', id] as const,
  structure: (projectId: string) => ['structure', projectId] as const,
  stations: (projectId: string) => ['stations', projectId] as const,
  activities: (stationId: string) => ['activities', stationId] as const,
  elements: (activityId: string) => ['elements', activityId] as const,
  activityAllowances: (activityId: string) => ['activity-allowances', activityId] as const,
  elementRating: (elementId: string) => ['element-rating', elementId] as const,
  operators: (projectId: string) => ['operators', projectId] as const,
  groups: (projectId: string) => ['groups', projectId] as const,
  groupAllowances: (groupId: string) => ['group-allowances', groupId] as const,
  categories: (projectId: string) => ['categories', projectId] as const,
  ratingTables: (projectId: string) => ['rating-tables', projectId] as const,
  ratingTable: (tableId: string) => ['rating-table', tableId] as const,
  ratingMatrix: (projectId: string) => ['rating-matrix', projectId] as const,
  backups: () => ['backups'] as const,
  audit: (projectId?: string) => ['audit', projectId ?? 'all'] as const,
  settings: () => ['settings'] as const,
}

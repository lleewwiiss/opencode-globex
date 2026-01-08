import type { Feature } from "../../../src/state/schema.js"

export interface ProgressStats {
  completed: number
  remaining: number
  total: number
}

export interface FeatureUpdate {
  passes?: boolean
  blocked?: boolean
  blockedReason?: string
  notes?: string
}

export function getNextFeature(features: Feature[]): Feature | null {
  const completedIds = new Set(features.filter(f => f.passes).map(f => f.id))

  const eligible = features
    .filter(f => !f.passes)
    .filter(f => !(f as Feature & { blocked?: boolean }).blocked)
    .filter(f => f.dependencies.every(dep => completedIds.has(dep)))
    .sort((a, b) => a.priority - b.priority)

  return eligible[0] ?? null
}

export function updateFeature(
  features: Feature[],
  id: string,
  update: FeatureUpdate
): Feature[] {
  return features.map(f => {
    if (f.id !== id) return f
    return {
      ...f,
      ...(update.passes !== undefined && { passes: update.passes }),
      ...(update.blocked !== undefined && { blocked: update.blocked }),
      ...(update.blockedReason !== undefined && { blockedReason: update.blockedReason }),
      ...(update.notes !== undefined && { notes: update.notes }),
    }
  })
}

export function getProgressStats(features: Feature[]): ProgressStats {
  const completed = features.filter(f => f.passes).length
  const total = features.length
  return {
    completed,
    remaining: total - completed,
    total,
  }
}

import type { Feature } from "../state/schema.js"

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
  attempts?: number
  lastRejectionFeedback?: string[] | undefined
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
    const updated = {
      ...f,
      ...(update.passes !== undefined && { passes: update.passes }),
      ...(update.blocked !== undefined && { blocked: update.blocked }),
      ...(update.blockedReason !== undefined && { blockedReason: update.blockedReason }),
      ...(update.notes !== undefined && { notes: update.notes }),
      ...(update.attempts !== undefined && { attempts: update.attempts }),
      ...(update.lastRejectionFeedback !== undefined && { lastRejectionFeedback: update.lastRejectionFeedback }),
    }
    // Remove lastRejectionFeedback if explicitly set to undefined
    if (update.lastRejectionFeedback === undefined && "lastRejectionFeedback" in update) {
      delete (updated as Record<string, unknown>).lastRejectionFeedback
    }
    return updated
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

export interface CategoryCount {
  category: string
  count: number
}

export function getFeatureCategories(features: Feature[]): CategoryCount[] {
  const counts = new Map<string, number>()
  for (const f of features) {
    const cat = f.category || "other"
    counts.set(cat, (counts.get(cat) || 0) + 1)
  }
  return Array.from(counts.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
}

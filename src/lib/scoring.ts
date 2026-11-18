export type MatchProfile = {
  id: string
  city: string | null
  areas: string[]
  budget_min: number | null
  budget_max: number | null
  move_in_date: string | null
  room_type: string | null
  lifestyle: Record<string, string | boolean | null>
}

export type MatchBreakdown = {
  budget: number
  location: number
  lifestyle: number
  moveIn: number
  roomType: number
  total: number
}

export function scoreMatch(viewer: MatchProfile, candidate: MatchProfile): MatchBreakdown {
  const budget =
    viewer.budget_min == null ||
    viewer.budget_max == null ||
    candidate.budget_min == null ||
    candidate.budget_max == null
      ? 0
      : viewer.budget_min <= candidate.budget_max &&
          candidate.budget_min <= viewer.budget_max
        ? 25
        : 0
  const location =
    viewer.city?.trim().toLowerCase() === candidate.city?.trim().toLowerCase() &&
    Boolean(viewer.city)
      ? candidate.areas.some((area) =>
          viewer.areas.some((preferred) => preferred.toLowerCase() === area.toLowerCase()),
        )
        ? 20
        : 10
      : 0
  const keys = new Set([...Object.keys(viewer.lifestyle), ...Object.keys(candidate.lifestyle)])
  const comparable = [...keys].filter(
    (key) => viewer.lifestyle[key] != null && candidate.lifestyle[key] != null,
  )
  const lifestyle = comparable.length
    ? Math.round(
        (comparable.filter((key) => viewer.lifestyle[key] === candidate.lifestyle[key]).length /
          comparable.length) *
          30,
      )
    : 0
  const moveIn =
    viewer.move_in_date && candidate.move_in_date
      ? Math.max(
          0,
          15 -
            Math.min(
              15,
              Math.floor(
                Math.abs(
                  new Date(viewer.move_in_date).getTime() -
                    new Date(candidate.move_in_date).getTime(),
                ) /
                  86_400_000 /
                  7,
              ),
            ),
        )
      : 0
  const roomType =
    viewer.room_type && candidate.room_type
      ? viewer.room_type === candidate.room_type ||
        viewer.room_type === 'either' ||
        candidate.room_type === 'either'
        ? 10
        : 0
      : 0
  return {
    budget,
    location,
    lifestyle,
    moveIn,
    roomType,
    total: budget + location + lifestyle + moveIn + roomType,
  }
}

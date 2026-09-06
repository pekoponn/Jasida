/**
 * Turns one candidate row from the `find_similar_reports` RPC into a
 * duplicate probability (0-1) plus a recommended action, so the UI can
 * decide: auto-merge / ask user to confirm / treat as new report.
 *
 * Tune these weights against real validation data before the actual demo —
 * these are reasonable starting points, not universal constants.
 */

const WEIGHTS = {
  distance: 0.3,
  imageSimilarity: 0.5,
  recency: 0.2
};

const RADIUS_METERS = 50;
const RECENCY_WINDOW_HOURS = 72;

function distanceScore(distanceMeters) {
  // 1.0 at 0m, tapering to 0 at RADIUS_METERS
  return Math.max(0, 1 - distanceMeters / RADIUS_METERS);
}

function recencyScore(createdAt) {
  const hoursAgo = (Date.now() - new Date(createdAt).getTime()) / 36e5;
  return Math.max(0, 1 - hoursAgo / RECENCY_WINDOW_HOURS);
}

/**
 * @param candidate - one row from find_similar_reports RPC:
 *   { id, damage_type, distance_m, similarity, support_count, created_at }
 */
export function scoreDuplicateCandidate(candidate) {
  const dScore = distanceScore(candidate.distance_m);
  const iScore = Math.max(0, candidate.similarity); // cosine similarity, already 0-1-ish
  const rScore = candidate.created_at ? recencyScore(candidate.created_at) : 0.5;

  const probability =
    dScore * WEIGHTS.distance +
    iScore * WEIGHTS.imageSimilarity +
    rScore * WEIGHTS.recency;

  return {
    ...candidate,
    probability,
    action: recommendedAction(probability)
  };
}

export function recommendedAction(probability) {
  if (probability >= 0.75) return 'auto_merge';
  if (probability >= 0.45) return 'ask_user';
  return 'new_report';
}

/**
 * Ranks and returns the best candidate (or null) from a list of RPC rows.
 */
export function pickBestDuplicate(candidates) {
  if (!candidates?.length) return null;
  const scored = candidates.map(scoreDuplicateCandidate);
  scored.sort((a, b) => b.probability - a.probability);
  return scored[0];
}

const WEIGHTS = {
  distance: 0.3,
  imageSimilarity: 0.5,
  recency: 0.2
};

const RADIUS_METERS = 50;
const RECENCY_WINDOW_HOURS = 72;

function distanceScore(distanceMeters) {
  return Math.max(0, 1 - distanceMeters / RADIUS_METERS);
}

function recencyScore(createdAt) {
  const hoursAgo = (Date.now() - new Date(createdAt).getTime()) / 36e5;
  return Number.isFinite(hoursAgo) ? Math.max(0, Math.min(1, 1 - hoursAgo / RECENCY_WINDOW_HOURS)) : 0;
}

/**
 * @param candidate - one row from find_similar_reports RPC:
 *   { id, damage_type, distance_m, similarity, support_count, created_at }
 */
export function scoreDuplicateCandidate(candidate) {
  if (candidate.match_basis === 'location') {
    return { ...candidate, probability: null, action: 'ask_user' };
  }
  const dScore = distanceScore(candidate.distance_m);
  const iScore = Number.isFinite(candidate.similarity) ? Math.max(0, Math.min(1, candidate.similarity)) : 0;
  const rScore = candidate.created_at ? recencyScore(candidate.created_at) : 0.5;

  const probability =
    dScore * WEIGHTS.distance +
    iScore * WEIGHTS.imageSimilarity +
    rScore * WEIGHTS.recency;

  return {
    ...candidate,
    probability,
    action: recommendedAction(probability, iScore)
  };
}

const IMAGE_SIMILARITY_THRESHOLD = 0.5; 

export function recommendedAction(probability, similarity) {
  if (similarity >= IMAGE_SIMILARITY_THRESHOLD) return 'ask_user';
  if (probability >= 0.75) return 'auto_merge';
  if (probability >= 0.45) return 'ask_user';
  return 'new_report';
}

export function pickBestDuplicate(candidates) {
  if (!candidates?.length) return null;
  const scored = candidates.map(scoreDuplicateCandidate);
  scored.sort((a, b) => {
    const scoreA = Math.max(a.similarity ?? 0, a.probability ?? 0);
    const scoreB = Math.max(b.similarity ?? 0, b.probability ?? 0);
    return scoreB - scoreA || (a.distance_m ?? 0) - (b.distance_m ?? 0);
  });
  return scored[0];
}

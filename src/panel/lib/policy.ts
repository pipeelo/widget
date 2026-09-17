export type PolicyState = 'allowed' | 'blocked' | 'unknown';
export type MediaError = 'blocked' | 'denied' | 'unavailable' | 'failed';

interface FeaturePolicy {
  allowsFeature(feature: string): boolean;
}

export function policyState(feature: string): PolicyState {
  const policy = (document as Document & { featurePolicy?: FeaturePolicy }).featurePolicy;
  if (!policy) return 'unknown';
  try {
    return policy.allowsFeature(feature) ? 'allowed' : 'blocked';
  } catch {
    return 'unknown';
  }
}

export function mediaErrorKind(err: unknown, policyBlocked: boolean): MediaError {
  const name = err instanceof DOMException ? err.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return policyBlocked ? 'blocked' : 'denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'unavailable';
  return 'failed';
}

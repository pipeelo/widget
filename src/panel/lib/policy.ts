export type PolicyState = 'allowed' | 'blocked' | 'unknown';

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

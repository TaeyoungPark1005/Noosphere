// Analytics stub — no-op in self-hosted mode.
// Private cloud repo overrides this with real GA4 / Clarity / PostHog initialization.

export function initAnalytics(): void {
  // no-op
}

export function trackPageView(_path: string): void {
  // no-op
}

export function trackEvent(_name: string, _props?: Record<string, unknown>): void {
  // no-op
}

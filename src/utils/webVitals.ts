import { onCLS, onINP, onFCP, onLCP, onTTFB, type Metric } from 'web-vitals';
import { createLogger } from './logger';
import { generateTraceId } from './traceId';

const log = createLogger('WebVitals');

const METRICS_ENDPOINT = import.meta.env.VITE_METRICS_ENDPOINT;

const reportMetric = (metric: Metric) => {
  if (import.meta.env.DEV) {
    log.debug('metric', { name: metric.name, value: metric.value.toFixed(2) });
    return;
  }

  if (!METRICS_ENDPOINT) return;

  // sendBeacon cannot set custom headers, so include the trace ID in the body
  // for cross-service correlation with CloudWatch logs.
  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    delta: metric.delta,
    id: metric.id,
    navigationType: metric.navigationType,
    traceId: generateTraceId(),
  });

  // Use sendBeacon for reliable delivery (survives page unload)
  if (navigator.sendBeacon) {
    navigator.sendBeacon(`${METRICS_ENDPOINT}/vitals`, body);
  }
};

export const initWebVitals = () => {
  onCLS(reportMetric);
  onINP(reportMetric);
  onFCP(reportMetric);
  onLCP(reportMetric);
  onTTFB(reportMetric);
};

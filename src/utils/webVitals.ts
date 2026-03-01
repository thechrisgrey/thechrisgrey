import { onCLS, onINP, onFCP, onLCP, onTTFB, type Metric } from 'web-vitals';

const reportMetric = (metric: Metric) => {
  if (import.meta.env.DEV) {
    console.log(`[Web Vitals] ${metric.name}: ${metric.value.toFixed(2)}`);
    return;
  }

  // Send to analytics endpoint in production
  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    delta: metric.delta,
    id: metric.id,
    navigationType: metric.navigationType,
  });

  // Use sendBeacon for reliable delivery (survives page unload)
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/vitals', body);
  }
};

export const initWebVitals = () => {
  onCLS(reportMetric);
  onINP(reportMetric);
  onFCP(reportMetric);
  onLCP(reportMetric);
  onTTFB(reportMetric);
};

import { onCLS, onINP, onFCP, onLCP, onTTFB, type Metric } from 'web-vitals';

const reportMetric = (metric: Metric) => {
  // Log metrics in development for debugging
  if (import.meta.env.DEV) {
    console.log(`[Web Vitals] ${metric.name}: ${metric.value.toFixed(2)}`);
  }

  // In production, you could send metrics to an analytics endpoint
  // Example: navigator.sendBeacon('/analytics', JSON.stringify(metric));
};

export const initWebVitals = () => {
  onCLS(reportMetric);   // Cumulative Layout Shift
  onINP(reportMetric);   // Interaction to Next Paint (replaced FID in v4)
  onFCP(reportMetric);   // First Contentful Paint
  onLCP(reportMetric);   // Largest Contentful Paint
  onTTFB(reportMetric);  // Time to First Byte
};

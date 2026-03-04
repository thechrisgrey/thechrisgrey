const ShimmerBlock = ({ className }: { className: string }) => (
  <div className={`bg-altivum-navy/50 rounded animate-pulse ${className}`} aria-hidden="true" />
);

const BlogPostArticleSkeleton = () => (
  <div className="min-h-screen bg-altivum-dark" aria-hidden="true">
    {/* Hero image placeholder */}
    <div className="w-full aspect-[3/1] bg-altivum-navy/30 animate-pulse" />

    <div className="max-w-3xl mx-auto px-6 lg:px-8 -mt-12 relative z-10">
      {/* Category + date */}
      <div className="flex items-center gap-3 mb-6 pt-8">
        <ShimmerBlock className="h-5 w-20" />
        <ShimmerBlock className="h-5 w-32" />
      </div>

      {/* Title */}
      <ShimmerBlock className="h-10 w-full mb-3" />
      <ShimmerBlock className="h-10 w-3/4 mb-8" />

      {/* Meta line (reading time, tags) */}
      <div className="flex items-center gap-3 mb-10">
        <ShimmerBlock className="h-4 w-24" />
        <ShimmerBlock className="h-6 w-16 rounded-full" />
        <ShimmerBlock className="h-6 w-20 rounded-full" />
      </div>

      {/* Body text lines */}
      <div className="space-y-4">
        <ShimmerBlock className="h-4 w-full" />
        <ShimmerBlock className="h-4 w-full" />
        <ShimmerBlock className="h-4 w-5/6" />
        <ShimmerBlock className="h-4 w-full" />
        <ShimmerBlock className="h-4 w-4/5" />
        <ShimmerBlock className="h-4 w-full" />
        <ShimmerBlock className="h-4 w-3/4" />
        <ShimmerBlock className="h-4 w-full" />
      </div>
    </div>
  </div>
);

export default BlogPostArticleSkeleton;

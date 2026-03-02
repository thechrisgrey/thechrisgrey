const shimmer =
  'animate-shimmer bg-gradient-to-r from-altivum-navy/50 via-altivum-slate/20 to-altivum-navy/50 bg-[length:400%_100%] rounded';

const BlogPostSkeleton = () => (
  <article aria-hidden="true">
    <div className={`aspect-video mb-6 rounded-lg ${shimmer}`} />
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <div className={`h-3 w-16 ${shimmer}`} />
        <div className={`h-3 w-24 ${shimmer}`} />
        <div className={`h-3 w-16 ${shimmer}`} />
      </div>
      <div className={`h-7 w-full ${shimmer}`} />
      <div className={`h-7 w-3/4 ${shimmer}`} />
      <div className={`h-4 w-full ${shimmer}`} />
      <div className={`h-4 w-full ${shimmer}`} />
      <div className={`h-4 w-2/3 ${shimmer}`} />
    </div>
    <div className="flex gap-2 mt-4">
      <div className={`h-6 w-16 rounded-full ${shimmer}`} />
      <div className={`h-6 w-20 rounded-full ${shimmer}`} />
    </div>
  </article>
);

export default BlogPostSkeleton;

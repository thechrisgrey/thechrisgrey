const TypingIndicator = () => {
  return (
    <div className="flex items-start mr-auto max-w-[80%] md:max-w-[80%]">
      <div className="bg-white/5 border border-white/10 rounded-2xl rounded-bl-sm px-5 py-4">
        <div className="flex items-center gap-1.5">
          <span
            className="w-2 h-2 bg-altivum-silver/60 rounded-full animate-bounce"
            style={{ animationDelay: '0ms', animationDuration: '0.6s' }}
          />
          <span
            className="w-2 h-2 bg-altivum-silver/60 rounded-full animate-bounce"
            style={{ animationDelay: '150ms', animationDuration: '0.6s' }}
          />
          <span
            className="w-2 h-2 bg-altivum-silver/60 rounded-full animate-bounce"
            style={{ animationDelay: '300ms', animationDuration: '0.6s' }}
          />
        </div>
      </div>
    </div>
  );
};

export default TypingIndicator;

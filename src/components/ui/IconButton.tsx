interface IconButtonProps {
  icon: string;
  label: string;
  onClick?: () => void;
  href?: string;
  className?: string;
}

export const IconButton = ({ icon, label, onClick, href, className = '' }: IconButtonProps) => {
  const baseClasses = "p-2 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-altivum-gold";

  if (href) {
    return (
      <a
        href={href}
        aria-label={label}
        className={`${baseClasses} ${className}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        <span className="material-icons" aria-hidden="true">{icon}</span>
      </a>
    );
  }

  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`${baseClasses} ${className}`}
    >
      <span className="material-icons" aria-hidden="true">{icon}</span>
    </button>
  );
};

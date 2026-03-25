import type { TopologyControlHandle } from './TopologyScene';

interface TopologyControlsProps {
  controlRef: React.MutableRefObject<TopologyControlHandle | null>;
}

export function TopologyControls({ controlRef }: TopologyControlsProps) {
  return (
    <div className="absolute bottom-4 right-4 z-10 flex items-center gap-1 bg-altivum-navy/60 backdrop-blur-sm border border-altivum-slate/20 rounded-full px-2 py-1">
      <button
        type="button"
        aria-label="Rotate left"
        className="w-8 h-8 flex items-center justify-center text-altivum-silver hover:text-altivum-gold transition-colors duration-200 rounded-full hover:bg-altivum-gold/10"
        onClick={() => controlRef.current?.rotateBy(-45)}
      >
        <span className="material-icons" style={{ fontSize: '18px' }}>rotate_left</span>
      </button>
      <button
        type="button"
        aria-label="Reset view"
        className="w-8 h-8 flex items-center justify-center text-altivum-silver hover:text-altivum-gold transition-colors duration-200 rounded-full hover:bg-altivum-gold/10"
        onClick={() => controlRef.current?.reset()}
      >
        <span className="material-icons" style={{ fontSize: '18px' }}>restart_alt</span>
      </button>
      <button
        type="button"
        aria-label="Rotate right"
        className="w-8 h-8 flex items-center justify-center text-altivum-silver hover:text-altivum-gold transition-colors duration-200 rounded-full hover:bg-altivum-gold/10"
        onClick={() => controlRef.current?.rotateBy(45)}
      >
        <span className="material-icons" style={{ fontSize: '18px' }}>rotate_right</span>
      </button>
    </div>
  );
}

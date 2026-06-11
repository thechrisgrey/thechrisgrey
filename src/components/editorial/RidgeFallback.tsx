interface RidgeFallbackProps {
  /** Fades the fallback out once the WebGL ridge is live in the same rect. */
  hidden?: boolean;
}

/**
 * Static gold contour-line horizon. This is the FIRST paint of the hero scene
 * tile and the permanent visual for reduced-motion / no-WebGL / prerender.
 */
const RidgeFallback = ({ hidden = false }: RidgeFallbackProps) => (
  <div
    className={`absolute inset-x-0 bottom-0 h-[62%] transition-opacity duration-700 ${
      hidden ? 'opacity-0' : 'opacity-100'
    }`}
  >
    <svg
      viewBox="0 0 500 200"
      preserveAspectRatio="none"
      className="h-full w-full"
      aria-hidden="true"
    >
      <g fill="none" stroke="#C5A572" strokeWidth="0.7">
        <path d="M0,160 Q80,90 150,125 T290,80 T420,115 T500,60" opacity="0.9" />
        <path d="M0,172 Q90,110 160,140 T300,100 T430,130 T500,82" opacity="0.6" />
        <path d="M0,184 Q100,130 170,155 T310,120 T440,145 T500,104" opacity="0.4" />
        <path d="M0,196 Q110,152 180,170 T320,142 T450,160 T500,126" opacity="0.22" />
      </g>
      <g fill="none" stroke="#F2EFE9" strokeWidth="0.4" opacity="0.25">
        <path d="M0,166 Q85,100 155,132 T295,90 T425,122 T500,71" />
      </g>
    </svg>
  </div>
);

export default RidgeFallback;

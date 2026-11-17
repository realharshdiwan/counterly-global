import React, { useState } from 'react';
import { Ascii } from 'ascii.rest/react';
import { auroraFjord } from 'ascii.rest/pieces';
import { Receipt } from 'lucide-react';

/**
 * Full-color animated ascii.rest landscape scene ("aurora fjord") anchored
 * behind the Hero band. Paired with a measured dark contrast scrim so bold
 * Hero typography remains legible across every frame and seamlessly transitions
 * into the Light Paper / Dark Counter body below.
 */
export const HeroAsciiRestBackdrop: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none select-none overflow-hidden bg-[#05080f] ${className}`}
    >
      <div className="absolute inset-0">
        <Ascii
          piece={auroraFjord}
          options={{ fps: 15 }}
          label="Animated aurora fjord ASCII landscape"
          className="w-full h-full object-cover opacity-90"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>

      {/* Measured contrast scrim + soft radial vignette for WCAG AA Hero legibility */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 85% 75% at 50% 42%, rgba(5, 8, 15, 0.52) 0%, rgba(5, 8, 15, 0.68) 65%, rgba(5, 8, 15, 0.88) 100%)',
        }}
      />
      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-transparent to-[#05080f]/85" />
    </div>
  );
};

interface EditorialStudioPhotoProps {
  src: string;
  alt: string;
  fallbackTitle: string;
  fallbackNote: string;
  className?: string;
  imgClassName?: string;
  photoOverlay?: React.ReactNode;
}

export const EditorialStudioPhoto: React.FC<EditorialStudioPhotoProps> = ({
  src,
  alt,
  fallbackTitle,
  fallbackNote,
  className = '',
  imgClassName = 'w-full h-full object-cover',
  photoOverlay,
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {imgFailed ? (
        <div className="w-full h-full min-h-[240px] bg-gradient-to-br from-zinc-200 via-zinc-100 to-zinc-200 dark:from-zinc-900 dark:via-zinc-800 dark:to-zinc-900 flex flex-col items-center justify-center p-8 text-center">
          <Receipt className="w-7 h-7 text-zinc-500 dark:text-zinc-400 mb-2" />
          <p className="font-editorial text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {fallbackTitle}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-xs">{fallbackNote}</p>
        </div>
      ) : (
        <>
          <img
            src={src}
            alt={alt}
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className={imgClassName}
          />
          {photoOverlay}
        </>
      )}
    </div>
  );
};

'use client';

import React, { useRef, useState, useCallback } from 'react';

interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
  maxTilt?: number; // max tilt angle in degrees, default 6
  scale?: number; // scale on hover, default 1.02
  glare?: boolean; // subtle light sheen on hover
  disabled?: boolean; // explicitly disable tilt
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export function TiltCard({
  children,
  className = '',
  maxTilt = 6,
  scale = 1.02,
  glare = true,
  disabled = false,
  onClick,
}: TiltCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [transformStyle, setTransformStyle] = useState<string>(
    'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)'
  );
  const [glarePosition, setGlarePosition] = useState<{ x: number; y: number; opacity: number }>({
    x: 50,
    y: 50,
    opacity: 0,
  });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (disabled || !cardRef.current) return;
      // Skip 3D tilt calculations on mobile / touch or low-powered screens
      if (typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches) return;
      if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      const rect = cardRef.current.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const rotateX = ((mouseY / height) - 0.5) * -2 * maxTilt;
      const rotateY = ((mouseX / width) - 0.5) * 2 * maxTilt;

      setTransformStyle(
        `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(${scale}, ${scale}, ${scale})`
      );

      if (glare) {
        setGlarePosition({
          x: (mouseX / width) * 100,
          y: (mouseY / height) * 100,
          opacity: 0.15,
        });
      }
    },
    [disabled, maxTilt, scale, glare]
  );

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    setTransformStyle('perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)');
    setGlarePosition((prev) => ({ ...prev, opacity: 0 }));
  }, []);

  return (
    <div
      ref={cardRef}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative transition-transform duration-200 ease-out preserve-3d cursor-pointer ${className}`}
      style={{
        transform: transformStyle,
        willChange: isHovered ? 'transform' : 'auto',
      }}
    >
      {children}
      {glare && !disabled && (
        <div
          className="pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity duration-300"
          style={{
            background: `radial-gradient(circle at ${glarePosition.x}% ${glarePosition.y}%, rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0) 70%)`,
            opacity: glarePosition.opacity,
          }}
        />
      )}
    </div>
  );
}

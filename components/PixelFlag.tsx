import React from 'react';
import Svg, { Rect } from 'react-native-svg';

/**
 * Checkered flag only — clean Nintendo-style pixel art.
 * Pole + clear checkered pattern.
 */
export function PixelFlag({
  size = 32,
  color1 = '#fff',
  color2 = '#333',
}: {
  size?: number;
  color1?: string;
  color2?: string;
}) {
  const u = size / 32;
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      {/* Pole */}
      <Rect x={10 * u} y={6 * u} width={3 * u} height={22 * u} fill={color2} />
      {/* Checkered flag — clean grid, no pole overlap on flag */}
      <Rect x={13 * u} y={6 * u} width={4 * u} height={4 * u} fill={color1} />
      <Rect x={17 * u} y={6 * u} width={4 * u} height={4 * u} fill={color2} />
      <Rect x={21 * u} y={6 * u} width={4 * u} height={4 * u} fill={color1} />
      <Rect x={13 * u} y={10 * u} width={4 * u} height={4 * u} fill={color2} />
      <Rect x={17 * u} y={10 * u} width={4 * u} height={4 * u} fill={color1} />
      <Rect x={21 * u} y={10 * u} width={4 * u} height={4 * u} fill={color2} />
      <Rect x={13 * u} y={14 * u} width={4 * u} height={4 * u} fill={color1} />
      <Rect x={17 * u} y={14 * u} width={4 * u} height={4 * u} fill={color2} />
      <Rect x={21 * u} y={14 * u} width={4 * u} height={4 * u} fill={color1} />
      <Rect x={13 * u} y={18 * u} width={4 * u} height={4 * u} fill={color2} />
      <Rect x={17 * u} y={18 * u} width={4 * u} height={4 * u} fill={color1} />
      <Rect x={21 * u} y={18 * u} width={4 * u} height={4 * u} fill={color2} />
    </Svg>
  );
}

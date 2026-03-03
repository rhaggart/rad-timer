import React from 'react';
import Svg, { Rect, Circle } from 'react-native-svg';

/**
 * Nintendo-style pixel-art cyclist — clearly a rider on a bike.
 * Side view: two wheels, frame, rider (head, body, arms on bars).
 */
export function PixelCyclist({
  size = 32,
  color = '#fff',
}: {
  size?: number;
  color?: string;
}) {
  const u = size / 32;
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      {/* Back wheel */}
      <Circle cx={8 * u} cy={24 * u} r={4 * u} fill={color} />
      {/* Front wheel */}
      <Circle cx={24 * u} cy={24 * u} r={4 * u} fill={color} />
      {/* Bike frame: down tube, top tube, seat stay, chain stay */}
      <Rect x={10 * u} y={20 * u} width={14 * u} height={2 * u} fill={color} />
      <Rect x={12 * u} y={14 * u} width={12 * u} height={2 * u} fill={color} />
      <Rect x={12 * u} y={14 * u} width={2 * u} height={8 * u} fill={color} />
      <Rect x={22 * u} y={14 * u} width={2 * u} height={10 * u} fill={color} />
      {/* Seat */}
      <Rect x={12 * u} y={12 * u} width={4 * u} height={2 * u} fill={color} />
      {/* Handlebar */}
      <Rect x={20 * u} y={14 * u} width={6 * u} height={2 * u} fill={color} />
      <Rect x={24 * u} y={10 * u} width={2 * u} height={6 * u} fill={color} />
      {/* Rider: head */}
      <Circle cx={18 * u} cy={8 * u} r={3 * u} fill={color} />
      {/* Torso */}
      <Rect x={16 * u} y={10 * u} width={4 * u} height={6 * u} fill={color} />
      <Rect x={14 * u} y={12 * u} width={4 * u} height={4 * u} fill={color} />
      {/* Arms to handlebars */}
      <Rect x={18 * u} y={12 * u} width={6 * u} height={2 * u} fill={color} />
      {/* Legs / pedals area */}
      <Rect x={14 * u} y={20 * u} width={2 * u} height={4 * u} fill={color} />
      <Rect x={20 * u} y={20 * u} width={2 * u} height={4 * u} fill={color} />
    </Svg>
  );
}

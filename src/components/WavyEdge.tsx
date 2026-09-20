// src/components/WavyEdge.tsx
//
// The soft wavy top edge on the design's stacked cards. It's a strip of SVG the
// same colour as the card's top, placed just above the card body so the card
// looks as if its upper edge ripples. `flip` changes which way the wave starts,
// so neighbouring cards don't ripple identically.

import Svg, { Path } from "react-native-svg";

type Props = { color: string; height?: number; flip?: boolean };

const WIDTH = 400;

export function WavyEdge({ color, height = 26, flip = false }: Props) {
  const h = height;
  // Two gentle humps across the width, then straight down to close the shape.
  const d = flip
    ? `M0 ${h} L0 ${h * 0.55} C ${WIDTH * 0.18} ${h * 1.1}, ${WIDTH * 0.32} ${h * 0.1}, ${WIDTH * 0.5} ${h * 0.5} C ${WIDTH * 0.68} ${h * 0.9}, ${WIDTH * 0.82} ${h * 0.1}, ${WIDTH} ${h * 0.45} L${WIDTH} ${h} Z`
    : `M0 ${h} L0 ${h * 0.45} C ${WIDTH * 0.18} ${-h * 0.1}, ${WIDTH * 0.32} ${h * 0.9}, ${WIDTH * 0.5} ${h * 0.5} C ${WIDTH * 0.68} ${h * 0.1}, ${WIDTH * 0.82} ${h * 0.9}, ${WIDTH} ${h * 0.55} L${WIDTH} ${h} Z`;

  return (
    <Svg
      width="100%"
      height={h}
      viewBox={`0 0 ${WIDTH} ${h}`}
      preserveAspectRatio="none"
      pointerEvents="none"
    >
      <Path d={d} fill={color} />
    </Svg>
  );
}

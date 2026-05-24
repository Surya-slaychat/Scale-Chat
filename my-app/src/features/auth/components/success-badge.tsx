import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

/**
 * Success badge — Figma "Account Setup Complete page" (Group 168).
 *
 * Per the design spec the badge is:
 *   - **Star 3**: a 134.2×134.2 purple `#4552E4` rounded-square (radius 12.12)
 *     — despite the layer name, it's NOT a star, just a chunky tilted card.
 *   - **Vector 40**: a thick white check stroke 60.6×33 with 11.26px stroke,
 *     rotated -10.28° around its centre.
 *   - **9 confetti ellipses** scattered around the badge in `#4552E4`, sized
 *     between 3.38px and 12.86px.
 *
 * Everything is positioned absolutely against a 220×210 container so the badge
 * can be dropped into any parent that gives it that bounding box.
 */

const BOX = { w: 220, h: 210 };
const STAR_SIZE = 134.2;
const STAR_RADIUS = 12.12;
const BADGE_COLOR = '#4552E4';

// Confetti dots — Figma offsets are from the parent group centre. We project
// them onto our 220×210 box using its centre as the origin too.
const CENTER = { x: BOX.w / 2, y: BOX.h / 2 };
const CONFETTI: Array<{ size: number; dx: number; dy: number }> = [
  { size: 12.86, dx: 96.88, dy: -36.94 },
  { size: 7.72, dx: 62.15, dy: -115.41 },
  { size: 7.72, dx: 69.86, dy: 14.51 },
  { size: 3.86, dx: 78.22, dy: -72.32 },
  { size: 6.76, dx: -96.41, dy: -18.88 },
  { size: 6.76, dx: -80.63, dy: -97.76 },
  { size: 3.38, dx: -45.13, dy: -125.37 },
  { size: 3.38, dx: -59.51, dy: 20.09 },
  { size: 9.52, dx: -75.48, dy: -53.04 },
];

export function SuccessBadge({ scale = 1 }: { scale?: number }) {
  return (
    <View
      style={[
        styles.box,
        { width: BOX.w * scale, height: BOX.h * scale, transform: [{ scale }] },
      ]}>
      {/*
        We anchor BOX.center to the star's centre. The Figma confetti coords
        are given relative to the *group* centre, which sits 43.51px BELOW the
        star centre (Star 3's `top: calc(50% - 134.2/2 - 43.51px)`). So to
        place each dot we shift by +43.51 on the Y axis.
      */}
      {CONFETTI.map((c, i) => (
        <View
          key={`dot-${i}`}
          style={[
            styles.dot,
            {
              width: c.size,
              height: c.size,
              borderRadius: c.size / 2,
              left: CENTER.x + c.dx - c.size / 2,
              top: CENTER.y + c.dy + 43.51 - c.size / 2,
            },
          ]}
        />
      ))}

      {/* Purple rounded-square badge — centred on BOX */}
      <View
        style={[
          styles.star,
          {
            width: STAR_SIZE,
            height: STAR_SIZE,
            borderRadius: STAR_RADIUS,
            left: CENTER.x - STAR_SIZE / 2,
            top: CENTER.y - STAR_SIZE / 2,
          },
        ]}>
        {/* Thick white check stroke, rotated -10.28° */}
        <Svg width={STAR_SIZE} height={STAR_SIZE} viewBox="0 0 134 134">
          <Path
            d="M40 70 L60 90 L96 50"
            stroke="#FFFFFF"
            strokeWidth={11.26}
            strokeLinecap="square"
            strokeLinejoin="miter"
            fill="none"
            transform="rotate(-10.28 67 67)"
          />
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    position: 'relative',
  },
  star: {
    position: 'absolute',
    backgroundColor: BADGE_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    backgroundColor: BADGE_COLOR,
  },
});

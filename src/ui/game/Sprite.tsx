/**
 * <Sprite> — draws one frame of a horizontal sprite sheet and (optionally) scrolls
 * through its frames with a pure-CSS steps() animation. Pixel art is rendered
 * crisp (`image-rendering: pixelated`). The outer box reserves the scaled size so
 * sprites lay out normally; `flip` mirrors it to face the other way.
 */
import type { Sprite as SpriteMeta } from '@ui/game/art';

export function Sprite({
  sprite,
  scale = 1,
  animate = true,
  flip = false,
  title,
}: {
  sprite: SpriteMeta;
  scale?: number;
  animate?: boolean;
  flip?: boolean;
  title?: string;
}) {
  const w = sprite.frameW * scale;
  const h = sprite.frameH * scale;
  return (
    <div
      title={title}
      style={{
        width: w,
        height: h,
        overflow: 'hidden',
        transform: flip ? 'scaleX(-1)' : undefined,
      }}
    >
      <div
        style={{
          width: sprite.frameW,
          height: sprite.frameH,
          backgroundImage: `url("${sprite.url}")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: '0 0',
          imageRendering: 'pixelated',
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          animation:
            animate && sprite.frames > 1
              ? `${sprite.anim} ${sprite.durationMs}ms steps(${sprite.frames}) infinite`
              : 'none',
        }}
      />
    </div>
  );
}

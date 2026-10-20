import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

const DURATION = { slide: 800, fade: 900, flip: 700 };

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Inline styles for one layer in a given state.
 * state: 'active' (showing) | 'exit' (just left) | 'idle' (waiting off-stage)
 * dir: 1 = forward, -1 = backward
 */
function layerStyle(animation, state, dir, reduced) {
  if (reduced) return { opacity: state === 'active' ? 1 : 0, transition: 'none' };
  const ms = DURATION[animation] ?? 800;
  if (animation === 'slide') {
    const x = state === 'active' ? 0 : state === 'exit' ? -100 * dir : 100 * dir;
    return {
      transform: `translate3d(${x}%,0,0)`,
      transition: state === 'idle' ? 'none' : `transform ${ms}ms cubic-bezier(.65,0,.35,1)`,
      opacity: state === 'idle' ? 0 : 1,
    };
  }
  if (animation === 'flip') {
    const half = Math.round(ms / 2);
    if (state === 'active') {
      return { transform: 'rotateY(0deg)', opacity: 1, transition: `transform ${half}ms ease-out ${half}ms, opacity 1ms linear ${half}ms`, backfaceVisibility: 'hidden' };
    }
    if (state === 'exit') {
      return { transform: `rotateY(${90 * dir}deg)`, opacity: 0, transition: `transform ${half}ms ease-in, opacity 1ms linear ${half}ms`, backfaceVisibility: 'hidden' };
    }
    return { transform: `rotateY(${-90 * dir}deg)`, opacity: 0, transition: 'none', backfaceVisibility: 'hidden' };
  }
  // fade
  return { opacity: state === 'active' ? 1 : 0, transition: state === 'idle' ? 'none' : `opacity ${ms}ms ease-in-out` };
}

/**
 * Homepage hero with admin-managed slides and a selectable animation
 * (slide, fade or flip). `children` (e.g. the search box) stays fixed while
 * the background and text animate.
 */
export function HeroCarousel({ slides, animation = 'fade', intervalSeconds = 6, preview = false, children, className }) {
  const count = slides.length;
  const [index, setIndex] = useState(0);
  const [prev, setPrev] = useState(null);
  const [dir, setDir] = useState(1);
  const [hovering, setHovering] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const paused = hovering || userPaused;
  const [reduced] = useState(prefersReducedMotion);
  const frame = useRef(0);

  // Keep the index valid when slides are added/removed (admin preview).
  useEffect(() => {
    if (index >= count) {
      setIndex(0);
      setPrev(null);
    }
  }, [count, index]);

  const go = useCallback(
    (target, direction) => {
      if (count < 2) return;
      const next = ((target % count) + count) % count;
      if (next === index) return;
      setDir(direction);
      // Let off-stage slides move to the entry side before animating in.
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        frame.current = requestAnimationFrame(() => {
          setPrev(index);
          setIndex(next);
        });
      });
    },
    [count, index],
  );

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  useEffect(() => {
    if (count < 2 || paused || reduced) return undefined;
    const timer = setTimeout(() => go(index + 1, 1), Math.max(intervalSeconds, 3) * 1000);
    return () => clearTimeout(timer);
  }, [count, paused, reduced, intervalSeconds, index, go]);

  const stateOf = (i) => (i === index ? 'active' : i === prev ? 'exit' : 'idle');
  const perspective = animation === 'flip' ? { perspective: '1600px' } : undefined;
  const current = slides[Math.min(index, count - 1)] ?? {};

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured highlights"
      className={cn('relative isolate overflow-hidden bg-[#0b3742] text-white', className)}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {/* Background layers */}
      <div className="absolute inset-0 -z-10" style={perspective} aria-hidden="true">
        {slides.map((slide, i) => (
          <div key={slide.id ?? i} className="absolute inset-0 will-change-transform" style={layerStyle(animation, stateOf(i), dir, reduced)}>
            {slide.backgroundImage ? (
              <img src={slide.backgroundImage} alt="" className="size-full object-cover" loading={i === 0 ? 'eager' : 'lazy'} fetchPriority={i === 0 ? 'high' : 'auto'} />
            ) : (
              <div className="hero-pattern size-full" />
            )}
            <div className="absolute inset-0" style={{ background: `linear-gradient(90deg, rgba(5,30,36,${(slide.overlayOpacity ?? 55) / 100 + 0.1}) 0%, rgba(5,30,36,${(slide.overlayOpacity ?? 55) / 100}) 55%, rgba(5,30,36,${Math.max((slide.overlayOpacity ?? 55) / 100 - 0.15, 0)}) 100%)` }} />
          </div>
        ))}
      </div>

      <div className={cn('container-page relative', preview ? 'py-10' : 'py-14 sm:py-20 lg:py-24')}>
        {/* Slide text: stacked in one grid cell so the height fits the tallest slide */}
        <div className="grid" style={perspective}>
          {slides.map((slide, i) => {
            const state = stateOf(i);
            const center = slide.textAlign === 'center';
            return (
              <div
                key={slide.id ?? i}
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${count}`}
                aria-hidden={state !== 'active'}
                className={cn('[grid-area:1/1]', center ? 'mx-auto max-w-3xl text-center' : 'max-w-3xl', state !== 'active' && 'pointer-events-none')}
                style={layerStyle(animation, state, dir, reduced)}
              >
                <h1 className={cn('font-extrabold leading-tight tracking-tight drop-shadow-sm', preview ? 'text-2xl sm:text-3xl' : 'text-3xl sm:text-5xl')}>{slide.title}</h1>
                {slide.subtitle && <p className={cn('mt-4 text-white/85', preview ? 'text-base' : 'text-lg', center && 'mx-auto max-w-2xl')}>{slide.subtitle}</p>}
                {slide.buttonLabel && slide.buttonUrl && (
                  <div className="mt-6">
                    {preview ? (
                      <span className="inline-flex h-11 items-center gap-2 rounded-md bg-accent px-5 font-semibold text-accent-foreground">{slide.buttonLabel} <ArrowRight className="size-4" /></span>
                    ) : /^https?:\/\//i.test(slide.buttonUrl) ? (
                      <a href={slide.buttonUrl} target="_blank" rel="noopener noreferrer" tabIndex={state === 'active' ? 0 : -1} className="inline-flex h-11 items-center gap-2 rounded-md bg-accent px-5 font-semibold text-accent-foreground shadow hover:bg-accent/90">
                        {slide.buttonLabel} <ArrowRight className="size-4" />
                      </a>
                    ) : (
                      <Link to={slide.buttonUrl} tabIndex={state === 'active' ? 0 : -1} className="inline-flex h-11 items-center gap-2 rounded-md bg-accent px-5 font-semibold text-accent-foreground shadow hover:bg-accent/90">
                        {slide.buttonLabel} <ArrowRight className="size-4" />
                      </Link>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {children && <div className="mt-8">{children}</div>}

        {count > 1 && (
          <div className={cn('mt-8 flex items-center gap-3', current.textAlign === 'center' && !children && 'justify-center')}>
            <button type="button" onClick={() => go(index - 1, -1)} aria-label="Previous slide" className="rounded-full bg-white/15 p-2 backdrop-blur transition hover:bg-white/30">
              <ChevronLeft className="size-4" />
            </button>
            <div className="flex gap-2">
              {slides.map((slide, i) => (
                <button
                  key={slide.id ?? i}
                  type="button"
                  onClick={() => go(i, i > index ? 1 : -1)}
                  aria-label={`Go to slide ${i + 1}`}
                  aria-current={i === index}
                  className={cn('h-2 rounded-full transition-all', i === index ? 'w-8 bg-accent' : 'w-2 bg-white/50 hover:bg-white/80')}
                />
              ))}
            </div>
            <button type="button" onClick={() => go(index + 1, 1)} aria-label="Next slide" className="rounded-full bg-white/15 p-2 backdrop-blur transition hover:bg-white/30">
              <ChevronRight className="size-4" />
            </button>
            {!reduced && (
              <button type="button" onClick={() => setUserPaused((p) => !p)} aria-label={userPaused ? 'Play slideshow' : 'Pause slideshow'} className="ml-1 rounded-full bg-white/15 p-2 backdrop-blur transition hover:bg-white/30">
                {userPaused ? <Play className="size-4" /> : <Pause className="size-4" />}
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

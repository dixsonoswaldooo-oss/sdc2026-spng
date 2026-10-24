'use client';
import { useEffect, useRef, type ElementType, type ReactNode } from 'react';

/**
 * Orbyte's scroll reveal (fade + rise, from orbyte.my/js/main.js): adds "reveal", then "in-view" once on screen.
 * The CSS for both classes comes from Orbyte's stylesheet.
 */
export function Reveal({ as: Tag = 'div', className = '', delay = 0, children }: { as?: ElementType; className?: string; delay?: number; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !('IntersectionObserver' in window)) return;
    el.classList.add('reveal');
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => {
        if (entry.isIntersecting) {
          el.classList.add('in-view');
          observer.unobserve(el);
        }
      }),
      { threshold: 0.12, rootMargin: '0px 0px -60px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <Tag ref={ref} className={className} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
      {children}
    </Tag>
  );
}

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export type ScrollDirection = 'up' | 'down' | null;

export function useScrollDirection(element: HTMLElement | null, threshold = 10) {
  const [scrollDirection, setScrollDirection] = useState<ScrollDirection>(null);
  const prevOffset = useRef(0);

  const handleScroll = useCallback(() => {
    if (!element) return;

    const currentOffset = element.scrollTop;
    const isAtTop = currentOffset <= threshold;
    const isAtBottom = currentOffset + element.clientHeight >= element.scrollHeight - threshold;
    
    if (Math.abs(currentOffset - prevOffset.current) < threshold) {
      return;
    }

    const direction = currentOffset > prevOffset.current ? 'down' : 'up';
    
    setScrollDirection(direction);
    prevOffset.current = currentOffset;
  }, [element, threshold]);

  useEffect(() => {
    if (!element) return;

    element.addEventListener('scroll', handleScroll);
    return () => element.removeEventListener('scroll', handleScroll);
  }, [element, handleScroll]);

  return { 
    scrollDirection, 
    isAtTop: element ? element.scrollTop <= threshold : true,
    isAtBottom: element ? element.scrollTop + element.clientHeight >= element.scrollHeight - threshold : false
  };
}

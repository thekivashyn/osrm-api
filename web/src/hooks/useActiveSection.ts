import { type RefObject, useEffect, useState } from "react";

/** Tracks which section id is most visible inside a scroll container. */
export function useActiveSection(sectionIds: string[], scrollRef: RefObject<HTMLElement | null>) {
  const [activeId, setActiveId] = useState<string | null>(sectionIds[0] ?? null);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root || sectionIds.length === 0) {
      setActiveId(null);
      return;
    }

    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el != null);

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const top = visible[0]?.target.id;
        if (top) setActiveId(top);
      },
      {
        root,
        rootMargin: "-8% 0px -52% 0px",
        threshold: [0, 0.15, 0.4, 0.75],
      },
    );

    for (const el of elements) observer.observe(el);
    return () => observer.disconnect();
  }, [sectionIds, scrollRef]);

  return activeId;
}

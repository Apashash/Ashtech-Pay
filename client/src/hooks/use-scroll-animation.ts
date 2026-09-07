import { useEffect } from "react";

export function useScrollAnimation() {
  useEffect(() => {
    const observerCallback: IntersectionObserverCallback = (entries) => {
      entries.forEach((entry) => {
        entry.target.classList.toggle("visible", entry.isIntersecting);
      });
    };

    const observer = new IntersectionObserver(observerCallback, {
      threshold: 0.08,
      rootMargin: "0px 0px -20px 0px",
    });

    const animatedElements = document.querySelectorAll(
      ".animate-on-scroll, .animate-on-scroll-left, .animate-on-scroll-right, .animate-on-scroll-scale"
    );

    animatedElements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);
}

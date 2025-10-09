"use client";
import { useEffect, useState } from "react";

// Theme-aware logo component
export function ThemeLogo() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const checkTheme = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    
    checkTheme();
    
    // Listen for theme changes
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    return () => observer.disconnect();
  }, []);

  return (
    <img
      src={isDark ? "/logoDark.png" : "/logowhite.png"}
      alt="Happy Journey Logo"
      className="w-full h-60 opacity-100 transition-opacity duration-300"
    />
  );
}

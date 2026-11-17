/**
 * Inline script that runs before paint to apply the saved / system theme
 * and avoid a flash of the wrong color scheme.
 */
export function ThemeScript() {
  const code = `(function(){try{var k='theme';var s=localStorage.getItem(k);var d=window.matchMedia('(prefers-color-scheme: dark)').matches;var dark=s==='dark'||(s!=='light'&&d);var r=document.documentElement;r.classList.toggle('dark',dark);r.style.colorScheme=dark?'dark':'light';}catch(e){}})();`;

  return (
    <script
      dangerouslySetInnerHTML={{ __html: code }}
      suppressHydrationWarning
    />
  );
}

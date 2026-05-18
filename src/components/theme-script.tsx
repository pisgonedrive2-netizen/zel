/** İlk boyamadan önce çalışır; FOUC önler. layout içinde <body> hemen altında kullanın. */
export function ThemeScript() {
  const code = `
(function(){
  try {
    var k = 'lanetkel-theme';
    var t = localStorage.getItem(k);
    if (t === 'dark') document.documentElement.classList.add('dark');
    else if (t === 'light') document.documentElement.classList.remove('dark');
    else if (window.matchMedia('(prefers-color-scheme: dark)').matches) document.documentElement.classList.add('dark');
  } catch(e) {}
})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}

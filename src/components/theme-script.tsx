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
    var p = localStorage.getItem('lanetkel-ui-prefs-v1');
    if (p) {
      var j = JSON.parse(p);
      var loc = (j && j.state && j.state.locale) || (j && j.locale);
      if (loc === 'ru') {
        document.documentElement.lang = 'ru';
        window.__FOX_LOCALE__ = 'ru';
      }
    }
  } catch(e) {}
})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}

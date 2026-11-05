export const THEME_KEY = "cali-task:theme";

/** Inline script run before paint so the saved theme never flashes. */
export const themeBootScript = `(function(){try{var p=localStorage.getItem('${THEME_KEY}')||'system';var d=p==='dark'||(p==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;if(d)r.classList.add('dark');r.dataset.theme=d?'dark':'light';}catch(e){}})();`;

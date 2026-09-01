// Draait de zelftest uit index.html (#test) headless in node, met een minimale DOM-stub.
// In de browser: open index.html#test
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const js = html.match(/<script>([\s\S]*)<\/script>/)[1];
const el = () => ({ textContent:'', className:'', innerHTML:'', hidden:false, style:{},
  append(){}, setAttribute(){}, classList:{ add(){}, remove(){} } });
const store = {};
const g = {
  document: { querySelector: el, querySelectorAll: () => [], createElement: el, body: el() },
  localStorage: { getItem: k => store[k] ?? null, setItem: (k,v) => store[k] = v, removeItem: k => delete store[k] },
  location: { hash: '#test' }, navigator: {}, addEventListener(){}, confirm: () => false,
};
g.window = g;
try {
  new Function('window','document','localStorage','location','navigator','addEventListener','confirm',
               'SpeechRecognition','webkitSpeechRecognition', js)
    (g, g.document, g.localStorage, g.location, g.navigator, g.addEventListener, g.confirm, undefined, undefined);
  console.log('✅ Alle tests OK');
} catch (e) {
  console.error('❌ ' + e.message);
  process.exit(1);
}

// Runs on https://suf.purs.gov.rs/v/* — adds a floating "Add to Calendar" button.
// Styles live in content.css.

(function () {
  if (document.getElementById('fiskalnik-btn')) return;

  const LABEL = 'Додај у календар';

  const btn = document.createElement('button');
  btn.id = 'fiskalnik-btn';
  btn.type = 'button';

  const icon = document.createElement('img');
  icon.src = chrome.runtime.getURL('icons/icon48.png');
  icon.alt = '';
  const label = document.createElement('span');
  label.textContent = LABEL;
  btn.append(icon, label);

  let resetTimer = null;
  function setState(state, text, title = '') {
    btn.classList.remove('done', 'error');
    if (state) btn.classList.add(state);
    label.textContent = text;
    btn.title = title;
    clearTimeout(resetTimer);
    if (state) resetTimer = setTimeout(() => setState('', LABEL), 4000);
  }

  btn.addEventListener('click', () => {
    try {
      const receipt = parseReceiptHtml(document.documentElement.outerHTML, location.href);
      window.open(buildCalendarUrl(receipt), '_blank', 'noopener');
      setState('done', '✓ Отворено у календару');
    } catch (err) {
      setState('error', 'Рачун није прочитан', err.message);
    }
  });

  document.body.appendChild(btn);
})();

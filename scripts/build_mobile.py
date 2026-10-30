"""Собирает автономный справочник из общего шаблона и поискового словаря."""
from pathlib import Path
R = Path(__file__).resolve().parents[1]
def safe_json(path):
    return (R/path).read_text().replace('<', '\\u003c').replace('>', '\\u003e').replace('&', '\\u0026')
script = (R/'scripts/mobile_search.js').read_text()
html = (R/'scripts/mobile_template.html').read_text()
for token, content in [('STYLE', (R/'scripts/mobile_style.css').read_text()), ('PAYLOAD', safe_json('errors.json')), ('VOCABULARY', safe_json('scripts/search_vocabulary.json')), ('SEARCH_SCRIPT', script), ('DOWNLOADS', '<p class="meta">Автономная версия: поиск работает без сети. Для открытия источников потребуется интернет.</p>')]:
    html = html.replace(token, content)
(R/'doctor_guide_mobile.html').write_text(html)
(R/'research/mobile_script.js').write_text(script)
print('Автономный справочник собран.')

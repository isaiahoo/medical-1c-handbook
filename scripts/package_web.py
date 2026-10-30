"""Готовит сайт и архив для российского хостинга."""
from pathlib import Path
import shutil, zipfile
R = Path(__file__).resolve().parents[1]
out = R/'web-site/dist'
out.mkdir(parents=True, exist_ok=True)
s = (R/'doctor_guide_mobile.html').read_text().replace('<p class="meta">Автономная версия: поиск работает без сети. Для открытия источников потребуется интернет.</p>', '<nav class="downloads" aria-label="Скачать справочник"><a href="doctor_guide.pdf">Открыть PDF</a><a href="doctor_guide_mobile.html" download>Скачать для работы без сети</a></nav>')
(out/'index.html').write_text(s)
for name in ('doctor_guide.pdf', 'doctor_guide_mobile.html'):
    shutil.copy2(R/name, out/name)
(out/'robots.txt').write_text('User-agent: *\nDisallow: /\n')
(R/'web-site/search.js').write_text((R/'scripts/mobile_search.js').read_text())
with zipfile.ZipFile(R/'doctor_web_site.zip', 'w', zipfile.ZIP_DEFLATED) as z:
    for f in sorted(out.iterdir()):
        z.write(f, f.name)
print('Сайт и doctor_web_site.zip собраны. Публикация не выполнялась.')

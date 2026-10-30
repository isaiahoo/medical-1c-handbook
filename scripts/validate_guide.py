"""Проверки целостности справочника без доступа к больничным данным."""
from pathlib import Path
import json,csv,re
R=Path(__file__).resolve().parents[1];data=json.loads((R/'errors.json').read_text());rows=data['errors']
ids=[r['id'] for r in rows];assert len(ids)==len(set(ids))
assert ids==[f'{i:03}' for i in range(1,len(rows)+1)]
registry=json.loads((R/'research/source_register.json').read_text());known={s['url'] for s in registry}
assert len(known)==len(registry)
for r in rows:
    assert r['source_urls'] and set(r['source_urls'])<=known
    assert r['local_verification_status']=='В целевой больнице Иванова не проверено'
    assert len(r['physician_instructions']) in (1,2,3)
    assert all(u.startswith('https://') for u in r['source_urls'])
    assert r['cause'] and r['evidence_note'] is not None
with (R/'errors.csv').open(encoding='utf-8-sig',newline='') as f:table=list(csv.DictReader(f,delimiter=';'))
assert len(table)==len(rows)
for a,b in zip(rows,table):
    for k,v in a.items():
        if isinstance(v,list):assert json.loads(b[k])==v
        elif v is None:assert b[k]==''
        else:assert b[k]==str(v)
md=(R/'doctor_guide.md').read_text(); anchors=set(re.findall(r'<a id="([^"]+)"',md))
for target in re.findall(r'\]\(#([^)]*)\)',md):assert target in anchors,target
assert set(re.findall(r'### № (\d{3}) —',md))==set(ids)
for file in ['doctor_quick_reference.md','unresolved.md']:
    for id in re.findall(r'error-(\d{3})', (R/file).read_text()):assert id in ids
html=(R/'doctor_guide_mobile.html').read_text();embedded=re.search(r'<script type="application/json" id="data">(.*?)</script>',html,re.S).group(1)
assert json.loads(embedded)==data
script=re.findall(r'<script>(.*?)</script>',html,re.S)[0]
(R/'research/mobile_script.js').write_text(script)
core=[]
for r in rows:
    t=' '.join([r['workflow'],r['cause'],*r['physician_instructions'],r['escalation_instructions']]);core.append(len(t.split()))
report=f'''# Проверка качества рабочей версии

Проверка: 30 октября 2026 года.

- {len(rows)} уникальных стабильных идентификатора, без пропусков и повторений.
- JSON и CSV совпадают по всем заполненным полям; массивы и пустые значения проверены.
- Все карточки основного Markdown присутствуют в JSON; все внутренние ссылки оглавления разрешаются.
- Все ссылки карточек включены в реестр источников. Источники открывались во время исследования; отдельный повторный сетевой обход всех URL не проводился.
- Данные встроенного мобильного HTML совпадают с JSON.
- Основной текст карточек занимает {min(core)}–{max(core)} слов без источников и поисковых фраз. Это контроль компактности, не оценка медицинской применимости.
- Прочитанные ответы, описания релизов, сообщения пользователей и заголовки недоступных FAQ разделены. Необоснованные исправления по заголовкам не добавлялись.
- Номера дефектов 2992, 00-00008863 и 00-00009439 отделены от кодов ошибок. Код 04x0001 относится к внешнему сервису; коды отказов РЭМД привязаны к документации 1C-MR и МедФлекс; коды правил и числовые статусы выделены отдельно. Номер СЭМД не используется как код ошибки.
- У всех карточек явно указано отсутствие локальной проверки. Региональные инструкции 1C-MR отделены от стандартной конфигурации.
- Найденные источники с ограничениями доступа не считались прочитанными статьями. Частные ответы поддержки не реконструировались.
- Не предложены изменения конфигурации, прав, системных файлов, отключение безопасности, удаление медицинских записей, вымышленные диагнозы или повторные последствия без проверки состояния.

## Ограничения проверки

Это редакционная и структурная проверка, не испытание в МИС. Визуальная проверка текущей сборки описана в research/codes-v5/visual_review.md. Открытие предыдущей опубликованной версии на телефоне подтверждено пользователем; это не подтверждает проверку текущей версии в больнице. Кириллица исходных файлов проверена как UTF-8. Проверка PDF приведена отдельно; DOCX не выпускался из-за отсутствия доступного механизма рендеринга Word. Скриншоты и данные пациентов не требовались.
'''
pdf_check=R/'research/pdf_review/verification.json'
if pdf_check.exists():
    import hashlib
    check=json.loads(pdf_check.read_text())
    assert check['исходный_json_sha256']==hashlib.sha256((R/'errors.json').read_bytes()).hexdigest(), 'PDF нужно пересобрать после изменения JSON'
    report+='\n## Проверка PDF\n\n'+ '\n'.join('- '+k+': '+str(v)+'.' for k,v in check.items() if 'sha256' not in k)+'\n'
(R/'research/quality_report.md').write_text(report)
print('Структура, выгрузки, ссылки оглавления и встроенные данные: проверка пройдена.')

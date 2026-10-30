# Сборка и проверки

Для сайта нужны Python 3 и Node.js. Внешних пакетов нет. Все команды выполняются из корня проекта.

```sh
python3 scripts/build_mobile.py
python3 scripts/package_web.py
node scripts/check_web.cjs
node scripts/check_feedback.cjs
node scripts/check_motion.cjs
python3 scripts/validate_guide.py
```

Откройте `doctor_guide_mobile.html` в браузере либо запустите локальный просмотр:

```sh
python3 -m http.server 8000 --directory web-site/dist
```

Адрес: http://localhost:8000/. Сборка сайта появляется в `web-site/dist`; архив для хостинга — `doctor_web_site.zip`. Поиск работает на устройстве. Источники и Яндекс Форма требуют интернета.

## Где менять

- `errors.json` — опубликованные карточки; структура описана в `knowledge_base_schema.md`.
- `scripts/mobile_search.js` — поиск и взаимодействия.
- `scripts/mobile_template.html`, `scripts/mobile_style.css` — интерфейс.
- `scripts/search_vocabulary.json` — словарь поиска.
- `research/` — доказательства, ограничения исследования и отчёты проверок.

Для полного пересоздания Markdown и CSV служит `scripts/build_guide.py`. Он собирает исходные записи из своего кода и наборов в `research/continuation_cards.json`, `research/codes-v4/cards.json`, `research/codes-v5/cards.json`. Если редактировать только итоговый JSON, повторный запуск этого скрипта перезапишет изменения: сначала обновите соответствующий исходный набор.

Готовый PDF включён в проект. Его пересборка требует macOS и Swift:

```sh
swift -module-cache-path /private/tmp/medical-swift-cache scripts/build_pdf.swift
swift -module-cache-path /private/tmp/medical-swift-cache scripts/validate_pdf.swift
```

После пересборки PDF нужна визуальная проверка страниц. Проверочные изображения сохраняются локально и не входят в публичную версию.

## Публикация

Этот репозиторий хранит исходники и демонстрацию. Рабочий сайт https://med1c.tw1.ru/ размещён на Timeweb; его публикация управляется отдельно. Изменение этого репозитория само по себе не обновляет сайт.

Папка `docs/media` содержит авторский ролик без звука и кадр-превью. Полная запись: 42,37 секунды, 1756 × 1080, 60 кадров/с. Видео показывает пример работы, а не подтверждение применимости карточек к конкретной больнице.

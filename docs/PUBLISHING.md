# Публикация: чек-лист

Дополняет [RELEASE.md](RELEASE.md) — там описан процесс версионирования,
здесь то, что нужно сделать один раз перед первым релизом, и порядок
действий при выкладке.

---

## 0. Разовая подготовка (до первой публикации)

### npm

1. **Занять scope `@smeditor`.** Организация или пользовательский scope должны
   существовать до первого `publish`:
   ```bash
   npm login
   npm org create smeditor        # либо scope пользователя
   npm access ls-packages @smeditor
   ```
2. **Создать Automation-токен** (Settings → Access Tokens → Granular /
   Automation) с правом publish на scope и положить его в секрет репозитория
   `NPM_TOKEN`. Обычный Publish-токен с включённым 2FA в CI не сработает.
3. Проверить, что имена не заняты: `npm view @smeditor/core` должен вернуть 404.

### RubyGems

1. Проверить, что имя свободно: `gem list -r smeditor` — пусто.
2. **Создать API-ключ** на https://rubygems.org/settings/edit с scope
   `push_rubygem` и **включённым MFA** — в gemspec стоит
   `rubygems_mfa_required = "true"`, ключ без MFA будет отклонён при push.
   Положить в секрет `RUBYGEMS_API_KEY`.
3. Альтернатива без секретов — Trusted Publishing (OIDC). В workflow уже есть
   `id-token: write`; тогда вместо `GEM_HOST_API_KEY` подключается
   `rubygems/configure-rubygems-credentials@v1`, а на RubyGems заводится
   trusted publisher для `sCruze/smeditor`.

### Проверить в gemspec

`spec.email` заполнен адресом-заглушкой
`sCruze@users.noreply.github.com` — **замените на реальный** до первого
`gem push`, он будет виден на странице гема.

---

## 1. Локальная проверка перед релизом

```bash
pnpm install
pnpm check:lockfile     # должно быть чисто до --frozen-lockfile в CI
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

Проверить, что попадёт в тарболл (без реальной публикации):

```bash
pnpm --filter @smeditor/core exec npm pack --dry-run
pnpm --filter @smeditor/react exec npm pack --dry-run
```

В списке должны быть `dist/`, `src/`, `README.md`, `LICENSE`, `package.json`.

---

## 2. Публикация npm-пакетов

```bash
pnpm changeset            # описать изменения, выбрать пакеты и bump
pnpm version-packages     # проставить версии и сгенерировать CHANGELOG
git add -A && git commit -m "chore: version packages"
pnpm release:dry-run      # обязательный прогон без публикации
```

Дальше — либо workflow `Release` (`workflow_dispatch`, галка `publish`), либо
локально:

```bash
pnpm release              # changeset publish
```

**Важно:** публиковать только через `pnpm`. Внутренние зависимости записаны
как `workspace:*`; `pnpm publish` подменяет их на конкретные версии, `npm
publish` — нет, и в реестр уйдёт неустановимый пакет.

### Provenance (опционально)

Теперь, когда в каждом `package.json` есть `repository`, можно включить
подпись происхождения. В workflow `Release` в шаге публикации:

```yaml
run: pnpm release -- --provenance
```

Локально `--provenance` не работает — только в CI с `id-token: write`.

---

## 3. Публикация гема

```bash
pnpm version:status              # свести версии в одном месте
pnpm version:gem patch           # или minor / major / явная 1.2.0
```

Дописать раздел в `gems/smeditor/CHANGELOG.md`, затем:

```bash
pnpm release:gem:dry-run         # bundle install + rspec + gem build, без push
pnpm release:gem                 # push на RubyGems
git tag smeditor-v$(ruby -r ./gems/smeditor/lib/smeditor/rails/version -e 'print SMEditor::Rails::VERSION')
```

Либо workflow `Release gem` с галкой `publish`.

Проверить содержимое гема до push:

```bash
cd gems/smeditor
gem build smeditor.gemspec
gem contents --spec-file smeditor-*.gemspec 2>/dev/null || tar -tf smeditor-*.gem
```

`PLAN.md` в списке быть не должно; `LICENSE` и `CHANGELOG.md` — должны.

---

## 4. Порядок релиза

Гем зависит от npm-пакетов (boot-скрипт импортирует `@smeditor/react` и kit'ы),
поэтому:

1. Сначала npm-пакеты.
2. Убедиться, что `npm install @smeditor/react @smeditor/starter-kit
   @smeditor/full-kit @smeditor/theme-default` ставится в чистом проекте.
3. Затем гем.

---

## 5. Что осталось незакрытым

- **12 пакетов запускают `vitest run` без `vitest` в devDependencies**
  (`collab`, `export-docx`, `export-pdf`, `extension-details`,
  `extension-embed`, `extension-emoji`, `extension-find-replace`,
  `extension-link`, `extension-list-item`, `extension-track-changes`,
  `extension-typography`, `extension-word-count`). Сейчас работает за счёт
  корневого `node_modules/.bin` в pnpm, но это хрупко. Починка требует
  `pnpm install` и коммита обновлённого `pnpm-lock.yaml` — поэтому не сделана
  в этой итерации, чтобы не сломать `--frozen-lockfile`.
- `@smeditor/extension-table` экспортирует `__test` из публичного API. Тест
  импортирует его из `../src`, так что символ можно убрать из `src/index.ts`
  и перенести во внутренний модуль.
- Внутренние зависимости `starter-kit` / `full-kit` жёстко фиксируются
  (`workspace:*` → точная версия). Changesets поднимает их патчем
  автоматически, но при ручной публикации отдельного расширения не забывайте
  перевыпускать киты.

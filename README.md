<p align="center">
  <img src="https://raw.githubusercontent.com/bitwarden/brand/main/icons/icon_128x128.png" width="128" height="128" alt="Bitwarden Fork Logo" />
</p>

<h1 align="center">✨ Bitwarden Desktop Fork ✨</h1>
<h3 align="center">🔮 Кастомный карточный интерфейс, умный Autotype, круговой TOTP и полная синхронизация 🪄</h3>

<p align="center">
  <b>Улучшенная версия официального клиента Bitwarden Desktop с современным карточным интерфейсом, эргономичными селекторами, поддержкой Passkeys и разблокированным автонабором</b><br>
  <i>Enhanced Bitwarden Desktop fork featuring modern card layout, ergonomic selectors, smart Autotype, circular TOTP countdown, and upstream sync</i>
</p>

<p align="center">
  <a href="https://github.com/KoksMen/Bitwarden-Clients/releases"><img src="https://img.shields.io/badge/Version-v2026.10.0-2563eb?style=for-the-badge&logo=github&logoColor=white" alt="Bitwarden Fork v2026.10.0" /></a>
  <img src="https://img.shields.io/badge/Electron-43.5-47848F?style=for-the-badge&logo=electron&logoColor=white" alt="Electron 43.5" />
  <img src="https://img.shields.io/badge/Platform-Windows%2010%20%7C%2011%20(x64)-0078D6?style=for-the-badge&logo=windows&logoColor=white" alt="Windows 10/11" />
  <a href="https://github.com/bitwarden/clients"><img src="https://img.shields.io/badge/Upstream-Synced%20(550+%20commits)-175DDC?style=for-the-badge&logo=bitwarden&logoColor=white" alt="Upstream Synced" /></a>
  <a href="LICENSE.txt"><img src="https://img.shields.io/badge/License-GPL--3.0-orange?style=for-the-badge" alt="License GPL-3.0" /></a>
</p>

<p align="center">
  <a href="#-bitwarden-desktop-fork-на-русском"><b>🇷🇺 Перейти к русской версии</b></a> •
  <a href="#-bitwarden-desktop-fork-in-english"><b>🇬🇧 Switch to English Version</b></a>
</p>

<p align="center">
  <a href="https://github.com/KoksMen/Bitwarden-Clients/releases/latest">
    <img src="https://img.shields.io/badge/Download-Portable%20(.exe)-2563eb?style=for-the-badge&logo=windows&logoColor=white" alt="Download Portable" />
  </a>
  <a href="https://github.com/KoksMen/Bitwarden-Clients">
    <img src="https://img.shields.io/badge/GitHub-Repository-181717?style=for-the-badge&logo=github&logoColor=white" alt="GitHub Repo" />
  </a>
</p>

---

# 🇷🇺 Bitwarden Desktop Fork (На русском)

## 💡 О проекте

**Bitwarden Desktop Fork** — это модифицированная и улучшенная сборка настольного приложения Bitwarden для Windows, сочетающая всю мощь официальной платформы безопасности с современным, эргономичным интерфейсом и продвинутыми функциями, которых нет в стандартном клиенте.

Проект полностью синхронизирован со всеми последними наработками апстрима [bitwarden/clients](https://github.com/bitwarden/clients), включая обновления **2026.9.1** и **2026.10.0**, при этом бережно сохраняет и развивает уникальные улучшения форка.

> [!TIP]
> Приложение полностью совместимо со стандартными облачными серверами Bitwarden (`bitwarden.com`, `bitwarden.eu`), а также с независимыми серверами **Vaultwarden**.

---

## 🌟 Ключевые возможности и улучшения форка

### 🗂️ 1. Современный карточный интерфейс (Modern Card UI)

- **Объёмные карточки вместо плоских таблиц:** Вместо монотонной таблицы VFO1 элементы хранилища отображаются в виде стильных независимых карточек с мягкими тенями, скруглениями углов (14px) и визуальным акцентом.
- **Глубокая адаптация тёмной темы:** Улучшенная высококонтрастная палитра для тёмной темы (`#1e293b`), чёткие границы элементов и мягкое синее свечение при наведении и выделении.
- **Акцентная кнопка добавления («+»):** Яркая, увеличенная кнопка быстрого создания записей с улучшенным выпадающим меню.

### 👁️ 2. Умная динамическая видимость открытого элемента (Smart Viewport Tracking)

- **Бесшовный просмотр в списке:** Когда вы открываете элемент, карточка подсвечивается прямо внутри списка как активная (`data-active="true"`).
- **Автоматический баннер `👁 ПРОСМОТР ЭЛЕМЕНТА`:** Если открытый элемент находится в поле видимости, верхний блок автоматически скрывается. Но если вы прокручиваете длинный список и карточка уходит за экран, верхний блок плавно появляется над списком, позволяя всегда контролировать текущую открытую запись.
- **Мгновенный возврат:** При прокрутке обратно к карточке верхний блок снова исчезает.

### 🖱️ 3. Эргономичный и удобный селектор (18px Checkbox)

- **Точное центрирование:** Чекбокс больше не прижимается к верхнему краю строки — он строго выровнен по центру 64px-карточки по горизонтали и вертикали.
- **Широкая зона клика:** Вся 40px колонка чекбокса безопасно переключает выбор без случайного открытия боковой шторки (`stopPropagation`).
- **Сглаженные формы:** Современный размер 18px с радиусом скругления 5px и приятной подсветкой фокуса.

### ⌨️ 4. Разблокированный и умный Автонабор (Autotype MVP)

- **Доступен всем без подписки Premium:** В форке полностью сняты серверные блокировки и ограничения подписки на автонабор. Чекбокс включения доступен в настройках по умолчанию.
- **Умное сопоставление по имени приложения:** Ввод логина и пароля по горячей клавише (`Ctrl+Alt+B`) сопоставляет не только явные URI `apptitle://`, но и имя самого элемента (например, для окна «Steam Login» достаточно записи с названием «Steam»).
- **Аппаратная эмуляция через Win32 API (`SendInput`):** Нативный модуль на Rust отправляет события клавиатуры, неотличимые от физического ввода, что обеспечивает работу с любыми играми, мессенджерами и утилитами Windows.

### ⏱️ 5. Круговой таймер одноразовых паролей (Circular TOTP Countdown)

- **Интуитивная визуализация времени:** В карточках двухфакторной аутентификации вместо безликих цифр отображается плавный анимированный круговой индикатор оставшегося времени действия 30-секундного кода TOTP.

### ↔️ 6. Плавающий ресайзер боковой шторки (Drawer Resizer)

- **Гибкая регулировка ширины:** Правая панель подробного просмотра и редактирования записи оснащена интерактивным разделителем, позволяющим плавно изменять её ширину под любое разрешение монитора.

### 🛡️ 7. Нативная интеграция Windows Hello и Passkeys (FIDO2)

- **Автономная работа без браузерного расширения:** Десктопный клиент регистрируется в системе как полноценный системный провайдер учетных данных Windows WebAuthn.
- Вход по Passkeys в любых браузерах и программах с биометрическим подтверждением через Windows Hello (отпечаток пальца / сканер лица / PIN-код).

### 🚫 8. Защита от автообновления официальными бинарниками

- Встроенный блокировщик предотвращает автоматическую перезапись форка официальными сборками Bitwarden, защищая все ваши кастомные стили и настройки.

---

## 🛡️ Архитектура безопасности (Security Architecture)

- 🔒 **Сквозное нулевое шифрование (Zero-Knowledge E2EE):** Все данные шифруются исключительно на вашем устройстве с использованием алгоритмов **AES-256-CBC**, **PBKDF2-SHA256** или **Argon2id** перед отправкой на сервер.
- 🔑 **Аппаратная защита Windows DPAPI:** Мастер-ключи и биометрические токены шифруются с использованием системного интерфейса Windows Data Protection API (DPAPI).
- ✍️ **Доверенная цифровая подпись Authenticode:** Исполняемые файлы подписаны сертификатом:
  ```text
  Signer: CN=xXKoksMenXx, O=xXTeam, C=RU
  Thumbprint: C6C4A602CD20A275BC0B4E07AC0F73CAC7D414F7
  Timestamp: RFC 3161 SHA-256 (Sectigo Public Time Stamping)
  ```

---

## 🚀 Быстрый запуск

1. Скачайте портативную версию [Bitwarden-Fork-Portable-2026.10.0.exe](https://github.com/KoksMen/Bitwarden-Clients/releases/latest).
2. Запустите файл — установка не требуется, приложение готово к работе!
3. Войдите в свою учетную запись Bitwarden или укажите адрес собственного сервера Vaultwarden.

---

# 🇬🇧 Bitwarden Desktop Fork (In English)

## 💡 About the Project

**Bitwarden Desktop Fork** is an enhanced desktop distribution of Bitwarden for Windows that combines the proven zero-knowledge security architecture of the official client with a modernized card-based UI, ergonomic improvements, and unlocked native capabilities.

The fork is fully synced with upstream [bitwarden/clients](https://github.com/bitwarden/clients) (including **2026.9.1** and **2026.10.0** releases) while retaining custom desktop enhancements.

---

## 🌟 Key Features & Improvements

- 🗂️ **Modern Card Layout:** Vault items render as sleek, rounded (14px) cards with gentle shadows and high contrast, replacing the flat VFO1 table view.
- 👁️ **Smart Viewport Tracking:** Active item banner `👁 VIEW ITEM` dynamically appears only when the opened cipher is scrolled out of the viewport, highlighting the card directly within the list when visible.
- 🖱️ **Ergonomic Selector:** Checkbox cells are flex-centered across the 64px row height, featuring an 18px soft-bordered checkbox and a safe 40px click target to prevent accidental drawer opening.
- ⌨️ **Unlocked & Smart Autotype:** Server feature-flag and premium locks removed; matches windows via explicit `apptitle://` URIs as well as cipher names using native Win32 `SendInput`.
- ⏱️ **Circular TOTP Countdown:** Animated circular progress ring showing the remaining validity time for 2FA TOTP tokens.
- ↔️ **Floating Drawer Resizer:** Freely adjustable sidebar width with smooth dragging support.
- 🛡️ **Native Passkeys & Windows Hello:** System-wide WebAuthn Credential Provider for Windows 10/11 without requiring a browser extension.
- 🚫 **Upstream Update Blocker:** Prevents automatic overwriting of custom fork builds by upstream binaries.
- 📦 **Portable Release:** Standalone Windows x64 binary requiring zero installation.

---

## 📦 Хеш-суммы и цифровая подпись (Checksums)

```text
File: Bitwarden-Fork-Portable-2026.10.0.exe
Size: 119,050,976 bytes (113.54 MB)
SHA256: 39AB4B73DB0EA836BDB12C77879E652F54BF300660B2B5D0056F239527D012FE
Signer: CN=xXKoksMenXx, O=xXTeam, C=RU
Thumbprint: C6C4A602CD20A275BC0B4E07AC0F73CAC7D414F7
TSA: Sectigo RFC 3161 SHA-256 Timestamp
```

---

<p align="center">
  <b>Bitwarden Desktop Fork</b> • Developed with care for convenience, privacy, and speed.
</p>

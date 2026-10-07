/* ==========================================================================
   Undangan Lamaran — Eky & Tata
   ========================================================================== */
(() => {
  'use strict';

  /* ===================== PENGATURAN ===================== */

  // Kode akses di URL (contoh: index.html?code=ulan) → nama sapaan tamu.
  const GUESTS = {
    ulan: 'Mba Ulan',
    fajar: 'Mas Fajar',
  };

  // Detail acara. Kolom yang dibiarkan kosong ('') tidak ditampilkan.
  const EVENT = {
    title: 'Lamaran Eky & Tata',
    date: '2026-10-10', // format TTTT-BB-HH
    startTime: '',      // contoh: '10:00'
    endTime: '',        // contoh: '13:00'
    timeZone: '',       // WIB, WITA, atau WIT — kosongkan untuk memakai jam perangkat tamu
    place: 'Rumah Tata',
    address: '',        // alamat lengkap
    mapsUrl: '',        // tautan Google Maps lokasi acara
  };

  /* ====================================================== */

  const TZ_OFFSET = { WIB: '+07:00', WITA: '+08:00', WIT: '+09:00' };
  const TIME_PATTERN = /^(\d{1,2})[:.](\d{2})$/;
  const motionOK = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const app = document.getElementById('app');
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const pad = (value) => String(value).padStart(2, '0');
  const fromTemplate = (id) => document.getElementById(id).content.cloneNode(true);

  /* ---------- Akses tamu ---------- */
  function findGuest() {
    const code = (new URLSearchParams(window.location.search).get('code') || '').trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(GUESTS, code) ? GUESTS[code] : null;
  }

  /* ---------- Tanggal & waktu ---------- */
  function getSchedule() {
    const [year, month, day] = EVENT.date.split('-').map(Number);
    const offset = TZ_OFFSET[EVENT.timeZone.toUpperCase()] || '';
    const at = (time) => {
      const match = TIME_PATTERN.exec(time.trim());
      if (!match) return null;
      const hours = Number(match[1]);
      const minutes = Number(match[2]);
      return offset
        ? new Date(`${EVENT.date}T${pad(hours)}:${pad(minutes)}:00${offset}`)
        : new Date(year, month - 1, day, hours, minutes);
    };

    const date = new Date(year, month - 1, day);
    const start = at(EVENT.startTime);
    return {
      date,
      start: start || date,
      end: at(EVENT.endTime),
      hasTime: Boolean(start),
      // Setelah hari acara berakhir, hitung mundur diganti ucapan terima kasih.
      dayEnd: offset && start ? new Date(`${EVENT.date}T23:59:59${offset}`) : new Date(year, month - 1, day + 1),
    };
  }

  function buildFields(guest, schedule) {
    const { date } = schedule;
    const format = (options) => new Intl.DateTimeFormat('id-ID', options).format(date);
    const clock = (time) => time.trim().replace(':', '.');

    let timeLabel = '';
    if (schedule.hasTime) {
      const zone = EVENT.timeZone ? ` ${EVENT.timeZone.toUpperCase()}` : '';
      timeLabel = schedule.end
        ? `Pukul ${clock(EVENT.startTime)} – ${clock(EVENT.endTime)}${zone}`
        : `Pukul ${clock(EVENT.startTime)}${zone} – selesai`;
    }

    return {
      guest,
      dateLong: format({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      dateDots: [pad(date.getDate()), pad(date.getMonth() + 1), date.getFullYear()].join(' · '),
      weekday: format({ weekday: 'long' }),
      day: pad(date.getDate()),
      month: format({ month: 'long' }),
      year: String(date.getFullYear()),
      timeLabel,
      place: EVENT.place,
      address: EVENT.address,
      mapsUrl: EVENT.mapsUrl,
    };
  }

  function bindFields(root, fields) {
    $$('[data-requires]', root).forEach((el) => {
      if (!fields[el.dataset.requires]) el.remove();
    });
    $$('[data-field]', root).forEach((el) => {
      el.textContent = fields[el.dataset.field] || '';
    });
  }

  function calendarUrl(schedule) {
    const stamp = (date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const ymd = (date) => `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;

    let dates;
    if (schedule.hasTime) {
      const end = schedule.end || new Date(schedule.start.getTime() + 3 * 60 * 60 * 1000);
      dates = `${stamp(schedule.start)}/${stamp(end)}`;
    } else {
      const nextDay = new Date(schedule.date);
      nextDay.setDate(nextDay.getDate() + 1);
      dates = `${ymd(schedule.date)}/${ymd(nextDay)}`;
    }

    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: EVENT.title,
      dates,
      details: 'Undangan lamaran Eky & Tata.',
      location: [EVENT.place, EVENT.address].filter(Boolean).join(', '),
    });
    return `https://calendar.google.com/calendar/render?${params}`;
  }

  /* ---------- Hitung mundur ---------- */
  function startCountdown(root, schedule) {
    const box = $('.countdown', root);
    if (!box) return;
    const grid = $('.countdown__grid', box);
    const done = $('.countdown__done', box);
    const units = ['days', 'hours', 'minutes', 'seconds'].map((unit) => $(`[data-unit="${unit}"]`, box));
    let timer = 0;

    const render = () => {
      const now = Date.now();
      const remaining = schedule.start.getTime() - now;

      if (remaining <= 0) {
        clearInterval(timer);
        grid.hidden = true;
        done.hidden = false;
        done.textContent = now < schedule.dayEnd.getTime()
          ? `Hari ini hari bahagianya! Sampai jumpa di ${EVENT.place}.`
          : 'Acara telah berlangsung. Terima kasih atas doa dan restunya.';
        return;
      }

      const seconds = Math.floor(remaining / 1000);
      const values = [
        Math.floor(seconds / 86400),
        Math.floor(seconds / 3600) % 24,
        Math.floor(seconds / 60) % 60,
        seconds % 60,
      ];

      values.forEach((value, index) => {
        const el = units[index];
        const text = pad(value);
        if (el.textContent === text) return;
        el.textContent = text;
        if (motionOK) {
          el.classList.remove('is-tick');
          void el.offsetWidth; // mulai ulang animasi
          el.classList.add('is-tick');
        }
      });
    };

    render();
    timer = setInterval(render, 1000);
  }

  /* ---------- Animasi ---------- */
  function setupReveal(root) {
    const items = $$('[data-reveal]:not(.is-visible)', root);
    if (!('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    items.forEach((el) => observer.observe(el));
  }

  function startPetals() {
    if (!motionOK) return;
    const layer = document.createElement('div');
    layer.className = 'petals';
    layer.setAttribute('aria-hidden', 'true');

    const colors = ['#F4CAD5', '#FAE3E9', '#C5DBEE', '#DFECF6', '#F6E3CF'];
    const count = window.innerWidth < 640 ? 10 : 18;
    for (let i = 0; i < count; i += 1) {
      const petal = document.createElement('span');
      const duration = 11 + Math.random() * 10;
      petal.className = 'petal';
      petal.style.cssText = [
        `--x:${(Math.random() * 100).toFixed(2)}%`,
        `--size:${(9 + Math.random() * 9).toFixed(1)}px`,
        `--dur:${duration.toFixed(2)}s`,
        `--delay:${(-Math.random() * duration).toFixed(2)}s`,
        `--drift:${Math.round((Math.random() - 0.5) * 160)}px`,
        `--c:${colors[i % colors.length]}`,
      ].join(';');
      layer.append(petal);
    }
    document.body.append(layer);
  }

  /* ---------- Tampilan ---------- */
  function showDenied() {
    app.replaceChildren(fromTemplate('tpl-denied'));
  }

  function showInvitation(guest) {
    const schedule = getSchedule();
    const fields = buildFields(guest, schedule);
    document.title = `Untuk ${guest} · Undangan Lamaran Eky & Tata`;

    const page = fromTemplate('tpl-invitation');
    const cover = fromTemplate('tpl-cover');
    bindFields(page, fields);
    bindFields(cover, fields);

    const calendarLink = $('[data-link="calendar"]', page);
    if (calendarLink) calendarLink.href = calendarUrl(schedule);
    const mapsLink = $('[data-link="maps"]', page);
    if (mapsLink) mapsLink.href = EVENT.mapsUrl;

    app.replaceChildren(page, cover);
    const main = $('.invitation', app);
    const coverEl = $('.cover', app);

    let opened = false;
    const open = async () => {
      if (opened) return;
      opened = true;

      // 1. Amplop terbuka & surat naik
      coverEl.classList.add('is-opening');
      await wait(motionOK ? 1500 : 0);

      // 2. Sampul memudar, isi undangan tampil
      main.hidden = false;
      window.scrollTo({ top: 0, behavior: 'instant' });
      void main.offsetWidth; // pastikan posisi awal animasi sudah dihitung
      coverEl.classList.add('is-leaving');
      $$('.hero [data-reveal]', main).forEach((el) => el.classList.add('is-visible'));
      setupReveal(main);
      startCountdown(main, schedule);
      startPetals();
      $('#hero-title', main).focus({ preventScroll: true });

      await wait(motionOK ? 1300 : 50);
      coverEl.remove();
    };

    $('[data-action="open"]', coverEl).addEventListener('click', open);
    $('.envelope', coverEl).addEventListener('click', open);
  }

  async function init() {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';

    const guest = findGuest();
    if (guest) showInvitation(guest);
    else showDenied();

    // Tunggu font siap (maks. 2 detik) agar transisi pertama terlihat mulus.
    if (document.fonts && document.fonts.ready) {
      await Promise.race([document.fonts.ready, wait(2000)]);
    }
    await wait(200);
    document.body.classList.remove('is-loading');
    requestAnimationFrame(() => document.body.classList.add('is-ready'));
  }

  init();
})();

/* =========================================================
 *  فۆڕمی ماڕکێتەکان — Markets View
 *  هێنانی کۆدی ماڕکێت لەگەڵ ناوەکان لە سەب بەیس (Supabase) بەسۆڕتی کۆدەکان
 * ========================================================= */

const MarketsView = (() => {
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  let container = null;

  const state = {
    searchResults: [],
    hasSearched: false,
    search: '',
    searching: false,
    sortMode: 'code-asc', // 'code-asc' | 'code-desc' | 'name-asc'
    localMarkets: new Map() // ماڕکێتە نوێکراوەکان یان دەستکاریکراوەکانی ئەم دانیشتنە
  };

  /* ---------------- سۆڕتکردنی ماڕکێتەکان (بەسۆڕتی کۆدەکان) ---------------- */

  function sortMarketsList(list, mode = state.sortMode) {
    const seen = new Set();
    const unique = [];
    for (const m of (list || [])) {
      if (!m) continue;
      const code = String(m.account_code || '').trim();
      if (!code || seen.has(code)) continue;
      seen.add(code);
      unique.push(m);
    }

    return unique.sort((a, b) => {
      const codeAStr = String(a.account_code || '').trim();
      const codeBStr = String(b.account_code || '').trim();

      // وەرگرتنی ژمارەی کۆدەکان بە ژمارەی ئینگلیزی
      const numA = parseInt(UI.toLatinDigits(codeAStr).replace(/\D/g, ''), 10);
      const numB = parseInt(UI.toLatinDigits(codeBStr).replace(/\D/g, ''), 10);

      if (mode === 'code-desc') {
        if (!isNaN(numA) && !isNaN(numB) && numA !== numB) return numB - numA;
        return codeBStr.localeCompare(codeAStr, 'ckb', { numeric: true });
      }

      if (mode === 'name-asc') {
        const nameA = String(a.account_name || '').trim();
        const nameB = String(b.account_name || '').trim();
        return nameA.localeCompare(nameB, 'ckb');
      }

      // بنەڕەت: code-asc (لە کەمەوە بۆ زۆر: 1، 2، 3 ... 10، 11 ...)
      if (!isNaN(numA) && !isNaN(numB) && numA !== numB) return numA - numB;
      return codeAStr.localeCompare(codeBStr, 'ckb', { numeric: true });
    });
  }

  /* ---------------- پشکنینی هاوشێوەیی لەگەڵ گەڕان (بۆ ماڕکێتە لۆکاڵییەکان) ---------------- */

  function matchesQuery(m, query) {
    if (!m || !query) return false;
    const rawSearch = query.trim();
    const cleanSearch = rawSearch.replace(/^[#＃]/, '').trim();
    const cleanLatin = UI.toLatinDigits(cleanSearch);
    const latinDigitsOnly = cleanLatin.replace(/\D/g, '');
    const isPureNumber = latinDigitsOnly.length > 0 && latinDigitsOnly === cleanLatin;

    if (isPureNumber) {
      const mCodeDigits = UI.toLatinDigits(m.account_code || '').replace(/\D/g, '');
      const mCodeStr = String(m.account_code || '').trim();
      if (latinDigitsOnly.length < 8) {
        return mCodeDigits === latinDigitsOnly || mCodeStr === cleanSearch;
      }
      const mPhoneDigits = UI.toLatinDigits(m.phone || '').replace(/\D/g, '');
      return mCodeDigits === latinDigitsOnly || mPhoneDigits.includes(latinDigitsOnly);
    }

    const q = UI.norm(rawSearch);
    return [
      m.account_name,
      m.neighborhood,
      m.phone
    ].some(v => UI.norm(v).includes(q));
  }

  /* ---------------- گەڕانی ئامانجدار لە سەب بەیس (تەنها لە کاتی گەڕاندا دێت) ---------------- */

  async function performSearch(query) {
    const raw = (query || '').trim();
    if (!raw) {
      state.search = '';
      state.hasSearched = false;
      state.searching = false;
      state.searchResults = [];
      updateListDisplay();
      return;
    }

    state.search = raw;
    state.hasSearched = true;
    state.searching = true;
    updateListDisplay();

    try {
      let results = [];
      if (typeof API !== 'undefined' && API.Markets && API.Markets.search) {
        results = await API.Markets.search(raw);
      } else {
        // Fallback ئەگەر پێویست بوو
        const clean = raw.replace(/^[#＃]/, '').trim();
        const latin = UI.toLatinDigits(clean).trim();
        const digits = latin.replace(/\D/g, '');
        const isNum = digits.length > 0 && digits === latin;
        const table = (typeof CONFIG !== 'undefined' && CONFIG.MARKETS_TABLE) || 'market_locaetion';
        const url = (typeof CONFIG !== 'undefined' && CONFIG.RECORDS_URL) || '';
        const key = (typeof CONFIG !== 'undefined' && CONFIG.RECORDS_KEY) || '';

        if (url && key) {
          const path = isNum && digits.length < 8
            ? `/${table}?select=*&account_code=eq.${encodeURIComponent(digits)}`
            : `/${table}?select=*&or=(account_name.ilike.*${encodeURIComponent(clean)}*,neighborhood.ilike.*${encodeURIComponent(clean)}*)&order=account_code.asc&limit=50`;
          const res = await fetch(url + path, {
            headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
          });
          if (res.ok) results = await res.json();
        }
      }

      if (!Array.isArray(results)) results = [];

      // هاوتاکردنی لەگەڵ هەر ماڕکێتێکی دەستکاریکراو یان نوێکراوە لە کۆگای لۆکاڵدا
      if (state.localMarkets.size > 0) {
        for (const [code, m] of state.localMarkets.entries()) {
          const match = matchesQuery(m, raw);
          const existingIdx = results.findIndex(r => String(r.account_code) === String(code));
          if (match) {
            if (existingIdx !== -1) results[existingIdx] = m;
            else results.unshift(m);
          } else if (existingIdx !== -1) {
            results.splice(existingIdx, 1);
          }
        }
      }

      state.searchResults = sortMarketsList(results);
    } catch (err) {
      console.warn('هەڵە لە گەڕانی ماڕکێت:', err);
      state.searchResults = [];
    } finally {
      state.searching = false;
      updateListDisplay();
    }
  }

  function updateListDisplay() {
    if (!container) return;
    const listEl = $('#mkt-page-list-container', container);
    if (!listEl) return;
    listEl.innerHTML = renderPageListHtml(state.searchResults);
    bindPageListActions(listEl);
    const clrBtn = $('#mkt-page-search-clear', container);
    if (clrBtn) clrBtn.style.display = state.search ? 'flex' : 'none';
  }

  /* =========================================================
   *  مۆدالی زیادکردن و دەستکاریکردنی ماڕکێت (Supabase)
   * ========================================================= */

  /* ---------------- وەرگرتنی هەموو زۆنەکان (لە ماڕکێتەکان و سەب بەیس) ---------------- */

  async function getMergedZones() {
    const set = new Set();
    // زۆنەکان لە ماڕکێتە دۆزراوەکان
    (state.searchResults || []).forEach(m => {
      const z = (m.neighborhood || '').trim();
      if (z) set.add(z);
    });
    for (const m of state.localMarkets.values()) {
      const z = (m.neighborhood || '').trim();
      if (z) set.add(z);
    }
    // زۆنەکان لە خشتەی زۆنەکانی سەب بەیس
    try {
      const cached = Store.getListsCache();
      if (cached && cached.zones && cached.zones.length) {
        cached.zones.forEach(z => {
          const name = (z.name || '').trim();
          if (name) set.add(name);
        });
      } else if (typeof API !== 'undefined' && API.Lists && API.Lists.zones) {
        const rows = await API.Lists.zones();
        if (Array.isArray(rows)) {
          rows.forEach(z => {
            const name = (z.name || '').trim();
            if (name) set.add(name);
          });
        }
      }
    } catch (_) {}
    return [...set].sort((a, b) => a.localeCompare(b, 'ckb'));
  }

  /* ---------------- ویندۆی نەخشە بۆ نیشانکردنی ماڕکێت (Map Picker) ---------------- */

  function openMapPickerModal({ initialLat, initialLon, onSelect }) {
    const modalWrap = document.createElement('div');
    modalWrap.className = 'mkt-picker-modal-content';

    const hasInit = Number.isFinite(initialLat) && Number.isFinite(initialLon);
    let currentLat = hasInit ? initialLat : 35.5668;
    let currentLon = hasInit ? initialLon : 45.4161;

    modalWrap.innerHTML = `
      <div class="mkt-picker-map-wrap">
        <div id="mkt-leaflet-picker-map"></div>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px; gap:8px; flex-wrap:wrap;">
        <div style="font-size:0.84rem; color:var(--text); font-weight:700;">
          پۆوتان: <strong id="mkt-picker-coords-text" style="direction:ltr; display:inline-block; font-family:monospace; color:var(--accent);">
            ${hasInit ? `${currentLat.toFixed(6)}, ${currentLon.toFixed(6)}` : 'دیاری نەکراوە'}
          </strong>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" id="mkt-picker-gps-now-btn" style="padding:4px 10px; font-size:0.78rem;">
          📍 شوێنی ئێستام (GPS)
        </button>
      </div>
      <div class="mkt-map-hint-box">
        👆 دەتوانیت <span>نەخشەکە بجوڵێنیت</span> یان پەنجە لەسەر <span>هەر شوێنێک دابنێیت</span> بۆ نیشانکردنی ماڕکێتەکە.
      </div>
    `;

    let map = null;
    let marker = null;

    const { close } = UI.openModal({
      title: '📍 نیشانکردنی ماڕکێت لەسەر نەخشە',
      body: modalWrap,
      wide: true,
      actions: [
        { label: 'پاشگەزبوونەوە', className: 'btn-ghost', onClick: () => close() },
        {
          label: 'هەڵبژاردن',
          className: 'btn-primary',
          onClick: () => {
            if (onSelect) onSelect(currentLat, currentLon);
            close();
          }
        }
      ]
    });

    // دروستکردنی نەخشە لەگەڵ دڵنیابوون لە دەرکەوتنی تەواوی تایلەکان
    setTimeout(() => {
      if (typeof L === 'undefined') return;

      const mapContainer = modalWrap.querySelector('#mkt-leaflet-picker-map');
      if (!mapContainer) return;

      map = L.map(mapContainer, {
        zoomControl: true,
        attributionControl: false
      }).setView([currentLat, currentLon], hasInit ? 16 : 13);

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      }).addTo(map);

      // ئایکۆنی ڕەنگ سوور و سەرنجڕاکێشی نیشانەی ماڕکێت
      const pinIcon = L.divIcon({
        className: 'mkt-custom-map-pin',
        html: `<div style="
          width: 36px;
          height: 36px;
          background: #dc2626;
          border: 3px solid #ffffff;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          box-shadow: 0 4px 12px rgba(0,0,0,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
        "><span style="transform: rotate(45deg); font-size: 16px;">🏪</span></div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 36]
      });

      marker = L.marker([currentLat, currentLon], {
        icon: pinIcon,
        draggable: true
      }).addTo(map);

      const updatePin = (lat, lon, pan = false) => {
        currentLat = parseFloat(lat.toFixed(6));
        currentLon = parseFloat(lon.toFixed(6));
        marker.setLatLng([currentLat, currentLon]);
        if (pan) map.setView([currentLat, currentLon], 16);
        const textEl = modalWrap.querySelector('#mkt-picker-coords-text');
        if (textEl) textEl.textContent = `${currentLat}, ${currentLon}`;
      };

      marker.on('dragend', () => {
        const p = marker.getLatLng();
        updatePin(p.lat, p.lng);
      });

      map.on('click', e => {
        updatePin(e.latlng.lat, e.latlng.lng);
      });

      const gpsBtn = modalWrap.querySelector('#mkt-picker-gps-now-btn');
      const fetchGps = (pan = true) => {
        if (!navigator.geolocation) return;
        if (gpsBtn) {
          gpsBtn.textContent = 'چاوەڕوانبە...';
          gpsBtn.disabled = true;
        }
        navigator.geolocation.getCurrentPosition(
          pos => {
            if (gpsBtn) {
              gpsBtn.textContent = '📍 شوێنی ئێستام (GPS)';
              gpsBtn.disabled = false;
            }
            updatePin(pos.coords.latitude, pos.coords.longitude, pan);
          },
          err => {
            if (gpsBtn) {
              gpsBtn.textContent = '📍 شوێنی ئێستام (GPS)';
              gpsBtn.disabled = false;
            }
          },
          { enableHighAccuracy: true, timeout: 8000 }
        );
      };

      if (gpsBtn) {
        gpsBtn.addEventListener('click', () => fetchGps(true));
      }

      // ئەگەر پێشتر لۆکەیشن نەبوو و لۆکەیشنی مۆبایل کرابێتەوە، دەچێتە شوێنی بەکارهێنەر
      if (!hasInit && navigator.geolocation) {
        fetchGps(true);
      }

      map.invalidateSize();
    }, 200);
  }

  /* ---------------- کردنەوەی فۆڕمی دەستکاری / زیادکردنی ماڕکێت ---------------- */

  async function openAddEditModal(market = null) {
    const isEdit = !!market;
    const modalBody = document.createElement('div');
    modalBody.className = 'mkt-modal-body';

    const currentCode = market ? String(market.account_code || '') : '';
    const currentName = market ? String(market.account_name || '') : '';
    const currentNh = market ? String(market.neighborhood || '') : '';
    const currentPhone = market ? String(market.phone || '') : '';
    let selectedLat = market && market.latitude !== null && market.latitude !== undefined ? parseFloat(market.latitude) : null;
    let selectedLon = market && market.longitude !== null && market.longitude !== undefined ? parseFloat(market.longitude) : null;

    // هێنانی هەموو زۆنەکانی سەب بەیس و ماڕکێتەکان بۆ ناو لیست بۆکس
    const allZones = await getMergedZones();

    modalBody.innerHTML = `
      <form class="mkt-form" id="mkt-edit-form" autocomplete="off">
        
        <!-- خانەی کۆدی ماڕکێت: #کۆدی ماڕکێت قفڵە ناتوانرێت دەستکاری بکرێت -->
        <div class="mkt-code-field-highlight">
          <label for="mkt-f-code">
            <span>کۆدی ماڕکێت ${isEdit ? '🔒' : '<span class="text-danger">*</span>'}</span>
            ${isEdit ? '<span class="muted" style="font-size:0.75rem">قفڵە و ناتوانرێت دەستکاری بکرێت</span>' : ''}
          </label>
          <input type="text" id="mkt-f-code"
                 value="${isEdit ? '#' + UI.esc(currentCode) : ''}"
                 ${isEdit ? 'readonly disabled style="opacity:0.85; background:var(--surface-2); cursor:not-allowed; font-weight:800; color:var(--accent);"' : 'inputmode="numeric" placeholder="نموونە: 101، 102، 105" autofocus required'}>
        </div>

        <!-- خانەی ناوی ماڕکێت -->
        <div class="field">
          <label for="mkt-f-name">ناوی ماڕکێت <span class="text-danger">*</span></label>
          <input type="text" id="mkt-f-name" placeholder="ناوی ماڕکێت بنووسە..."
                 value="${UI.esc(currentName)}" required>
        </div>

        <div class="mkt-form-row">
          <!-- خانەی زۆنی ماڕکێت: لیست بۆکسە هەر زۆنێکی نوێ بنوسرێت پاشەکەوت دەبێت لە سەب بەیس -->
          <div class="field">
            <label for="mkt-f-nh">زۆنی ماڕکێت</label>
            <input type="text" id="mkt-f-nh" list="mkt-zones-datalist" placeholder="زۆنێک هەڵبژێرە یان زۆنی نوێ بنووسە..."
                   value="${UI.esc(currentNh)}" autocomplete="off">
            <datalist id="mkt-zones-datalist">
              ${allZones.map(z => `<option value="${UI.esc(z)}">`).join('')}
            </datalist>
          </div>

          <!-- خانەی ژمارەی تەلەفۆن: یازدە ژمارەیە -->
          <div class="field">
            <label for="mkt-f-phone">
              <span>ژمارەی تەلەفۆن</span>
              <span class="muted" style="font-size:0.75rem">(١١ ژمارە)</span>
            </label>
            <input type="tel" id="mkt-f-phone" inputmode="numeric" maxlength="11" placeholder="07XXXXXXXXX"
                   value="${UI.esc(currentPhone)}">
          </div>
        </div>

        <!-- دووگمەی نیشانکردنی ماڕکێت -->
        <div class="field" style="margin-bottom:0">
          <label>شوێنی ماڕکێت لەسەر نەخشە</label>
          <button type="button" class="mkt-pin-map-btn" id="mkt-f-open-map-btn">
            📍 نیشانکردنی ماڕکێت لەسەر نەخشە
          </button>
          
          <div class="mkt-map-coords-badge" id="mkt-f-coords-badge">
            <span>پۆوتانی دیاریکراو:</span>
            <strong id="mkt-f-coords-val">
              ${selectedLat && selectedLon ? `${selectedLat}, ${selectedLon}` : 'دیاری نەکراوە'}
            </strong>
          </div>
        </div>

      </form>
    `;

    // یازدە ژمارە تەنها بۆ تەلەفۆن
    const phoneInput = modalBody.querySelector('#mkt-f-phone');
    if (phoneInput) {
      phoneInput.addEventListener('input', () => {
        phoneInput.value = UI.toLatinDigits(phoneInput.value).replace(/\D/g, '').slice(0, 11);
      });
    }

    // کلیک لە دوگمەی نیشانکردنی ماڕکێت
    const openMapBtn = modalBody.querySelector('#mkt-f-open-map-btn');
    if (openMapBtn) {
      openMapBtn.addEventListener('click', () => {
        openMapPickerModal({
          initialLat: selectedLat,
          initialLon: selectedLon,
          onSelect: (lat, lon) => {
            selectedLat = lat;
            selectedLon = lon;
            const badgeVal = modalBody.querySelector('#mkt-f-coords-val');
            if (badgeVal) badgeVal.textContent = `${lat}, ${lon}`;
          }
        });
      });
    }

    const { close } = UI.openModal({
      title: isEdit ? '✏️ دەستکاریکردنی ماڕکێت' : '🏪 زیادکردنی ماڕکێتی نوێ',
      body: modalBody,
      wide: true,
      actions: [
        { label: 'پاشگەزبوونەوە', className: 'btn-ghost', onClick: () => close() },
        {
          label: 'پاشەکەوت',
          className: 'btn-primary',
          onClick: async () => {
            const rawCode = isEdit ? currentCode : modalBody.querySelector('#mkt-f-code').value.trim();
            const account_code = UI.toLatinDigits(rawCode).replace(/\D/g, '');
            const account_name = modalBody.querySelector('#mkt-f-name').value.trim();
            const neighborhood = modalBody.querySelector('#mkt-f-nh').value.trim() || null;
            const phone = UI.toLatinDigits(modalBody.querySelector('#mkt-f-phone').value.trim()) || null;

            if (!account_code) {
              modalBody.querySelector('#mkt-f-code').focus();
              return;
            }

            if (!account_name) {
              modalBody.querySelector('#mkt-f-name').focus();
              return;
            }

            // پشکنینی کۆدی دووبارە تەنها لە کاتی زیادکردنی نوێدا
            if (!isEdit) {
              try {
                if (typeof API !== 'undefined' && API.Markets && API.Markets.search) {
                  const existing = await API.Markets.search(account_code);
                  const isDup = (existing || []).some(m => {
                    const codeDigits = UI.toLatinDigits(m.account_code || '').replace(/\D/g, '');
                    return codeDigits === account_code;
                  }) || state.localMarkets.has(account_code);

                  if (isDup) {
                    modalBody.querySelector('#mkt-f-code').focus();
                    return;
                  }
                }
              } catch (_) {}
            }

            // پشکنینی زۆنی نوێ و تۆمارکردنی لە سەب بەیس
            if (neighborhood) {
              const isOld = allZones.some(z => UI.norm(z) === UI.norm(neighborhood));
              if (!isOld) {
                try {
                  await API.Lists.insertZone({ name: neighborhood });
                  Store.invalidateLists();
                } catch (e) {
                  console.warn('Could not insert new zone:', e);
                }
              }
            }

            const payload = {
              account_code,
              account_name,
              neighborhood,
              latitude: Number.isFinite(selectedLat) ? selectedLat : null,
              longitude: Number.isFinite(selectedLon) ? selectedLon : null,
              phone
            };

            try {
              if (isEdit) {
                try {
                  await API.Markets.update(account_code, payload);
                } catch (e) {
                  console.warn('API update failed, updating locally:', e);
                }
                state.localMarkets.set(account_code, payload);
                const idx = state.searchResults.findIndex(m => String(m.account_code) === String(account_code));
                if (idx !== -1) state.searchResults[idx] = payload;
              } else {
                try {
                  await API.Markets.insert(payload);
                } catch (e) {
                  console.warn('API insert failed, saving locally:', e);
                }
                state.localMarkets.set(account_code, payload);
                state.search = account_code;
                const pageSearch = $('#mkt-page-search', container);
                if (pageSearch) pageSearch.value = account_code;
                state.hasSearched = true;
                state.searchResults = [payload];
              }

              close();
              updateListDisplay();
            } catch (err) {
              console.error('هەڵە لە پاشەکەوتکردن:', err);
            }
          }
        }
      ]
    });
  }

  /* ---------------- سڕینەوەی ماڕکێت ---------------- */

  async function confirmDeleteMarket(accountCode) {
    const market = state.searchResults.find(m => String(m.account_code) === String(accountCode)) ||
                   state.localMarkets.get(accountCode);
    const label = market ? `${market.account_name} (#${accountCode})` : `#${accountCode}`;

    const ok = await UI.confirmDialog(`ئایا دڵنیایت لە سڕینەوەی ماڕکێتی «${label}» لە سیستەم و سەب بەیس؟`, {
      danger: true,
      okLabel: 'بەڵێ، بیسڕەوە',
      cancelLabel: 'پاشگەزبوونەوە'
    });

    if (!ok) return;

    try {
      try {
        await API.Markets.delete(accountCode);
      } catch (e) {
        console.warn('API delete failed, removing locally:', e);
      }

      state.localMarkets.delete(accountCode);
      state.searchResults = state.searchResults.filter(m => String(m.account_code) !== String(accountCode));
      updateListDisplay();
    } catch (err) {
      console.error('هەڵە لە سڕینەوە:', err);
    }
  }

  /* ---------------- دەسەڵاتی سڕینەوە بەپێی ڕۆڵی بەکارهێنەر ---------------- */

  function canDeleteMarket() {
    const u = (typeof App !== 'undefined' && App && App.getUser) ? App.getUser() : (Store.getSession()?.user || null);
    if (!u) return false;
    const prof = String(u.profession || '').trim();
    // لە یوسەری سایەق و دابەشکار و مەندووب تەنها دووگمەی دەستکاری داتا پشان بداتن سڕینەوە پشان نەداتن
    if (
      prof === (typeof CONFIG !== 'undefined' && CONFIG.PROFESSION_DRIVER) ||
      prof === (typeof CONFIG !== 'undefined' && CONFIG.PROFESSION_DISTRIBUTOR) ||
      prof === (typeof CONFIG !== 'undefined' && CONFIG.PROFESSION_DELEGATE) ||
      prof === 'سایەق' ||
      prof === 'دابەشکار' ||
      prof === 'مەندوب' ||
      prof === 'مەندووب'
    ) {
      return false;
    }
    return true;
  }

  /* ---------------- کردنەوەی لۆکەیشنی ماڕکێت لە ئەپەکانی نەخشە (Maps.me / Google Maps / Geo) ---------------- */

  /* ---------------- کردنەوەی لۆکەیشنی ماڕکێت لە ئەپەکانی نەخشە (Google Maps / Geo) ---------------- */

  function openLocationApp(market) {
    if (!market) return;
    const lat = market.latitude !== null && market.latitude !== undefined ? parseFloat(market.latitude) : null;
    const lon = market.longitude !== null && market.longitude !== undefined ? parseFloat(market.longitude) : null;
    const name = String(market.account_name || 'ماڕکێت').trim();
    const code = String(market.account_code || '').trim();
    const label = code ? `${name} (#${code})` : name;

    // ئەگەر لۆکەیشن تۆمار نەکرابێت — ڕاستەوخۆ فۆڕمی دەستکاری بکاتەوە بەبێ پرسیار
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      openAddEditModal(market);
      return;
    }

    // پرفەرەنسی پێشتر هەڵبژێردراو — ڕاستەوخۆ بچە بەبێ هیچ مەسج یان مۆداڵ
    let savedPref = null;
    try {
      savedPref = localStorage.getItem('dlv_preferred_map_app');
      if (savedPref === 'mapsme') {
        localStorage.removeItem('dlv_preferred_map_app');
        savedPref = null;
      }
    } catch (_) {}

    if (savedPref === 'google') {
      launchGoogleMaps(lat, lon);
      return;
    } else if (savedPref === 'geo') {
      launchGeo(lat, lon, label);
      return;
    }

    // هیچ پرفەرەنسێک نییە — پیشاندانی مۆداڵی هەڵبژاردن
    showMapChooserModal(market, lat, lon, label);
  }

  function launchGoogleMaps(lat, lon) {
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
    window.open(url, '_blank');
  }

  function launchGeo(lat, lon, label) {
    const url = `geo:${lat},${lon}?q=${lat},${lon}(${encodeURIComponent(label)})`;
    window.location.href = url;
  }

  function showMapChooserModal(market, lat, lon, label) {
    const modalBody = document.createElement('div');
    modalBody.innerHTML = `
      <div style="text-align: right; direction: rtl;">
        <div style="background: var(--surface-2); padding: 12px 14px; border-radius: 10px; margin-bottom: 14px; border: 1px solid var(--border);">
          <div style="font-weight: 800; font-size: 1.05rem; color: var(--accent);">${UI.esc(label)}</div>
          <div style="font-size: 0.82rem; color: var(--muted); margin-top: 4px; direction: ltr; font-family: monospace;">
            📍 پۆوتان: ${lat}, ${lon}
          </div>
        </div>

        <div style="font-size: 0.9rem; font-weight: 700; color: var(--text); margin-bottom: 8px;">
          ئەپێک هەڵبژێرە بۆ کردنەوەی شوێنەکە لەسەر نەخشە:
        </div>

        <div class="mkt-map-chooser-list">
          <!-- دوگمەی Google Maps -->
          <button type="button" class="mkt-map-app-btn google" id="mkt-btn-app-google">
            <div class="mkt-map-app-icon">📍</div>
            <div class="mkt-map-app-details">
              <span class="mkt-map-app-title">ئەپی Google Maps</span>
              <span class="mkt-map-app-sub">نەخشەی گوگڵ (لە هەموو مۆبایل و کۆمپیوتەرێک کاردەکات)</span>
            </div>
            <span>➜</span>
          </button>

          <!-- دوگمەی هەموو ئەپەکان -->
          <button type="button" class="mkt-map-app-btn geo" id="mkt-btn-app-geo">
            <div class="mkt-map-app-icon">🧭</div>
            <div class="mkt-map-app-details">
              <span class="mkt-map-app-title">هەموو ئەپەکانی مۆبایل (Geo Navigation)</span>
              <span class="mkt-map-app-sub">سیستەمی مۆبایل دەپرسێت بە کام ئەپ دەیکەیتەوە</span>
            </div>
            <span>➜</span>
          </button>
        </div>

        <!-- هەڵبژاردنی هەمیشەیی -->
        <label style="display: flex; align-items: center; gap: 8px; margin-top: 16px; font-size: 0.85rem; color: var(--muted); cursor: pointer;">
          <input type="checkbox" id="mkt-save-pref-app" style="width: 16px; height: 16px; accent-color: var(--accent);">
          <span>ئەم ئەپە بە بنەڕەتی دابنێ بۆ جارەکانی داهاتوو</span>
        </label>
      </div>
    `;

    const { close } = UI.openModal({
      title: '🗺️ کردنەوەی شوێنی ماڕکێت',
      body: modalBody,
      actions: [
        { label: 'داخستن', className: 'btn-ghost', onClick: () => close() }
      ]
    });

    const chk = modalBody.querySelector('#mkt-save-pref-app');

    modalBody.querySelector('#mkt-btn-app-google')?.addEventListener('click', () => {
      try {
        if (chk && chk.checked) localStorage.setItem('dlv_preferred_map_app', 'google');
      } catch (_) {}
      close();
      launchGoogleMaps(lat, lon);
    });

    modalBody.querySelector('#mkt-btn-app-geo')?.addEventListener('click', () => {
      try {
        if (chk && chk.checked) localStorage.setItem('dlv_preferred_map_app', 'geo');
      } catch (_) {}
      close();
      launchGeo(lat, lon, label);
    });
  }


  /* =========================================================
   *  ڕێندەری ڕووکاری فۆڕمەکە (Main Page Layout)
   * ========================================================= */

  function render(el) {
    container = el;
    state.search = '';
    state.searchResults = [];
    state.hasSearched = false;
    state.searching = false;
    renderLayout();
  }

  function renderLayout() {
    if (!container) return;

    container.innerHTML = `
      <div class="settings-view markets-view mkt-custom-page" style="max-width: 960px; margin: 0 auto; padding: 20px 14px;">

        <!-- تەختەی کرداری خێرا و گەڕان لەسەر پەڕەکە -->
        <div class="card" style="margin-bottom: 20px; padding: 18px 20px;">
          
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 14px;">
            <div style="display:flex; align-items:center; gap:10px;">
              <div style="width: 38px; height: 38px; border-radius: 10px; background: color-mix(in srgb, var(--accent) 15%, transparent); color: var(--accent); display: flex; align-items: center; justify-content: center; font-size: 20px;">
                🏪
              </div>
              <div>
                <h3 style="margin:0; font-size: 1.15rem; font-weight: 800;">فۆڕمی ماڕکێتەکان</h3>
                <span style="font-size: 0.78rem; color: var(--muted);">گەڕانی خێرا و دەستکاری بەبێ بارگرانی</span>
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <button type="button" class="btn btn-primary btn-sm" id="mkt-page-new-btn">
                ➕ ماڕکێتی نوێ
              </button>
              <button type="button" class="btn btn-ghost btn-sm" id="mkt-page-refresh-btn" title="نوێکردنەوە لە سەب بەیس">
                🔄 نوێکردنەوە
              </button>
            </div>
          </div>

          <!-- گەڕانی خێرا لەسەر پەڕە -->
          <div class="mkt-search-input-wrap">
            <span class="mkt-input-search-ico">${UI.icon('search', 18)}</span>
            <input type="search" id="mkt-page-search" class="mkt-code-search-input"
                   placeholder="گەڕان بەپێی کۆدی ماڕکێت یان ناوی ماڕکێت..."
                   value="${UI.esc(state.search)}" autocomplete="off" autofocus>
            <button type="button" class="mkt-clear-search-btn" id="mkt-page-search-clear" style="display: ${state.search ? 'flex' : 'none'};">✕</button>
          </div>

        </div>

        <!-- لیستی ماڕکێتەکان لەسەر پەڕەکە -->
        <div class="mkt-list-container" id="mkt-page-list-container">
          ${renderPageListHtml(state.searchResults)}
        </div>

      </div>
    `;

    bindPageEvents();
  }

  /* ---------------- ڕێندەری لیستی سەر پەڕەکە ---------------- */

  function renderPageListHtml(list) {
    // ئەگەر بەکارهێنەر هێشتا گەڕانی نەکردووە (بۆ کردنەوەی دەستبەجێ بەبێ هێنانی هەموو ماڕکێتەکان)
    if (!state.hasSearched || !state.search.trim()) {
      return `
        <div class="card mkt-search-prompt-card">
          <div class="mkt-search-prompt-icon">🔍</div>
          <h3 class="mkt-search-prompt-title">گەڕان بۆ ماڕکێتەکان</h3>
          <p class="mkt-search-prompt-desc">
            تکایە لە خانەی سەرەوە کۆدی ماڕکێت یان ناوی ماڕکێت بنووسە بۆ بینین و دەستکاریکردنی ماڕکێتەکە.
          </p>
        </div>
      `;
    }

    // ئەگەر لە کاتی گەڕاندایە لە سەب بەیس
    if (state.searching) {
      return `
        <div class="card mkt-search-loading-card">
          <div class="mkt-search-spinner"></div>
          <div style="font-weight: 700; color: var(--accent); font-size: 0.95rem;">دەگەڕێت لە سەب بەیس...</div>
        </div>
      `;
    }

    // ئەگەر گەڕان کرا بەڵام هیچ ماڕکێتێک نەدۆزرایەوە
    if (!list || !list.length) {
      return `
        <div class="card" style="padding: 34px 20px; text-align: center;">
          <div style="font-size: 32px; margin-bottom: 8px;">❌</div>
          <div style="font-weight: 800; font-size: 1.05rem;">هیچ ماڕکێتێک بەم ناونیشانە نەدۆزرایەوە</div>
          <p style="font-size: 0.88rem; color: var(--muted); margin: 6px 0 14px;">
            هیچ ماڕکێتێک بە کۆد یان ناوی «${UI.esc(state.search)}» نەدۆزرایەوە.
          </p>
          <button type="button" class="btn btn-ghost btn-sm" id="mkt-page-clear-search-link">
            پاککردنەوەی گەڕان
          </button>
        </div>
      `;
    }

    const canDel = canDeleteMarket();

    return `
      <div class="mkt-rows-list" style="display: flex; flex-direction: column; gap: 10px;">
        ${list.map(m => {
          const code = String(m.account_code || '');
          const name = String(m.account_name || 'ماڕکێت');
          const nh = m.neighborhood ? String(m.neighborhood).trim() : '';
          const phone = m.phone ? String(m.phone).trim() : '';
          const hasLoc = m.latitude !== null && m.latitude !== undefined &&
                         m.longitude !== null && m.longitude !== undefined;

          return `
            <div class="mkt-swipe-item" data-code="${UI.esc(code)}">
              
              <!-- دوگمەکانی لای ڕاست (کاتێک ویندۆکە بۆ لای چەپ ڕادەکێشرێت دەردەکەون) -->
              <div class="mkt-swipe-actions mkt-swipe-actions-right">
                <button type="button" class="mkt-action-btn mkt-btn-edit" data-action="edit-mkt" data-code="${UI.esc(code)}" title="دەستکاری تۆمار" aria-label="دەستکاری تۆمار">
                  ${UI.icon('edit', 22)}
                </button>
                ${canDel ? `
                  <button type="button" class="mkt-action-btn mkt-btn-delete" data-action="del-mkt" data-code="${UI.esc(code)}" title="سڕینەوە" aria-label="سڕینەوە">
                    ${UI.icon('trash', 22)}
                  </button>
                ` : ''}
              </div>

              <!-- دوگمەکانی لای چەپ (کاتێک ویندۆکە بۆ لای ڕاست ڕادەکێشرێت دەردەکەون) -->
              <div class="mkt-swipe-actions mkt-swipe-actions-left">
                <button type="button" class="mkt-action-btn mkt-btn-edit" data-action="edit-mkt" data-code="${UI.esc(code)}" title="دەستکاری تۆمار" aria-label="دەستکاری تۆمار">
                  ${UI.icon('edit', 22)}
                </button>
                ${canDel ? `
                  <button type="button" class="mkt-action-btn mkt-btn-delete" data-action="del-mkt" data-code="${UI.esc(code)}" title="سڕینەوە" aria-label="سڕینەوە">
                    ${UI.icon('trash', 22)}
                  </button>
                ` : ''}
              </div>

              <!-- ویندۆی پێشەوەی ماڕکێت — ڕاکێشان بۆ چەپ و ڕاست -->
              <div class="mkt-card-front" data-code="${UI.esc(code)}" title="ڕاکێشان بۆ دەستکاری یان سڕینەوە">
                
                <!-- دێڕی یەکەم: #کۆدی ماڕکێت تەنیشتی ناوی ماڕکێت -->
                <div class="mkt-card-row-top">
                  <span class="mkt-card-code">#${UI.esc(code)}</span>
                  <span class="mkt-card-name">${UI.esc(name)}</span>
                  ${hasLoc ? `
                    <button type="button" class="mkt-card-loc-btn" data-action="open-map" title="کردنەوەی شوێن لەسەر نەخشە">
                      📍 نەخشە
                    </button>
                  ` : `
                    <button type="button" class="mkt-card-no-gps" data-action="open-map" title="دیاریکردنی شوێن لەسەر نەخشە">
                      بێ GPS
                    </button>
                  `}
                </div>

                <!-- دێڕی دووەم: لەژێر ناوی ماڕکێت زۆن پاشان ژمارە تەلەفۆن -->
                <div class="mkt-card-row-sub">
                  <span class="mkt-card-zone">📍 ${UI.esc(nh || 'زۆن دیاری نەکراوە')}</span>
                  ${phone ? `
                    <span class="mkt-card-dot">•</span>
                    <a href="tel:${UI.esc(phone)}" class="mkt-card-phone" title="پەیوەندیکردن">📞 ${UI.esc(phone)}</a>
                  ` : ''}
                </div>

              </div>

            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  /* ---------------- گرێدانی ئیڤێنتەکانی سەر پەڕەکە ---------------- */

  let searchDebounceTimer = null;

  function bindPageEvents() {
    if (!container) return;

    // گەڕانی سەر پەڕە
    const pageSearch = $('#mkt-page-search', container);
    if (pageSearch) {
      pageSearch.addEventListener('input', e => {
        const val = e.target.value;
        const clrBtn = $('#mkt-page-search-clear', container);
        if (clrBtn) clrBtn.style.display = val.trim() ? 'flex' : 'none';

        if (searchDebounceTimer) clearTimeout(searchDebounceTimer);

        if (!val.trim()) {
          state.search = '';
          state.hasSearched = false;
          state.searching = false;
          state.searchResults = [];
          updateListDisplay();
          return;
        }

        searchDebounceTimer = setTimeout(() => {
          performSearch(val);
        }, 220);
      });

      pageSearch.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
          performSearch(pageSearch.value);
        }
      });
    }

    const clearPageSearch = $('#mkt-page-search-clear', container);
    if (clearPageSearch) {
      clearPageSearch.addEventListener('click', () => {
        if (pageSearch) pageSearch.value = '';
        state.search = '';
        state.hasSearched = false;
        state.searching = false;
        state.searchResults = [];
        updateListDisplay();
        if (pageSearch) pageSearch.focus();
      });
    }

    // دوگمەکانی سەرووی پەڕە
    const newBtn = $('#mkt-page-new-btn', container);
    if (newBtn) newBtn.addEventListener('click', () => openAddEditModal());

    const refreshBtn = $('#mkt-page-refresh-btn', container);
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        if (state.search.trim()) {
          performSearch(state.search);
        } else if (pageSearch) {
          pageSearch.focus();
        }
      });
    }

    const listEl = $('#mkt-page-list-container', container);
    if (listEl) bindPageListActions(listEl);
  }

  let activeOpenCard = null;

  function closeActiveCard() {
    if (activeOpenCard) {
      activeOpenCard.style.transform = '';
      activeOpenCard.classList.remove('is-open');
      delete activeOpenCard.dataset.offset;
      activeOpenCard = null;
    }
  }

  function bindPageListActions(root) {
    if (!root) return;

    // لینکی پاککردنەوەی گەڕان
    const clearLink = root.querySelector('#mkt-page-clear-search-link');
    if (clearLink) {
      clearLink.addEventListener('click', () => {
        const pageSearch = $('#mkt-page-search', container);
        if (pageSearch) pageSearch.value = '';
        state.search = '';
        state.hasSearched = false;
        state.searching = false;
        state.searchResults = [];
        updateListDisplay();
        if (pageSearch) pageSearch.focus();
      });
    }

    // دەستکاری تۆمار
    root.querySelectorAll('[data-action="edit-mkt"]').forEach(btn => {
      const handler = e => {
        e.stopPropagation();
        closeActiveCard();
        const code = btn.getAttribute('data-code');
        const market = state.searchResults.find(m => String(m.account_code) === String(code)) ||
                       state.localMarkets.get(code);
        if (market) openAddEditModal(market);
      };
      btn.addEventListener('click', handler);
      btn.addEventListener('pointerdown', e => e.stopPropagation());
    });

    // سڕینەوە
    root.querySelectorAll('[data-action="del-mkt"]').forEach(btn => {
      const handler = e => {
        e.stopPropagation();
        closeActiveCard();
        const code = btn.getAttribute('data-code');
        confirmDeleteMarket(code);
      };
      btn.addEventListener('click', handler);
      btn.addEventListener('pointerdown', e => e.stopPropagation());
    });

    // بەڕێوەبردنی ڕاکێشان (Swipe) و داگرتنی ویندۆ بۆ ئەپەکانی نەخشە
    root.querySelectorAll('.mkt-swipe-item').forEach(item => {
      const front = item.querySelector('.mkt-card-front');
      const code = item.getAttribute('data-code');
      const market = state.searchResults.find(m => String(m.account_code) === String(code)) ||
                     state.localMarkets.get(code);
      if (!front) return;

      let startX = 0;
      let startY = 0;
      let startTime = 0;
      let isDragging = false;
      let isHorizontal = false;
      let isVertical = false;
      let initialOffset = 0;
      let pointerId = null;
      let movedDistance = 0;

      // پانی دوگمەکان: بۆ سایەق/دابەشکار/مەندوب 1 ئایکۆنە (60px)، بۆ بەڕێوەبەر 2 ئایکۆنە (120px)
      const maxReveal = canDeleteMarket() ? 120 : 60;

      const onPointerDown = e => {
        // پەیوەندی تەلەفۆن ڕێگری لێناکرێت
        if (e.target.closest('a[href^="tel:"], .mkt-card-phone')) return;

        // ئەگەر ویندۆیەکی تر کراوە بێت، دایبخە
        if (activeOpenCard && activeOpenCard !== front) {
          closeActiveCard();
        }

        pointerId = e.pointerId;
        startX = e.clientX;
        startY = e.clientY;
        startTime = Date.now();
        isDragging = false;
        isHorizontal = false;
        isVertical = false;
        movedDistance = 0;
        initialOffset = front.dataset.offset ? parseFloat(front.dataset.offset) : 0;

        try {
          front.setPointerCapture(pointerId);
        } catch (_) {}

        item.classList.add('is-dragging');

        const moveHandler = ev => onPointerMove(ev);
        const upHandler = ev => {
          onPointerUp(ev);
          front.removeEventListener('pointermove', moveHandler);
          front.removeEventListener('pointerup', upHandler);
          front.removeEventListener('pointercancel', upHandler);
          window.removeEventListener('pointermove', moveHandler);
          window.removeEventListener('pointerup', upHandler);
          window.removeEventListener('pointercancel', upHandler);
        };

        front.addEventListener('pointermove', moveHandler, { passive: false });
        front.addEventListener('pointerup', upHandler);
        front.addEventListener('pointercancel', upHandler);
        window.addEventListener('pointermove', moveHandler, { passive: false });
        window.addEventListener('pointerup', upHandler);
        window.addEventListener('pointercancel', upHandler);
      };

      const onPointerMove = e => {
        if (isVertical) return;

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        movedDistance = Math.hypot(dx, dy);

        if (!isHorizontal && !isVertical) {
          // ئەگەر بە ڕوونی ئاسۆیی بێت و زیاتر لە 12 پیکسڵ جوڵابێت
          if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.3) {
            isHorizontal = true;
          } else if (Math.abs(dy) > 10) {
            // جوڵەی ستوونی (Scroll) پەڕەکە تێک نەدرێت
            isVertical = true;
            item.classList.remove('is-dragging');
            if (pointerId !== null) {
              try { front.releasePointerCapture(pointerId); } catch (_) {}
              pointerId = null;
            }
            return;
          }
        }

        if (isHorizontal) {
          if (e.cancelable) e.preventDefault();
          isDragging = true;

          let targetX = initialOffset + dx;

          // سنوردارکردن لە چەپ و ڕاست
          if (targetX < -(maxReveal + 25)) targetX = -(maxReveal + 25);
          if (targetX > (maxReveal + 25)) targetX = (maxReveal + 25);

          front.style.transform = `translateX(${targetX}px)`;
        }
      };

      const onPointerUp = e => {
        item.classList.remove('is-dragging');
        if (pointerId !== null) {
          try { front.releasePointerCapture(pointerId); } catch (_) {}
          pointerId = null;
        }

        const totalDx = e.clientX - startX;
        const elapsed = Date.now() - startTime;

        if (isDragging) {
          const finalX = initialOffset + totalDx;
          const threshold = maxReveal * 0.28;

          // کاتێک بۆ لای چەپ دەبرێت
          if (finalX < -threshold) {
            front.style.transform = `translateX(-${maxReveal}px)`;
            front.dataset.offset = -maxReveal;
            front.classList.add('is-open');
            activeOpenCard = front;
          }
          // کاتێک بۆ لای ڕاست دەبرێت
          else if (finalX > threshold) {
            front.style.transform = `translateX(${maxReveal}px)`;
            front.dataset.offset = maxReveal;
            front.classList.add('is-open');
            activeOpenCard = front;
          }
          // ئەگەر کەم ڕاکێشرابێت، دەگەڕێتەوە شوێنی سەرەتایی
          else {
            front.style.transform = '';
            delete front.dataset.offset;
            front.classList.remove('is-open');
            if (activeOpenCard === front) activeOpenCard = null;
          }
        } else if (!isVertical && movedDistance < 14 && elapsed < 650) {
          // داگرتنی ئاسایی (Tap) لەسەر کارتی کراوە تەنها کارتی کراوە دادەخات
          if (front.classList.contains('is-open')) {
            front.style.transform = '';
            delete front.dataset.offset;
            front.classList.remove('is-open');
            activeOpenCard = null;
          }
        }
      };

      front.addEventListener('pointerdown', onPointerDown);
    });

    // کلیک لەسەر دوگمەی نەخشە (📍 نەخشە یان بێ GPS) بۆ کردنەوەی شوێن لە ئەپەکانی نەخشە
    root.querySelectorAll('[data-action="open-map"]').forEach(btn => {
      btn.addEventListener('pointerdown', e => {
        // ڕێگری لە دەستپێکردنی swipe یان جووڵاندنی کارتەکە
        e.stopPropagation();
      });
      btn.addEventListener('click', e => {
        e.stopPropagation();
        e.preventDefault();
        closeActiveCard();
        const item = btn.closest('.mkt-swipe-item');
        const code = item ? item.getAttribute('data-code') : null;
        const market = state.searchResults.find(m => String(m.account_code) === String(code)) ||
                       state.localMarkets.get(code);
        if (market) {
          openLocationApp(market);
        }
      });
    });

    // ڕێگری لە swipe کاتێک پەیوەندی بە ژمارە تەلەفۆن دەکرێت
    root.querySelectorAll('.mkt-card-phone').forEach(el => {
      el.addEventListener('pointerdown', e => e.stopPropagation());
    });

    // داگرتن لە هەر شوێنێکی تر کارتی کراوە دابخات
    document.addEventListener('pointerdown', e => {
      if (!e.target.closest('.mkt-swipe-item')) {
        closeActiveCard();
      }
    }, { passive: true });
  }

  function stop() {
    // وەستاندنی کاتژمێر یان پرۆسەکان لە کاتی دەرچوون
  }

  return {
    render,
    stop,
    openAddEditModal
  };
})();

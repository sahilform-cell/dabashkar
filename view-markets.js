/* =========================================================
 *  فۆڕمی ماڕکێتەکان — Markets View
 *  هێنانی کۆدی ماڕکێت لەگەڵ ناوەکان لە سەب بەیس (Supabase) بەسۆڕتی کۆدەکان
 * ========================================================= */

const MarketsView = (() => {
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  let container = null;

  const state = {
    markets: [],
    search: '',
    neighborhoodFilter: '',
    sortMode: 'code-asc', // 'code-asc' | 'code-desc' | 'name-asc'
    onlyWithLocation: false,
    loading: false
  };

  /* ---------------- نموونەی داتای ماڕکێتەکان (بۆ کاتێک سەب بەیس هێشتا بەتاڵ بێت) ---------------- */
  const SAMPLE_MARKETS = [
    { account_code: '101', account_name: 'مارکێتی شانەدەر', neighborhood: 'سەرچنار', phone: '07701234567', latitude: 35.5684, longitude: 45.3852 },
    { account_code: '102', account_name: 'سوپەرمارکێتی هەڵەبجە', neighborhood: 'توی مەلیک', phone: '07501234567', latitude: 35.5612, longitude: 45.4215 },
    { account_code: '103', account_name: 'مارکێتی گۆیژە', neighborhood: 'گۆیژە', phone: '07709876543', latitude: 35.5750, longitude: 45.4420 },
    { account_code: '104', account_name: 'هایپەرمارکێتی فامیلی مۆڵ', neighborhood: 'بەختیاری', phone: '07509876543', latitude: 35.5480, longitude: 45.3950 },
    { account_code: '105', account_name: 'مارکێتی ڕاپەڕین', neighborhood: 'ڕاپەڕین', phone: '07705551234', latitude: 35.5890, longitude: 45.3620 },
    { account_code: '106', account_name: 'مارکێتی سەرچنار', neighborhood: 'سەرچنار', phone: '07504449876', latitude: 35.5710, longitude: 45.3780 },
    { account_code: '107', account_name: 'سوپەرمارکێتی سلێمانی', neighborhood: 'تووی مەلیك', phone: '07703332211', latitude: 35.5640, longitude: 45.4190 },
    { account_code: '108', account_name: 'مارکێتی بەختیاری', neighborhood: 'بەختیاری', phone: '07502223344', latitude: 35.5520, longitude: 45.4010 },
    { account_code: '109', account_name: 'مارکێتی کاردۆ', neighborhood: 'عەقاری', phone: '07701114455', latitude: 35.5580, longitude: 45.4310 },
    { account_code: '110', account_name: 'هایپەرمارکێتی ماجیدی مۆڵ', neighborhood: 'تاسڵوجە', phone: '07507778899', latitude: 35.5390, longitude: 45.3450 },
    { account_code: '112', account_name: 'مارکێتی توی مەلیک', neighborhood: 'توی مەلیک', phone: '07708889900', latitude: 35.5660, longitude: 45.4240 },
    { account_code: '115', account_name: 'مارکێتی مێرگەپان', neighborhood: 'مێرگەپان', phone: '07506665544', latitude: 35.6120, longitude: 45.3500 },
    { account_code: '120', account_name: 'سوپەرمارکێتی شارستان', neighborhood: 'کوردسات', phone: '07704443322', latitude: 35.5510, longitude: 45.4480 },
    { account_code: '125', account_name: 'مارکێتی بەکرەجۆ', neighborhood: 'بەکرەجۆ', phone: '07501112233', latitude: 35.5320, longitude: 45.3320 }
  ];

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

  /* ---------------- هێنانی داتاکان لە سەب بەیس ---------------- */

  async function loadData(force = false) {
    state.loading = true;
    try {
      let rows = await Store.loadMarkets(force);
      if (!Array.isArray(rows)) rows = [];

      // ئەگەر سەب بەیس و کاش هەردووکیان بەتاڵ بوون، داتای نموونەیی پێشنیار بکە
      if (!rows.length) {
        const cached = Store.getCachedMarkets();
        if (cached && cached.length) {
          rows = cached;
        }
      }

      state.markets = sortMarketsList(rows);
    } catch (err) {
      console.warn('هەڵە لە هێنانی ماڕکێتەکان لە سەب بەیس:', err);
      state.markets = sortMarketsList(Store.getCachedMarkets() || []);
    } finally {
      state.loading = false;
    }
  }

  /* ---------------- فلتەرکردنی ماڕکێتەکان ---------------- */

  function getFilteredMarkets(searchQuery = state.search) {
    const rawSearch = (searchQuery || '').trim();
    const cleanSearch = rawSearch.replace(/^[#＃]/, '').trim();
    const cleanLatin = UI.toLatinDigits(cleanSearch);
    const latinDigitsOnly = cleanLatin.replace(/\D/g, '');
    const isPureNumber = latinDigitsOnly.length > 0 && latinDigitsOnly === cleanLatin;

    const q = UI.norm(rawSearch);
    const nhf = state.neighborhoodFilter ? UI.norm(state.neighborhoodFilter) : '';

    const filtered = state.markets.filter(m => {
      const hasLoc = m.latitude !== null && m.latitude !== undefined &&
                     m.longitude !== null && m.longitude !== undefined;

      if (state.onlyWithLocation && !hasLoc) return false;
      if (nhf && UI.norm(m.neighborhood) !== nhf) return false;
      if (!rawSearch) return true;

      // ئەگەر بەکارهێنەر تەنها ژمارەی نووسی (وەک 2 یان #2)، تەنها و تەنها ئەو ماڕکێتە دەهێنێت کە کۆدەکەی ڕێک ئەو ژمارەیەیە (نەک 12 و 24 و 32)
      if (isPureNumber) {
        const mCodeDigits = UI.toLatinDigits(m.account_code || '').replace(/\D/g, '');
        const mCodeStr = String(m.account_code || '').trim();

        // بۆ کۆدی ئاسایی ماڕکێت (کەمتر لە ٨ ژمارە)، تەنها بەراوردی ڕێکی یەکسانبوون
        if (latinDigitsOnly.length < 8) {
          return mCodeDigits === latinDigitsOnly || mCodeStr === cleanSearch;
        }

        // بۆ ژمارەی مۆبایل (٨ ژمارە یان زیاتر)، بەراوردی مۆبایلیش دەکات
        const mPhoneDigits = UI.toLatinDigits(m.phone || '').replace(/\D/g, '');
        return mCodeDigits === latinDigitsOnly || mPhoneDigits.includes(latinDigitsOnly);
      }

      // ئەگەر دەق یان پیت بێت، بەپێی ناوی ماڕکێت یان گەڕەک یان تەلەفۆن دەگەڕێت
      return [
        m.account_name,
        m.neighborhood,
        m.phone
      ].some(v => UI.norm(v).includes(q));
    });

    return sortMarketsList(filtered, state.sortMode);
  }

  /* ---------------- دەرهێنانی لیستی گەڕەکە ناوازەکان ---------------- */

  function getUniqueNeighborhoods() {
    const list = state.markets.map(m => (m.neighborhood || '').trim()).filter(Boolean);
    return [...new Set(list)].sort((a, b) => a.localeCompare(b, 'ckb'));
  }



  /* =========================================================
   *  مۆدالی زیادکردن و دەستکاریکردنی ماڕکێت (Supabase)
   * ========================================================= */

  function openAddEditModal(market = null) {
    const isEdit = !!market;
    const modalBody = document.createElement('div');
    modalBody.className = 'mkt-modal-body';

    const currentCode = market ? String(market.account_code || '') : '';
    const currentName = market ? String(market.account_name || '') : '';
    const currentNh = market ? String(market.neighborhood || '') : '';
    const currentPhone = market ? String(market.phone || '') : '';
    const currentLat = market && market.latitude !== null && market.latitude !== undefined ? market.latitude : '';
    const currentLon = market && market.longitude !== null && market.longitude !== undefined ? market.longitude : '';

    modalBody.innerHTML = `
      <form class="mkt-form" id="mkt-edit-form" autocomplete="off">
        
        <!-- کۆدی ماڕکێت (پێویستە) -->
        <div class="mkt-code-field-highlight">
          <label for="mkt-f-code">
            <span>کۆدی ژمارەیی ماڕکێت (account_code) <span class="text-danger">*</span></span>
            <span class="muted" style="font-size:0.75rem">کۆدی ناوازە — نابێت دووبارە بێت</span>
          </label>
          <input type="text" id="mkt-f-code" inputmode="numeric"
                 placeholder="نموونە: 101، 102، 105"
                 value="${UI.esc(currentCode)}" ${isEdit ? 'readonly style="opacity:0.8;background:var(--surface)"' : 'autofocus'} required>
        </div>

        <!-- ناوی ماڕکێت (پێویستە) -->
        <div class="field">
          <label for="mkt-f-name">ناوی ماڕکێت (account_name) <span class="text-danger">*</span></label>
          <input type="text" id="mkt-f-name" placeholder="نموونە: مارکێتی شانەدەر، سوپەرمارکێتی هەڵەبجە..."
                 value="${UI.esc(currentName)}" required>
        </div>

        <div class="mkt-form-row">
          <!-- گەڕەک / زۆن -->
          <div class="field">
            <label for="mkt-f-nh">گەڕەک یان ناوچە (neighborhood)</label>
            <input type="text" id="mkt-f-nh" placeholder="نموونە: سەرچنار، توی مەلیک..."
                   value="${UI.esc(currentNh)}">
          </div>

          <!-- ژمارەی پەیوەندی -->
          <div class="field">
            <label for="mkt-f-phone">ژمارەی مۆبایل / پەیوەندی</label>
            <input type="tel" id="mkt-f-phone" inputmode="tel" placeholder="07XXXXXXXXX"
                   value="${UI.esc(currentPhone)}">
          </div>
        </div>

        <!-- لۆکەیشن و GPS (ئارەزوومەندانە) -->
        <div class="field" style="margin-bottom:0">
          <div class="mkt-loc-label-row">
            <label>پۆوتانی لۆکەیشن (GPS - Latitude / Longitude)</label>
            <button type="button" class="btn btn-ghost btn-sm" id="mkt-f-gps-btn" style="padding:2px 8px;font-size:0.75rem">
              📍 لۆکەیشنی ئێستام (GPS)
            </button>
          </div>
          <div style="display:flex;gap:8px">
            <input type="text" id="mkt-f-lat" placeholder="Latitude (نموونە: 35.5684)" value="${UI.esc(String(currentLat))}">
            <input type="text" id="mkt-f-lon" placeholder="Longitude (نموونە: 45.3852)" value="${UI.esc(String(currentLon))}">
          </div>
        </div>

      </form>
    `;

    // دوگمەی GPS بۆ وەرگرتنی لۆکەیشنی مۆبایل
    const gpsBtn = modalBody.querySelector('#mkt-f-gps-btn');
    if (gpsBtn) {
      gpsBtn.addEventListener('click', () => {
        if (!navigator.geolocation) {
          UI.toast('وێبگەڕەکەت پشتگیری لۆکەیشن ناکات', 'warning');
          return;
        }
        gpsBtn.textContent = 'چاوەڕوانبە...';
        gpsBtn.disabled = true;
        navigator.geolocation.getCurrentPosition(
          pos => {
            gpsBtn.textContent = '📍 لۆکەیشنی ئێستام (GPS)';
            gpsBtn.disabled = false;
            const lat = parseFloat(pos.coords.latitude.toFixed(6));
            const lon = parseFloat(pos.coords.longitude.toFixed(6));
            modalBody.querySelector('#mkt-f-lat').value = lat;
            modalBody.querySelector('#mkt-f-lon').value = lon;
            UI.toast(`لۆکەیشن دیاریکرا: ${lat}, ${lon}`, 'success');
          },
          err => {
            gpsBtn.textContent = '📍 لۆکەیشنی ئێستام (GPS)';
            gpsBtn.disabled = false;
            UI.toast('نەتوانرا لۆکەیشن وەربگیرێت: ' + (err.message || ''), 'warning');
          },
          { enableHighAccuracy: true, timeout: 10000 }
        );
      });
    }

    const { close } = UI.openModal({
      title: isEdit ? '✏️ دەستکاریکردنی ماڕکێت' : '🏪 زیادکردنی ماڕکێتی نوێ',
      body: modalBody,
      wide: true,
      actions: [
        { label: 'پاشگەزبوونەوە', className: 'btn-ghost', onClick: () => close() },
        {
          label: isEdit ? 'پاشەکەوتکردن لە سەب بەیس' : 'زیادکردن بۆ سەب بەیس',
          className: 'btn-primary',
          onClick: async () => {
            const rawCode = modalBody.querySelector('#mkt-f-code').value.trim();
            const account_code = UI.toLatinDigits(rawCode).replace(/\D/g, '');
            const account_name = modalBody.querySelector('#mkt-f-name').value.trim();
            const neighborhood = modalBody.querySelector('#mkt-f-nh').value.trim() || null;
            const phone = UI.toLatinDigits(modalBody.querySelector('#mkt-f-phone').value.trim()) || null;

            const latStr = UI.toLatinDigits(modalBody.querySelector('#mkt-f-lat').value.trim());
            const lonStr = UI.toLatinDigits(modalBody.querySelector('#mkt-f-lon').value.trim());
            const latitude = latStr ? parseFloat(latStr) : null;
            const longitude = lonStr ? parseFloat(lonStr) : null;

            if (!account_code) {
              UI.toast('تکایە کۆدی ژمارەیی ماڕکێت بنووسە', 'error');
              modalBody.querySelector('#mkt-f-code').focus();
              return;
            }

            if (!account_name) {
              UI.toast('تکایە ناوی ماڕکێت بنووسە', 'error');
              modalBody.querySelector('#mkt-f-name').focus();
              return;
            }

            // پشکنینی کۆدی دووبارە
            const duplicate = state.markets.find(m => {
              const codeDigits = UI.toLatinDigits(m.account_code || '').replace(/\D/g, '');
              return codeDigits === account_code;
            });

            if (duplicate && (!isEdit || UI.toLatinDigits(duplicate.account_code).replace(/\D/g, '') !== UI.toLatinDigits(currentCode).replace(/\D/g, ''))) {
              UI.toast(`کۆدی «${account_code}» پێشتر هەیە — نابێت دوو ماڕکێت یەک کۆدیان هەبێت!`, 'error', 4000);
              modalBody.querySelector('#mkt-f-code').focus();
              return;
            }

            const payload = {
              account_code,
              account_name,
              neighborhood,
              latitude: Number.isFinite(latitude) ? latitude : null,
              longitude: Number.isFinite(longitude) ? longitude : null,
              phone
            };

            try {
              if (isEdit) {
                try {
                  await API.Markets.update(account_code, payload);
                } catch (e) {
                  console.warn('API update failed, updating locally:', e);
                }
                const idx = state.markets.findIndex(m => String(m.account_code) === String(account_code));
                if (idx !== -1) state.markets[idx] = { ...state.markets[idx], ...payload };
                UI.toast(`ماڕکێتی [${account_code}] نوێکرایەوە ✓`, 'success');
              } else {
                try {
                  await API.Markets.insert(payload);
                } catch (e) {
                  console.warn('API insert failed, saving locally:', e);
                }
                state.markets.push(payload);
                UI.toast(`ماڕکێتی [${account_code}] بە سەرکەوتوویی زیادکرا ✓`, 'success');
              }

              state.markets = sortMarketsList(state.markets);
              Store.saveMarketsCache(state.markets);
              close();

              renderLayout();
            } catch (err) {
              console.error('هەڵە لە پاشەکەوتکردن:', err);
              UI.toast('هەڵە لە پاشەکەوتکردن لە سەب بەیس: ' + (err.message || ''), 'error');
            }
          }
        }
      ]
    });
  }

  /* ---------------- سڕینەوەی ماڕکێت ---------------- */

  async function confirmDeleteMarket(accountCode) {
    const market = state.markets.find(m => String(m.account_code) === String(accountCode));
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

      state.markets = state.markets.filter(m => String(m.account_code) !== String(accountCode));
      Store.saveMarketsCache(state.markets);
      UI.toast(`ماڕکێتی [${accountCode}] سڕدرایەوە ✓`, 'success');

      renderLayout();
    } catch (err) {
      console.error('هەڵە لە سڕینەوە:', err);
      UI.toast('نەتوانرا لە سەب بەیس بسڕدرێتەوە: ' + (err.message || ''), 'error');
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

  /* ---------------- کردنەوەی ڕاستەوخۆ لە ئەپی Maps.me ---------------- */

  function openInMapsMe(market) {
    if (!market) return;
    const lat = market.latitude !== null && market.latitude !== undefined ? parseFloat(market.latitude) : null;
    const lon = market.longitude !== null && market.longitude !== undefined ? parseFloat(market.longitude) : null;
    const name = String(market.account_name || 'ماڕکێت').trim();
    const code = String(market.account_code || '').trim();
    const label = code ? `${name} (#${code})` : name;

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      UI.toast(`لۆکەیشنی GPS بۆ «${name}» دیاری نەکراوە! لە دوگمەی دەستکاری تۆمار دەتوانیت لۆکەیشنی بۆ دابنێیت.`, 'warning', 3500);
      return;
    }

    const mapsmeUrl = `mapsme://map?v=1&ll=${lat},${lon}&n=${encodeURIComponent(label)}`;
    UI.toast(`کردنەوەی لۆکەیشنی «${name}» لە ئەپی Maps.me...`, 'info', 1800);

    try {
      window.location.href = mapsmeUrl;
    } catch (e) {
      console.warn('Maps.me URL launch error:', e);
      window.open(mapsmeUrl, '_blank');
    }
  }


  /* =========================================================
   *  ڕێندەری ڕووکاری فۆڕمەکە (Main Page Layout)
   * ========================================================= */

  async function render(el) {
    container = el;
    await loadData();
    renderLayout();
  }

  function renderLayout() {
    if (!container) return;

    const list = getFilteredMarkets(state.search);
    const totalCount = state.markets.length;
    const sorted = sortMarketsList(state.markets);

    const firstCode = sorted.length ? sorted[0].account_code : '—';
    const lastCode = sorted.length ? sorted[sorted.length - 1].account_code : '—';
    const withLocCount = state.markets.filter(m => m.latitude !== null && m.latitude !== undefined && m.longitude !== null && m.longitude !== undefined).length;
    const withPhoneCount = state.markets.filter(m => (m.phone || '').trim().length > 0).length;

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
                <span style="font-size: 0.78rem; color: var(--muted);">ڕیزبەندی بەپێی کۆدەکان</span>
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
                   placeholder="گەڕان بەپێی کۆدی ژمارەیی یان ناوی ماڕکێت..."
                   value="${UI.esc(state.search)}">
            ${state.search ? `<button type="button" class="mkt-clear-search-btn" id="mkt-page-search-clear">✕</button>` : ''}
          </div>

        </div>

        <!-- ٣. لیستی ماڕکێتەکان لەسەر پەڕەکە -->
        <div class="mkt-list-container" id="mkt-page-list-container">
          ${renderPageListHtml(list)}
        </div>

      </div>
    `;

    bindPageEvents();
  }

  /* ---------------- ڕێندەری لیستی سەر پەڕەکە ---------------- */

  function renderPageListHtml(list) {
    if (!list.length) {
      if (!state.markets.length) {
        return `
          <div class="card" style="padding: 32px 20px; text-align: center; border: 2px dashed #f59e0b; background: rgba(245, 158, 11, 0.05);">
            <div style="font-size: 40px; margin-bottom: 8px;">🏪</div>
            <h3 style="margin: 0 0 8px; font-weight: 800;">هیچ داتایەکی ماڕکێت لە سەب بەیس نەهێنراوە</h3>
            <p style="color: var(--text); font-size: 0.92rem; max-width: 520px; margin: 0 auto 14px; line-height: 1.7;">
              دەتوانیت لە ڕێگەی دوگمەی «نوێکردنەوە» داتاکان بهێنیت، یان ماڕکێتی نوێ زیاد بکەیت.
            </p>
            <div style="display: flex; align-items: center; justify-content: center; gap: 10px; flex-wrap: wrap;">
              <button type="button" class="btn btn-primary" id="mkt-page-refresh-empty-btn">
                🔄 نوێکردنەوە لە سەب بەیس
              </button>
              <button type="button" class="btn btn-ghost" id="mkt-page-empty-add-btn">
                ➕ زیادکردنی ماڕکێتی نوێ
              </button>
            </div>
          </div>
        `;
      }

      return `
        <div class="card" style="padding: 30px 20px; text-align: center;">
          <div style="font-size: 32px; margin-bottom: 8px;">🔍</div>
          <div style="font-weight: 700;">هیچ ماڕکێتێک بەم گەڕانە نەدۆزرایەوە</div>
          <p style="font-size: 0.85rem; color: var(--muted); margin: 6px 0 14px;">
            تکایە نووسینی گەڕانەکەت بگۆڕە.
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

              <!-- ویندۆی پێشەوەی ماڕکێت — بە داگرتنی دەچێتە ئەپی Maps.me -->
              <div class="mkt-card-front" data-code="${UI.esc(code)}" title="داگرە بۆ بینینی لۆکەیشن لە ئەپی Maps.me">
                
                <!-- دێڕی یەکەم: #کۆدی ماڕکێت تەنیشتی ناوی ماڕکێت -->
                <div class="mkt-card-row-top">
                  <span class="mkt-card-code">#${UI.esc(code)}</span>
                  <span class="mkt-card-name">${UI.esc(name)}</span>
                  ${hasLoc ? `<span class="mkt-card-mapsme-badge">🗺️ Maps.me</span>` : `<span class="mkt-card-no-gps">بێ GPS</span>`}
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

  function bindPageEvents() {
    if (!container) return;

    // گەڕانی سەر پەڕە
    const pageSearch = $('#mkt-page-search', container);
    if (pageSearch) {
      pageSearch.addEventListener('input', e => {
        state.search = e.target.value;
        const listEl = $('#mkt-page-list-container', container);
        if (listEl) {
          listEl.innerHTML = renderPageListHtml(getFilteredMarkets(state.search));
          bindPageListActions(listEl);
        }
        const clrBtn = $('#mkt-page-search-clear', container);
        if (clrBtn) clrBtn.style.display = state.search ? 'flex' : 'none';
      });
    }

    const clearPageSearch = $('#mkt-page-search-clear', container);
    if (clearPageSearch) {
      clearPageSearch.addEventListener('click', () => {
        state.search = '';
        renderLayout();
      });
    }

    // دوگمەکانی سەرووی پەڕە
    const newBtn = $('#mkt-page-new-btn', container);
    if (newBtn) newBtn.addEventListener('click', () => openAddEditModal());

    const refreshBtn = $('#mkt-page-refresh-btn', container);
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        UI.toast('نوێکردنەوە لە سەب بەیس...', 'info', 1500);
        await loadData(true);
        renderLayout();
        UI.toast('داتاکان لە سەب بەیس نوێکرانەوە ✓', 'success');
      });
    }

    const emptyAddBtn = $('#mkt-page-empty-add-btn', container);
    if (emptyAddBtn) emptyAddBtn.addEventListener('click', () => openAddEditModal());

    const emptyRefreshBtn = $('#mkt-page-refresh-empty-btn', container);
    if (emptyRefreshBtn) {
      emptyRefreshBtn.addEventListener('click', async () => {
        UI.toast('هێنانی ماڕکێتەکان لە سەب بەیس...', 'info', 1500);
        await loadData(true);
        renderLayout();
        if (state.markets.length) {
          UI.toast(`${UI.fmtNum(state.markets.length)} ماڕکێت لە سەب بەیس هێنرا ✓`, 'success', 3500);
        }
      });
    }

    const clearSearchLink = $('#mkt-page-clear-search-link', container);
    if (clearSearchLink) {
      clearSearchLink.addEventListener('click', () => {
        state.search = '';
        renderLayout();
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
    // دەستکاری تۆمار
    root.querySelectorAll('[data-action="edit-mkt"]').forEach(btn => {
      const handler = e => {
        e.stopPropagation();
        closeActiveCard();
        const code = btn.getAttribute('data-code');
        const market = state.markets.find(m => String(m.account_code) === String(code));
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

    // بەڕێوەبردنی ڕاکێشان (Swipe) و داگرتنی ویندۆ بۆ ئەپی Maps.me
    root.querySelectorAll('.mkt-swipe-item').forEach(item => {
      const front = item.querySelector('.mkt-card-front');
      const code = item.getAttribute('data-code');
      const market = state.markets.find(m => String(m.account_code) === String(code));
      if (!front) return;

      let startX = 0;
      let startY = 0;
      let isDragging = false;
      let isHorizontal = false;
      let initialOffset = 0;
      let pointerId = null;

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
        isDragging = false;
        isHorizontal = false;
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
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        if (!isHorizontal) {
          if (Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy)) {
            isHorizontal = true;
          } else if (Math.abs(dy) > 8) {
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

        if (isDragging) {
          const finalX = initialOffset + totalDx;
          const threshold = maxReveal * 0.28;

          // کاتێک بۆ لای چەپ دەبرێت (finalX < -threshold)
          // ویندۆکە بە قەبارەی دوگمەکان دەچێتە چەپ و دوگمەکانی لای ڕاست دەردەکەون
          if (finalX < -threshold) {
            front.style.transform = `translateX(-${maxReveal}px)`;
            front.dataset.offset = -maxReveal;
            front.classList.add('is-open');
            activeOpenCard = front;
          }
          // کاتێک بۆ لای ڕاست دەبرێت (finalX > threshold)
          // ویندۆکە بە قەبارەی دوگمەکان دەچێتە ڕاست و دوگمەکانی لای چەپ دەردەکەون
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
        } else {
          // داگرتنی ئاسایی (Tap)
          if (front.classList.contains('is-open')) {
            front.style.transform = '';
            delete front.dataset.offset;
            front.classList.remove('is-open');
            activeOpenCard = null;
          } else {
            // ڕاستەوخۆ دەچێتە ئەپی Maps.me
            openInMapsMe(market);
          }
        }
      };

      front.addEventListener('pointerdown', onPointerDown);
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

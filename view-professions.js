/* =========================================================
 *  فۆڕمی پیشە — دروستکردنی پیشەی نوێ و کۆنترۆڵی دەسەڵاتەکان
 *  دوو بەش: پیشەکان + یوسەرەکان
 *  هەر تایبەتمەندییەکی سیستەم بە ئۆپشنە بۆ هەر پیشەیەک و هەر یوسەرێک
 * ========================================================= */

const ProfessionsView = (() => {
  const $ = (sel, root) => (root || document).querySelector(sel);

  let container = null;
  let refreshTimer = null;
  const state = { subtab: 'professions', userSearch: '' };

  const BUILTIN = [
    CONFIG.PROFESSION_DRIVER,
    CONFIG.PROFESSION_DISTRIBUTOR,
    CONFIG.PROFESSION_DELEGATE,
    CONFIG.PROFESSION_SUPERVISOR,
    CONFIG.PROFESSION_ASSISTANT,
  ];

  /* ---------------- ڕێندەری سەرەکی ---------------- */

  function render(el) {
    container = el;
    el.innerHTML = `
      <section class="card" style="padding:14px 18px 12px">
        <div class="admin-header-row">
          <div>
            <h2 class="hero-title">👔 پیشەکان و دەسەڵاتەکان</h2>
            <p class="hero-sub">دروستکردنی پیشەی نوێ و دیاریکردنی ئەوەی هەر پیشەیەک و هەر یوسەرێک چی ببینێت و چ ئەنجام بدات</p>
          </div>
          <button class="btn btn-ghost btn-sm" id="prf-refresh">⟳ نوێکردنەوە</button>
        </div>

        <div class="admin-tabs" id="prf-subtabs">
          <button type="button" class="admin-tab-btn ${state.subtab === 'professions' ? 'active' : ''}" data-sub="professions">
            <span>👔</span> پیشەکان
          </button>
          <button type="button" class="admin-tab-btn ${state.subtab === 'users' ? 'active' : ''}" data-sub="users">
            <span>👤</span> یوسەرەکان
          </button>
        </div>
      </section>

      <div id="prf-content"></div>`;

    el.querySelectorAll('.admin-tab-btn').forEach(b => {
      b.addEventListener('click', () => {
        state.subtab = b.dataset.sub;
        el.querySelectorAll('.admin-tab-btn').forEach(x => x.classList.toggle('active', x.dataset.sub === state.subtab));
        renderContent();
      });
    });
    $('#prf-refresh', el).addEventListener('click', async e => {
      const btn = e.currentTarget;
      UI.btnLoading(btn, true, '...');
      try {
        await Store.loadLists(true);
        renderContent();
        UI.toast('لیستەکە نوێکرایەوە ✓', 'success');
      } catch (err) {
        UI.toast('هەڵە لە نوێکردنەوە: ' + err.message, 'error', 4200);
      } finally {
        UI.btnLoading(btn, false);
      }
    });

    renderContent();
  }

  function stop() { if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; } }

  function renderContent() {
    const wrap = $('#prf-content', container);
    if (!wrap) return;
    wrap.innerHTML = `<div class="skeleton-block"><div class="sk sk-card"></div><div class="sk sk-card"></div></div>`;
    Store.loadLists()
      .then(ls => {
        if (state.subtab === 'professions') renderProfessionsTab(wrap, ls);
        else renderUsersTab(wrap, ls);
      })
      .catch(err => {
        wrap.innerHTML = `<div class="empty-state"><div class="empty-ico">⚠️</div><p>هەڵە لە هێنانی داتا: ${UI.esc(err.message)}</p></div>`;
      });
  }

  /* ---------------- بەشی پیشەکان ---------------- */

  function renderProfessionsTab(wrap, ls) {
    const users = ls.users || [];
    const customs = Store.getCustomProfessions();
    const profs = Perms.allProfessions(users);
    const countOf = p => users.filter(u => u.profession === p).length;

    wrap.innerHTML = `
      <section class="card" style="padding:14px 18px 12px">
        <div class="admin-header-row" style="margin-bottom:4px">
          <h3 style="font-size:0.96rem">لیستی پیشەکان</h3>
          <button type="button" class="btn btn-primary btn-sm" id="prf-add-btn">➕ پیشەی نوێ</button>
        </div>
        <p class="hint" style="margin:0">کلیک لەسەر «دەسەڵاتەکان» بکە بۆ دیاریکردنی ئەوەی ئەم پیشەیە چی ببینێت و چ کردار ئەنجام بدات. بە دوگمەی 🗑 پیشەیەک دەسڕدرێتەوە یان دەشاردرێتەوە — بە هەمان ناو لە «پیشەی نوێ» دەگەڕێتەوە. گۆڕانکارییەکان بۆ هەموو مۆبایلەکان جێبەجێ دەبن پاش نوێبوونەوەی سیستەم.</p>
      </section>
      <div class="prf-list">
        ${profs.map(p => professionCardHtml(p, customs, countOf(p))).join('')}
      </div>`;

    $('#prf-add-btn', wrap).addEventListener('click', openAddProfessionModal);
    wrap.querySelectorAll('.prf-card').forEach(card => {
      const prof = card.dataset.prof;
      card.querySelector('.prf-perms-btn')?.addEventListener('click', () => openPermsEditor({ prof }));
      card.querySelector('.prf-del-btn')?.addEventListener('click', () => deleteProfession(prof));
    });
  }

  function professionCardHtml(prof, customs, userCount) {
    const isSup = Perms.isSup({ profession: prof });
    const isCustom = customs.includes(prof);
    return `
      <div class="card prf-card" data-prof="${UI.esc(prof)}">
        <div class="prf-card-head">
          <div class="prf-card-info">
            <b>${UI.esc(prof)}</b>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px">
              ${isSup ? '<span class="chip" style="background:color-mix(in srgb,var(--accent) 15%,transparent);color:var(--accent)">دەسەڵاتی تەواو — نەگۆڕاو</span>' : ''}
              ${isCustom ? '<span class="chip">زیادکراو</span>' : ''}
              <span class="chip">${UI.fmtNum(userCount)} یوسەر</span>
            </div>
          </div>
          <div style="display:flex;gap:6px">
            ${isSup ? '' : `
              <button type="button" class="btn btn-ghost btn-sm prf-perms-btn">🔐 دەسەڵاتەکان</button>
              <button type="button" class="btn btn-ghost btn-sm prf-del-btn" title="${isCustom ? 'سڕینەوەی پیشەکە' : 'شاردنەوەی پیشە بنەڕەتییەکە'}">🗑</button>`}
          </div>
        </div>
      </div>`;
  }

  function openAddProfessionModal() {
    const body = document.createElement('div');
    body.innerHTML = `
      <form novalidate>
        <div class="field">
          <label>ناوی پیشەی نوێ *</label>
          <input type="text" id="npf-name" placeholder="بۆ نموونە: ژمێریار" autocomplete="off">
        </div>
        <p class="hint">پیشەی نوێ بنەڕەتی مینیمالی هەیە (ڕاپۆرتی خۆی، پەیوەندی و ڕێکخستن). پاش دروستکردن دەتوانیت دەسەڵاتەکانی زیاد بکەیت و لە پانێلی بەڕێوەبردن پیشەکە بدەیت بە یوسەر. <b>ئەگەر ناوێک بنووسیت کە پێشتر سڕدراوەتەوە، پیشەکە دەگەڕێتەوە.</b></p>
      </form>`;
    const modal = UI.openModal({
      title: '➕ پیشەی نوێ',
      body,
      actions: [
        { label: 'پاشگەزبوونەوە', className: 'btn-ghost', onClick: () => modal.close() },
        {
          label: 'دروستکردن', className: 'btn-primary', onClick: async () => {
            const input = $('#npf-name', body);
            const name = (input.value || '').trim();
            if (!name) { input.classList.add('invalid'); return; }
            let users = [];
            try { users = (await Store.loadLists()).users || []; } catch (_) {}
            const existing = Perms.allProfessions(users);
            if (existing.some(p => UI.norm(p) === UI.norm(name))) {
              UI.toast('پیشەیەک بەم ناوە پێشتر هەیە', 'warning');
              return;
            }
            try {
              // ئەگەر پیشەیەکی سڕدراوە بە هەمان ناو بوو — تەنها بگەڕێنرێتەوە
              const deleted = Perms.getDeletedProfessions();
              if (deleted.some(p => UI.norm(p) === UI.norm(name))) {
                const cfg = JSON.parse(JSON.stringify(Store.getPermsConfig()));
                cfg.deleted = (cfg.deleted || []).filter(p => UI.norm(p) !== UI.norm(name));
                await Store.savePermsConfig(cfg);
                UI.toast(`پیشەی «${name}» گەڕایەوە لیستەکە ✓`, 'success');
                modal.close();
                renderContent();
                return;
              }
              await Store.addProfession(name);
              UI.toast(`پیشەی «${name}» دروستکرا ✓`, 'success');
              modal.close();
              renderContent();
            } catch (err) {
              UI.toast('هەڵە لە دروستکردنی پیشە: ' + err.message, 'error', 4200);
            }
          }
        },
      ],
    });
    setTimeout(() => $('#npf-name', body)?.focus(), 60);
  }

  async function deleteProfession(prof) {
    try {
      const ls = await Store.loadLists();
      const used = (ls.users || []).some(u => u.profession === prof);
      if (used) {
        UI.toast('ناتوانرێت پیشەیەک بسڕدرێتەوە کە هێشتا یوسەری تێدایە — سەرەتا پیشەی یوسەرەکان بگۆڕە', 'warning', 4500);
        return;
      }
      const isCustom = Store.getCustomProfessions().includes(prof);
      const ok = await UI.confirmDialog(
        isCustom
          ? `دڵنیاییت لە سڕینەوەی پیشەی «${prof}»؟`
          : `«${prof}» پیشەیەکی بنەڕەتی سیستەمە — دەشاردرێتەوە لە هەموو لیستەکاندا. دواتر بە هەمان ناو لە «پیشەی نوێ» دەگەڕێتەوە. دڵنیاییت؟`,
        { danger: true, okLabel: 'بەڵێ، بسڕەوە', cancelLabel: 'پاشگەزبوونەوە' }
      );
      if (!ok) return;

      const cfg = JSON.parse(JSON.stringify(Store.getPermsConfig()));
      if (isCustom) {
        // پیشەی زیادکراو — ڕیزەکە لە خشتەی professions دەسڕدرێتەوە
        const { names } = await API.Professions.all();
        const row = (names || []).find(r => r.profession === prof);
        if (!row) { UI.toast('ئەم پیشەیە لە خشتەکەدا نییە', 'warning'); renderContent(); return; }
        await Store.removeProfession(row.id, prof);
      } else {
        // پیشەی بنەڕەتی — لە کۆنفیگەکەدا دەشاودەکرێت (دووبارە گەڕانەوە بە هەمان ناو)
        cfg.deleted = cfg.deleted || [];
        if (!cfg.deleted.includes(prof)) cfg.deleted.push(prof);
      }
      // سڕینەوەی دەسەڵاتەکانییش ئەم پیشەیە
      if (cfg.professions && cfg.professions[prof]) delete cfg.professions[prof];
      await Store.savePermsConfig(cfg);
      UI.toast(isCustom ? `پیشەی «${prof}» سڕدرایەوە ✓` : `پیشەی «${prof}» شاردرایەوە ✓`, 'success');
      renderContent();
    } catch (err) {
      UI.toast('هەڵە لە سڕینەوە: ' + err.message, 'error', 4200);
    }
  }

  /* ---------------- بەشی یوسەرەکان ---------------- */

  function renderUsersTab(wrap, ls) {
    const users = ls.users || [];
    const cfg = Store.getPermsConfig();
    const q = UI.norm(state.userSearch);
    const list = users
      .filter(u => !q || [u.username, u.profession].some(v => UI.norm(v).includes(q)))
      .sort((a, b) => String(a.username).localeCompare(String(b.username), 'ckb'));

    wrap.innerHTML = `
      <section class="card" style="padding:14px 18px 12px">
        <h3 style="font-size:0.96rem;margin-bottom:8px">یوسەرەکان</h3>
        <div class="field" style="margin-bottom:0">
          <input type="search" id="prf-user-search" placeholder="گەڕان بۆ ناو یان پیشە..." value="${UI.esc(state.userSearch)}" autocomplete="off">
        </div>
        <p class="hint" style="margin:6px 0 0">بە دوگمەی 👁 دەتوانیت بۆ هەر یوسەرێک چالاک بکەیت کە جگە لە داتای خۆی، داتای یوسەرانی تریش ببینێت لە ڕاپۆرتدا. هەروەها بە 🔐 دەسەڵاتی تەواویش دەتوانیت گۆڕیتی بکەیت. ئەوانەی جیاوازییان هەیە بە نیشانە کراون.</p>
      </section>
      <div class="prf-list">
        ${list.map(u => {
          const hasOverride = !!(cfg.users && cfg.users[String(u.id)]);
          const isSupUser = Perms.isSup(u);
          const viewAll = !isSupUser && Perms.canView(u, 'rep_view_all');
          return `
          <div class="card prf-card prf-user-card clickable-row" data-uid="${UI.esc(String(u.id))}">
            ${UI.avatarHtml(u, 44)}
            <div class="prf-card-info" style="flex:1">
              <b>${UI.esc(u.username)}</b>
              <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px">
                <span class="chip">${UI.esc(u.profession || '—')}</span>
                ${viewAll ? '<span class="chip" style="background:color-mix(in srgb,var(--accent) 15%,transparent);color:var(--accent)">👁 داتای ئەوانیتر</span>' : ''}
                ${hasOverride ? '<span class="chip">🔐 جیاوازی تایبەت</span>' : ''}
              </div>
            </div>
            ${isSupUser ? '' : `
            <button type="button" class="btn btn-sm ${viewAll ? 'btn-primary' : 'btn-ghost'} prf-viewall-btn" title="بینینی داتای یوسەرانی تر لە ڕاپۆرتدا">👁 ${viewAll ? 'چالاک' : 'داتای ئەوانیتر'}</button>`}
            <button type="button" class="btn btn-ghost btn-sm prf-perms-btn">🔐 دەسەڵاتەکان</button>
          </div>`;
        }).join('') || '<div class="empty-state"><p>هیچ یوسەرێک نەدۆزرایەوە.</p></div>'}
      </div>`;

    $('#prf-user-search', wrap).addEventListener('input', e => {
      state.userSearch = e.target.value;
      renderContent();
      const inp = $('#prf-user-search', container);
      if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
    });
    wrap.querySelectorAll('.prf-user-card').forEach(card => {
      card.querySelector('.prf-perms-btn').addEventListener('click', () => {
        const u = users.find(x => String(x.id) === card.dataset.uid);
        if (u) openPermsEditor({ user: u });
      });
      // دوگمەی خێرا — بینینی داتای یوسەرانی تر (rep_view_all)
      card.querySelector('.prf-viewall-btn')?.addEventListener('click', async e => {
        const btn = e.currentTarget;
        const u = users.find(x => String(x.id) === card.dataset.uid);
        if (!u) return;
        const next = !Perms.canView(u, 'rep_view_all');
        UI.btnLoading(btn, true, '...');
        try {
          const cfg = JSON.parse(JSON.stringify(Store.getPermsConfig()));
          cfg.users = cfg.users || {};
          const entry = cfg.users[String(u.id)] = cfg.users[String(u.id)] || { view: {}, act: {} };
          entry.view = entry.view || {};
          entry.act = entry.act || {};
          // پاککردنەوە — ئەگەر نرخە نوێیەکە هەمان نرخی پیشەکەیەتی، جیاوازییەکە لاببە
          const profLevel = Perms.effective(u.profession, undefined, 'view', 'rep_view_all');
          if (next === profLevel) delete entry.view.rep_view_all;
          else entry.view.rep_view_all = next;
          if (!Object.keys(entry.view).length && !Object.keys(entry.act).length) delete cfg.users[String(u.id)];
          await Store.savePermsConfig(cfg);
          UI.toast(next
            ? `ئێستا ${u.username} داتای یوسەرانی تریش دەبینێت لە ڕاپۆرتدا ✓`
            : `ئێستا ${u.username} تەنها داتای خۆی دەبینێت ✓`, 'success');
          renderContent();
        } catch (err) {
          UI.toast('هەڵە: ' + err.message, 'error', 4200);
        } finally {
          UI.btnLoading(btn, false);
        }
      });
    });
  }

  /* ---------------- ئێدیتەری دەسەڵاتەکان ---------------- */

  // ئێدیتەر بۆ پیشە: { prof } — بۆ یوسەر: { user }
  function openPermsEditor({ prof = null, user = null }) {
    const isUserMode = !!user;
    const targetProf = isUserMode ? user.profession : prof;
    const title = isUserMode ? `🔐 دەسەڵاتەکانی ${user.username}` : `🔐 دەسەڵاتەکانی پیشەی ${prof}`;

    const body = document.createElement('div');
    body.innerHTML = `
      ${isUserMode ? `<p class="hint" style="margin-top:0">پیشە: <b>${UI.esc(targetProf || '—')}</b> — نرخەکانی ئێرە لەسەر دەسەڵاتی پیشەکە جێبەجێ دەبن.</p>` : ''}
      <div class="prf-perms-grid">
        ${Perms.GROUPS.map(g => `
          <div class="prf-perm-group">
            <div class="prf-perm-group-head">
              <b>${g.label}</b>
              <span style="font-size:0.68rem;color:var(--muted)">بینین = 👁 • کردار = ⚡</span>
            </div>
            <div class="prf-perm-rows">
              ${Perms.FEATURES.filter(f => f.group === g.key).map(f => {
                const val = Perms.effective(targetProf, isUserMode ? user.id : undefined, f.type, f.key);
                const tag = f.type === 'view' ? '👁' : '⚡';
                return `
                <label class="prf-perm-row">
                  <input type="checkbox" data-type="${f.type}" data-key="${f.key}" ${val ? 'checked' : ''}>
                  <span class="prf-perm-label"><span class="prf-perm-tag">${tag}</span> ${UI.esc(f.label)}</span>
                </label>`;
              }).join('')}
            </div>
          </div>`).join('')}
      </div>`;

    const modal = UI.openModal({
      title,
      wide: true,
      body,
      actions: [
        { label: 'پاشگەزبوونەوە', className: 'btn-ghost', onClick: () => modal.close() },
        {
          label: isUserMode ? '🗑 سڕینەوەی جیاوازی' : '⟲ گەڕانەوە بۆ بنەڕەت', className: 'btn-ghost', onClick: async () => {
            const ok = await UI.confirmDialog(
              isUserMode
                ? 'جیاوازییە تایبەتییەکانی ئەم یوسەرە دەسڕدرێتەوە و دەسەڵاتەکانی بەپێی پیشەکەی دەبێت. دڵنیاییت؟'
                : `هەموو دەسەڵاتەکانی پیشەی «${prof}» دەگەڕێنرێتەوە بنەڕەتی سیستەم. دڵنیاییت؟`,
              { danger: true, okLabel: 'بەڵێ', cancelLabel: 'نەخێر' }
            );
            if (!ok) return;
            try {
              const cfg = Store.getPermsConfig();
              if (isUserMode) {
                if (cfg.users) delete cfg.users[String(user.id)];
              } else {
                if (cfg.professions) delete cfg.professions[prof];
              }
              await Store.savePermsConfig(cfg);
              UI.toast('گەڕایەوە بنەڕەت ✓', 'success');
              modal.close();
              renderContent();
            } catch (err) {
              UI.toast('هەڵە: ' + err.message, 'error', 4200);
            }
          }
        },
        {
          label: '💾 پاشەکەوتکردن', className: 'btn-primary', onClick: async () => {
            const view = {}, act = {};
            body.querySelectorAll('input[type="checkbox"]').forEach(cb => {
              const t = cb.dataset.type, k = cb.dataset.key;
              if (t === 'view') view[k] = cb.checked;
              else if (t === 'act') act[k] = cb.checked;
            });
            const entry = { view, act };
            try {
              const cfg = JSON.parse(JSON.stringify(Store.getPermsConfig()));
              if (isUserMode) {
                cfg.users = cfg.users || {};
                cfg.users[String(user.id)] = entry;
              } else {
                cfg.professions = cfg.professions || {};
                cfg.professions[prof] = entry;
              }
              await Store.savePermsConfig(cfg);
              UI.toast('دەسەڵاتەکان پاشەکەوت کران ✓', 'success');
              modal.close();
              renderContent();
            } catch (err) {
              UI.toast('هەڵە لە پاشەکەوتکردن: ' + err.message, 'error', 4200);
            }
          }
        },
      ],
    });
  }

  return { render, stop };
})();

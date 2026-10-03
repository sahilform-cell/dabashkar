/* =========================================================
 *  دەسەڵاتەکان — بینین و کردارەکان بەپێی پیشە و یوسەر
 *  هەر تایبەتمەندییەکی سیستەم ئۆپشنە بۆ هەر پیشەیەک و هەر یوسەرێک
 * ========================================================= */

const Perms = (() => {

  const isSup = u => !!u && (u.profession === CONFIG.PROFESSION_SUPERVISOR || u.profession === 'بەڕێوبەر' || u.profession === 'بەریوبەر');

  /* ---------------- لیستی تایبەتمەندییەکان ----------------
   * type: 'view' = دەیبینێت — 'act' = دەتوانێت ئەنجامی بدات
   * group: بۆ ڕێکخستنی لە فۆڕمی پیشەکاندا
   * -------------------------------------------------------- */
  const FEATURES = [
    // بینینی فۆڕمەکان (تابەکان) — icon: ناوی ئایکۆنی SVG (UI.icon)
    { group: 'tabs', key: 'tab_driver',    icon: 'truck',  label: 'فۆڕمی کارەکان',          type: 'view' },
    { group: 'tabs', key: 'tab_reports',   icon: 'chart',  label: 'فۆڕمی ڕاپۆرت',           type: 'view' },
    { group: 'tabs', key: 'tab_contacts',  icon: 'phone',  label: 'فۆڕمی پەیوەندی',         type: 'view' },
    { group: 'tabs', key: 'tab_admin',     icon: 'shield', label: 'پانێلی بەڕێوەبردن',      type: 'view' },
    { group: 'tabs', key: 'tab_settings',  icon: 'gear',   label: 'فۆڕمی ڕێکخستن',          type: 'view' },

    // کردارەکانی گەشت
    { group: 'trip', key: 'act_exit',      icon: 'truck',  label: 'تۆمارکردنی دەرچوون (فۆڕمی دەرچوون)', type: 'act' },
    { group: 'trip', key: 'act_in_zone',   icon: 'enter',  label: 'کرداری گەیشتن بە ناو زۆن', type: 'act' },
    { group: 'trip', key: 'act_out_zone',  icon: 'exit',   label: 'کرداری دەرچوون لە زۆن',   type: 'act' },
    { group: 'trip', key: 'act_arrival',   icon: 'flag',   label: 'کرداری گەشتنەوە',        type: 'act' },
    { group: 'trip', key: 'act_money',     icon: 'coins',  label: 'تۆمارکردنی پارەی هێنراوە', type: 'act' },
    { group: 'trip', key: 'act_edit_data', icon: 'edit',   label: 'دەستکاریکردنی داتاکان',   type: 'act' },

    // ڕاپۆرت
    { group: 'reports', key: 'rep_view_all',       icon: 'folder', label: 'بینینی هەموو تۆمارەکان (نەک تەنها تۆمارەکانی خۆی)', type: 'view' },
    { group: 'reports', key: 'rep_filter_driver',  icon: 'user',   label: 'فلتەری شۆفێر',           type: 'view' },
    { group: 'reports', key: 'rep_filter_out_zone', icon: 'exit',  label: 'فلتەری دەرێی زۆن',       type: 'view' },
    { group: 'reports', key: 'rep_filter_arrival', icon: 'flag',   label: 'فلتەری گەشتنەوە',        type: 'view' },
    { group: 'reports', key: 'rep_filter_second',  icon: 'package', label: 'فلتەری تەنها باری دووەم', type: 'view' },
    { group: 'reports', key: 'rep_edit',           icon: 'edit',   label: 'دەستکاریکردنی تۆمار',    type: 'act' },
    { group: 'reports', key: 'rep_delete',         icon: 'trash',  label: 'سڕینەوەی تۆمار',         type: 'act' },

    // پانێلی بەڕێوەبردن — بەشەکان
    { group: 'admin', key: 'admin_records', icon: 'truck', label: 'بەشی تۆمارەکان',   type: 'view' },
    { group: 'admin', key: 'admin_users',   icon: 'users', label: 'بەشی بەکارهێنەران', type: 'view' },
    { group: 'admin', key: 'admin_zones',   icon: 'map',   label: 'بەشی زۆنەکان',     type: 'view' },

    // ڕێکخستن و ئەوانیتر
    { group: 'settings', key: 'set_font',      icon: 'type',       label: 'ڕێکخستنی فۆنت و قەبارەی نووسین', type: 'view' },
    { group: 'settings', key: 'set_keypad',    icon: 'keyboard',   label: 'ڕێکخستنی کیبۆردی تایبەتی',  type: 'view' },
    { group: 'settings', key: 'set_lockscreen', icon: 'smartphone', label: 'ڕێکخستنی شاشەی قفڵ',       type: 'view' },
    { group: 'settings', key: 'set_notif',     icon: 'bell',       label: 'ڕێکخستنی نۆتیفیکەیشنەکان', type: 'view' },
    { group: 'settings', key: 'set_print',     icon: 'printer',    label: 'ناوەڕۆکی پرێنتکردن',       type: 'view' },
    { group: 'settings', key: 'set_backup',    icon: 'database',   label: 'باکئەپی خۆکار',            type: 'view' },
    { group: 'settings', key: 'notif_bell',    icon: 'bell',       label: 'زەنگی نۆتیفیکەیشن لە سەرپەڕ', type: 'view' },
  ];

  const GROUPS = [
    { key: 'tabs',     label: '🧭 بینینی فۆڕمەکان' },
    { key: 'trip',     label: '🚚 کردارەکانی گەشت' },
    { key: 'reports',  label: '📊 ڕاپۆرت' },
    { key: 'admin',    label: '🛡️ پانێلی بەڕێوەبردن' },
    { key: 'settings', label: '⚙️ ڕێکخستن و ئەوانیتر' },
  ];

  /* ---------------- بنەڕەتەکان — هەمان ڕەفتاری ئێستای سیستەم ---------------- */

  const P = CONFIG.PROFESSION_DRIVER;
  const D = CONFIG.PROFESSION_DISTRIBUTOR;
  const DL = CONFIG.PROFESSION_DELEGATE;
  const A = CONFIG.PROFESSION_ASSISTANT;

  const DEFAULTS = {
    [P]: {
      view: { tab_driver: true, tab_reports: true, tab_contacts: true, tab_settings: true, rep_filter_second: true },
      act: { act_exit: true, act_in_zone: true, act_out_zone: true, act_arrival: true, act_money: true, act_edit_data: true },
    },
    [D]: {
      view: { tab_driver: true, tab_reports: true, tab_contacts: true, tab_settings: true, rep_filter_second: true },
      act: { act_exit: true, act_in_zone: true, act_out_zone: true, act_arrival: true, act_money: true, act_edit_data: true },
    },
    // مەندوب — تەنها ڕاپۆرتی خۆی و پەیوەندی و ڕێکخستن (دەکرێت لە فۆڕمی پیشە چالاک بکرێت بۆ زیاتر)
    [DL]: {
      view: { tab_reports: true, tab_contacts: true, tab_settings: true },
      act: {},
    },
    // یاریدەدەر — وەک سایەق + فلتەرەکانی گەشت + زەنگی نۆتیفیکەیشن
    [A]: {
      view: { tab_driver: true, tab_reports: true, tab_contacts: true, tab_settings: true, rep_filter_out_zone: true, rep_filter_arrival: true, notif_bell: true },
      act: { act_exit: true, act_in_zone: true, act_out_zone: true, act_arrival: true, act_money: true, act_edit_data: true },
    },
  };

  // بنەڕەت بۆ پیشەی نوێ دروستکراو — مینیمال، بەڕێوەبەر خۆی زیاد دەکات
  const NEW_DEFAULT = {
    view: { tab_reports: true, tab_contacts: true, tab_settings: true },
    act: {},
  };

  const defaultsFor = prof => DEFAULTS[prof] || NEW_DEFAULT;

  /* ---------------- پشکنینی دەسەڵات ----------------
   * ڕیزبەندی: بەڕێوەبەر (هەمیشە هەموو شت) ← یوسەر override ← پیشە override ← بنەڕەت
   * ------------------------------------------------ */
  function can(u, type, key) {
    if (!u) return false;
    if (isSup(u)) return true;
    const cfg = Store.getPermsConfig();
    const uv = cfg.users && cfg.users[String(u.id)] && cfg.users[String(u.id)][type];
    if (uv && uv[key] !== undefined) return !!uv[key];
    const pv = cfg.professions && cfg.professions[u.profession] && cfg.professions[u.profession][type];
    if (pv && pv[key] !== undefined) return !!pv[key];
    return !!(defaultsFor(u.profession)[type] && defaultsFor(u.profession)[type][key]);
  }

  const canView = (u, key) => can(u, 'view', key);
  const canAct = (u, key) => can(u, 'act', key);

  /** نرخە کۆتایییەکە کە لە ئێدیتەردا پیشان دەدرێت */
  function effective(prof, userId, type, key) {
    const cfg = Store.getPermsConfig();
    if (userId !== undefined && userId !== null) {
      const uc = cfg.users && cfg.users[String(userId)];
      if (uc && uc[type] && uc[type][key] !== undefined) return !!uc[type][key];
    }
    const pc = cfg.professions && cfg.professions[prof];
    if (pc && pc[type] && pc[type][key] !== undefined) return !!pc[type][key];
    return !!(defaultsFor(prof)[type] && defaultsFor(prof)[type][key]);
  }

  /** پیشە سڕدراوەکان (بنەڕەتییە شاردراوەکان) لە کۆنفیگەکەوە */
  function getDeletedProfessions() {
    const cfg = Store.getPermsConfig();
    return Array.isArray(cfg.deleted) ? cfg.deleted : [];
  }

  /** هەموو پیشەکان — بنەڕەتی + خشتەی professions + ئەوانەی لە یوسەرەکاندا هەن — جگە لە سڕدراوەکان */
  function allProfessions(users) {
    const deleted = getDeletedProfessions();
    const set = [];
    const push = p => { if (p && !set.includes(p) && !deleted.includes(p)) set.push(p); };
    [P, D, DL, CONFIG.PROFESSION_SUPERVISOR, A].forEach(push);
    (Store.getCustomProfessions() || []).forEach(push);
    (users || []).forEach(u => push(u.profession));
    return set;
  }

  /** ئیمزای دەسەڵاتەکانی یوسەرێک — بۆ دۆزینەوەی ئەوەی ئایا دەسەڵاتەکانی گۆڕاون */
  const signatureFor = u => FEATURES.map(f => (can(u, f.type, f.key) ? 1 : 0)).join('');

  return { FEATURES, GROUPS, isSup, canView, canAct, can, defaultsFor, effective, allProfessions, getDeletedProfessions, signatureFor, NEW_DEFAULT };
})();

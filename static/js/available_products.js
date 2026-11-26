(function () {
  document.addEventListener('DOMContentLoaded', function () {
    const root = document.getElementById('available-products-dropdown');
    if (!root) return;

    const search = document.getElementById('productSearch');
    const sort = document.getElementById('productSort');
    const dir = document.getElementById('productDir');
    const list = document.getElementById('productResults');
    const info = document.getElementById('productPageInfo');
    const prev = document.getElementById('productPrev');
    const next = document.getElementById('productNext');

    const xchID = root.dataset.xchId;
    const limit = 50;
    let offset = 0;
    let total = 0;
    let debounce = null;
    let requestSeq = 0;

    function message(text) {
      list.textContent = '';
      const div = document.createElement('div');
      div.className = 'text-secondary px-2 py-1';
      div.textContent = text;
      list.appendChild(div);
    }

    function returnQuery() {
      return ['selected_index', 'product_index', 'timeframe_index']
        .map(k => `${k}=${encodeURIComponent(root.dataset[k] || '0')}`)
        .join('&');
    }

    function renderProduct(p) {
      const row = document.createElement('div');
      row.className = 'dropdown-item bg-dark text-white-50 product-item p-0';

      const form = document.createElement('form');
      form.method = 'POST';
      form.action = `/add-to-watchlist?${returnQuery()}`;

      const xch = document.createElement('input');
      xch.type = 'hidden';
      xch.name = 'xch_id';
      xch.value = xchID;

      const product = document.createElement('input');
      product.type = 'hidden';
      product.name = 'product_id';
      product.value = p.product_id || '';

      const button = document.createElement('button');
      button.type = 'submit';
      button.className = 'btn btn-sm btn-dark w-100 text-start';
      button.title = [
        `ID: ${p.product_id || ''}`,
        `Base: ${p.base_name || ''}`,
        `Quote: ${p.quote_name || ''}`,
        `Status: ${p.status || ''}`,
        `Price: ${p.price || ''}`,
        `24h Volume: ${p.volume_24 || ''}`,
        `Base currency: ${p.base_currency_id || ''}`,
        `Quote currency: ${p.quote_currency_id || ''}`
      ].join('\n');

      if (p.in_watchlist) {
        button.disabled = true;
        button.textContent = `${p.product_id} ✓ in watchlist`;
      } else {
        button.textContent = `${p.product_id} | vol ${p.volume_24 || '0'} | ${p.price || ''}`;
      }

      form.append(xch, product, button);
      row.appendChild(form);
      return row;
    }

    async function load() {
      const seq = ++requestSeq;
      const params = new URLSearchParams({
        xch_id: xchID,
        q: search.value.trim(),
        sort: sort.value,
        dir: dir.value,
        limit: String(limit),
        offset: String(offset)
      });

      message('Loading…');
      try {
        const res = await fetch('/available-products?' + params.toString());
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const payload = await res.json();
        if (seq !== requestSeq) return; // discard stale search response

        total = payload.total || 0;
        const products = payload.products || [];

        list.textContent = '';
        if (!products.length) {
          message('No products found');
        } else {
          products.forEach(p => list.appendChild(renderProduct(p)));
        }

        const start = total === 0 ? 0 : offset + 1;
        const end = Math.min(offset + products.length, total);
        info.textContent = `${start}–${end} of ${total}`;
        prev.disabled = offset === 0;
        next.disabled = offset + products.length >= total;
      } catch (err) {
        if (seq !== requestSeq) return;
        message('Failed to load products');
        if (typeof showToast === 'function') showToast('Failed to load available products');
      }
    }

    search.addEventListener('input', function () {
      clearTimeout(debounce);
      debounce = setTimeout(function () {
        offset = 0;
        load();
      }, 250);
    });

    [sort, dir].forEach(function (el) {
      el.addEventListener('change', function () {
        offset = 0;
        load();
      });
    });

    prev.addEventListener('click', function () {
      offset = Math.max(0, offset - limit);
      load();
    });

    next.addEventListener('click', function () {
      offset += limit;
      load();
    });

    // Keep the dropdown open while interacting with the search/sort controls.
    [search, sort, dir, list].forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.stopPropagation();
      });
    });

    root.addEventListener('shown.bs.dropdown', load);
  });
})();

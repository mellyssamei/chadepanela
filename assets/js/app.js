/*
  COLE AQUI O LINK DO APPS SCRIPT TERMINADO EM /exec.
  Exemplo:
  const WEB_APP_URL = 'https://script.google.com/macros/s/SEU_ID/exec';
*/
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwGvvQ2351eMTjMboe1ecoUi1fMIZHkVmSb3-mRxUH8TdVsgNXhtFLzlDxS-8zivOxx/exec';

const state = {
  products: [],
  selectedProduct: null,
  loading: false
};

const priceOrder = {
  '0 a 50': 1,
  '0 á 50': 1,
  '50 a 100': 2,
  '50 á 100': 2,
  '100 a 200': 3,
  '100 á 200': 3,
  '200 a 300': 4,
  '200 á 300': 4,
  '300+': 5,
  '300 mais': 5,
  '300 ou mais': 5
};

const els = {};

document.addEventListener('DOMContentLoaded', () => {
  cacheElements();
  bindEvents();
  loadProducts();
});

function cacheElements() {
  els.grid = document.getElementById('productsGrid');
  els.loading = document.getElementById('loadingState');
  els.error = document.getElementById('errorState');
  els.empty = document.getElementById('emptyState');
  els.counter = document.getElementById('counter');
  els.search = document.getElementById('searchInput');
  els.sort = document.getElementById('sortSelect');
  els.reload = document.getElementById('reloadBtn');
  els.copyPix = document.getElementById('copyPixBtn');
  els.pixKey = document.getElementById('pixKey');
  els.backTop = document.getElementById('backTopBtn');
  els.modal = document.getElementById('reserveModal');
  els.closeModal = document.getElementById('closeModalBtn');
  els.cancelReserve = document.getElementById('cancelReserveBtn');
  els.confirmReserve = document.getElementById('confirmReserveBtn');
  els.modalProduct = document.getElementById('modalProduct');
  els.guestName = document.getElementById('guestName');
  els.guestWhatsapp = document.getElementById('guestWhatsapp');
  els.modalError = document.getElementById('modalError');
  els.toast = document.getElementById('toast');
}

function bindEvents() {
  els.search.addEventListener('input', renderProducts);
  els.sort.addEventListener('change', renderProducts);
  els.reload.addEventListener('click', loadProducts);
  els.copyPix.addEventListener('click', copyPix);
  els.backTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  els.closeModal.addEventListener('click', closeModal);
  els.cancelReserve.addEventListener('click', closeModal);
  els.confirmReserve.addEventListener('click', confirmReservation);
  els.modal.addEventListener('click', (event) => {
    if (event.target === els.modal) closeModal();
  });
  window.addEventListener('scroll', () => {
    els.backTop.classList.toggle('show', window.scrollY > 500);
  });
}

async function loadProducts() {
  if (!isConfigured()) return;

  setLoading(true);
  showError('');

  try {
    const data = await jsonp('list');

    if (!data.success) {
      throw new Error(data.message || 'Não foi possível carregar os produtos.');
    }

    state.products = (data.produtos || []).map(product => ({
      ...product,
      reserved: product.reserved || normalizeStatus(product.status) === 'reservado'
    }));

    renderProducts();
  } catch (error) {
    showError(error.message || 'Erro ao carregar a lista de presentes.');
  } finally {
    setLoading(false);
  }
}

function renderProducts() {
  const query = normalize(els.search.value);
  const sort = els.sort.value;

  let items = [...state.products].filter(product => {
    return !query || normalize(product.produto).includes(query);
  });

  items.sort((a, b) => {
    if (sort === 'price-asc') return getPriceRank(a.faixa) - getPriceRank(b.faixa) || compareText(a.produto, b.produto);
    if (sort === 'price-desc') return getPriceRank(b.faixa) - getPriceRank(a.faixa) || compareText(a.produto, b.produto);
    return compareText(a.produto, b.produto);
  });

  els.grid.innerHTML = '';
  els.empty.hidden = items.length > 0;

  const available = state.products.filter(p => !p.reserved).length;
  const reserved = state.products.length - available;
  els.counter.textContent = `${items.length} exibidos · ${available} disponíveis · ${reserved} reservados`;

  const fragment = document.createDocumentFragment();

  items.forEach(product => {
    fragment.appendChild(createProductCard(product));
  });

  els.grid.appendChild(fragment);
}

function createProductCard(product) {
  const card = document.createElement('article');
  card.className = `productCard ${product.reserved ? 'productCard--reserved' : ''}`;

  const isValidLink = product.link && /^https?:\/\//i.test(product.link);
  const faixa = product.faixa || 'Faixa não informada';
  const status = product.reserved ? 'Reservado' : 'Disponível';

  card.innerHTML = `
    <div class="productCard__top">
      <h3>${escapeHtml(product.produto)}</h3>
      <span class="statusBadge ${product.reserved ? 'statusBadge--reserved' : 'statusBadge--available'}">${status}</span>
    </div>
    <span class="priceBadge">${escapeHtml(faixa)}</span>
    <div class="productCard__actions">
      ${isValidLink
        ? `<a href="${escapeAttribute(product.link)}" target="_blank" rel="noopener noreferrer">Ver sugestão e preço</a>`
        : `<span class="linkMissing">Link ainda não informado</span>`
      }
      <button type="button" ${product.reserved ? 'disabled' : ''}>${product.reserved ? 'Já reservado' : 'Reservar presente'}</button>
    </div>
  `;

  const reserveBtn = card.querySelector('button');
  reserveBtn.addEventListener('click', () => openModal(product));

  return card;
}

function openModal(product) {
  if (product.reserved) return;

  state.selectedProduct = product;
  els.modalProduct.textContent = product.produto;
  els.guestName.value = '';
  els.guestWhatsapp.value = '';
  setModalError('');
  els.modal.hidden = false;
  setTimeout(() => els.guestName.focus(), 80);
}

function closeModal() {
  els.modal.hidden = true;
  state.selectedProduct = null;
  setModalError('');
}

async function confirmReservation() {
  const product = state.selectedProduct;
  const nome = els.guestName.value.trim();
  const whatsapp = els.guestWhatsapp.value.trim();

  if (!product) return;

  if (!nome || !whatsapp) {
    setModalError('Preencha seu nome e WhatsApp para confirmar a reserva.');
    return;
  }

  els.confirmReserve.disabled = true;
  els.confirmReserve.textContent = 'Reservando...';
  setModalError('');

  try {
    const data = await jsonp('reserve', {
      id: product.id,
      nome,
      whatsapp
    });

    if (!data.success) {
      throw new Error(data.message || 'Não foi possível reservar este presente.');
    }

    closeModal();
    showToast('Presente reservado com sucesso.');
    await loadProducts();
  } catch (error) {
    setModalError(error.message || 'Erro ao reservar. Tente novamente.');
  } finally {
    els.confirmReserve.disabled = false;
    els.confirmReserve.textContent = 'Confirmar reserva';
  }
}

function jsonp(action, params = {}) {
  return new Promise((resolve, reject) => {
    const callbackName = `jsonpCallback_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const url = new URL(WEB_APP_URL);

    url.searchParams.set('action', action);
    url.searchParams.set('callback', callbackName);
    url.searchParams.set('_', Date.now());

    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    const script = document.createElement('script');
    let timeout;

    window[callbackName] = (data) => {
      clearTimeout(timeout);
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      clearTimeout(timeout);
      cleanup();
      reject(new Error('Não foi possível conectar à planilha. Confira o link do Apps Script.'));
    };

    timeout = setTimeout(() => {
      cleanup();
      reject(new Error('A conexão demorou demais. Tente atualizar a página.'));
    }, 15000);

    function cleanup() {
      delete window[callbackName];
      script.remove();
    }

    script.src = url.toString();
    document.body.appendChild(script);
  });
}

function isConfigured() {
  if (!WEB_APP_URL || WEB_APP_URL.includes('COLE_AQUI')) {
    setLoading(false);
    showError('Configure o link do Apps Script em assets/js/app.js, na constante WEB_APP_URL.');
    els.counter.textContent = 'Site ainda não conectado à planilha.';
    return false;
  }
  return true;
}

function setLoading(isLoading) {
  state.loading = isLoading;
  els.loading.hidden = !isLoading;
  els.reload.disabled = isLoading;
}

function showError(message) {
  els.error.hidden = !message;
  els.error.textContent = message;
}

function setModalError(message) {
  els.modalError.hidden = !message;
  els.modalError.textContent = message;
}

function copyPix() {
  const pix = els.pixKey.textContent.trim();

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(pix).then(() => showToast('Chave Pix copiada.'));
    return;
  }

  const temp = document.createElement('textarea');
  temp.value = pix;
  document.body.appendChild(temp);
  temp.select();
  document.execCommand('copy');
  temp.remove();
  showToast('Chave Pix copiada.');
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    els.toast.hidden = true;
  }, 3000);
}

function getPriceRank(value) {
  const normalized = normalizePrice(value);
  if (priceOrder[normalized]) return priceOrder[normalized];
  return 999;
}

function normalizePrice(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/r\$/g, '')
    .replace(/até/g, '0 a')
    .replace(/\s+/g, ' ');
}

function normalizeStatus(value) {
  const status = normalize(value);
  return status.includes('reserv') ? 'reservado' : 'disponivel';
}

function compareText(a, b) {
  return String(a || '').localeCompare(String(b || ''), 'pt-BR', { sensitivity: 'base' });
}

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, '&#096;');
}

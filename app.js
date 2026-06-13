/* ==========================================
   NEXUS REPARTIDOR APP - MAIN LOGIC
   Standalone delivery driver app.
   Real-time order board with Firebase Firestore.
   Project: bot-nuevo-bdf67
   ========================================== */

import {
  db, isFirebaseEnabled,
  collection, doc, getDocs, onSnapshot,
  updateDoc, query, where
} from './firebase-config.js';

// --- STATE ---
let orders = [];
let currentBizId = '';
let userRole = '';
let sessionName = '';
let ordersUnsubscribe = null;
let newOrderSound = null;
let previousOrderIds = new Set();

// --- DOM ---
const DOM = {
  modalLogin: document.getElementById('modal-login'),
  formLogin: document.getElementById('form-login'),
  loginEmail: document.getElementById('login-email'),
  loginPassword: document.getElementById('login-password'),
  loginErrorMsg: document.getElementById('login-error-msg'),
  btnTogglePass: document.getElementById('btn-toggle-pass'),

  headerSession: document.getElementById('header-session'),
  headerStats: document.getElementById('header-stats'),
  sessionName: document.getElementById('session-name'),
  sessionRole: document.getElementById('session-role'),
  btnLogout: document.getElementById('btn-logout'),

  bizFilterBar: document.getElementById('biz-filter-bar'),
  bizFilterSelect: document.getElementById('biz-filter-select'),

  colPending: document.getElementById('col-pending'),
  colTransit: document.getElementById('col-transit'),
  colCompleted: document.getElementById('col-completed'),
  countPending: document.getElementById('count-pending'),
  countTransit: document.getElementById('count-transit'),
  countCompleted: document.getElementById('count-completed'),

  statPending: document.getElementById('stat-pending'),
  statTransit: document.getElementById('stat-transit'),
  statCompleted: document.getElementById('stat-completed'),
};

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  setupLoginHandler();
  initNotificationSound();
});

function initNotificationSound() {
  // Simple beep using Web Audio API (no external file needed)
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      newOrderSound = () => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.start(); osc.stop(ctx.currentTime + 0.4);
      };
    }
  } catch (e) { /* ignore */ }
}

// ============================================================
// LOGIN
// ============================================================
function setupLoginHandler() {
  DOM.btnTogglePass?.addEventListener('click', () => {
    const isText = DOM.loginPassword.type === 'text';
    DOM.loginPassword.type = isText ? 'password' : 'text';
    DOM.btnTogglePass.innerHTML = isText ? '<i class="bx bx-show"></i>' : '<i class="bx bx-hide"></i>';
  });

  DOM.formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = DOM.loginEmail.value.trim().toLowerCase();
    const password = DOM.loginPassword.value.trim();
    DOM.loginErrorMsg.style.display = 'none';

    if (!email || !password) return;

    if (isFirebaseEnabled) {
      try {
        const q = query(collection(db, 'users'), where('email', '==', email));
        const snap = await getDocs(q);

        if (snap.empty) {
          showLoginError('Correo no registrado en el sistema.');
          return;
        }

        let authorized = false;
        snap.forEach((docSnap) => {
          const u = docSnap.data();
          const validRoles = ['repartidor', 'admin', 'owner'];
          if (validRoles.includes(u.role) && (!u.password || u.password === password)) {
            authorized = true;
            userRole = u.role;
            currentBizId = u.restaurantId || 'all';
            sessionName = u.name || email;
          }
        });

        if (authorized) {
          hideModal();
          startDeliveryConsole();
        } else {
          showLoginError('Contraseña incorrecta o sin privilegios de repartidor.');
        }
      } catch (err) {
        showLoginError(`Error de conexión: ${err.message}`);
      }
    } else {
      // Local fallback accounts
      const localAccounts = [
        { email: 'reparto@nexus.com', password: 'reparto123', role: 'repartidor', bizId: 'all', name: 'Repartidor Demo' },
        { email: 'admin@nexus.com', password: 'admin123', role: 'admin', bizId: 'all', name: 'Admin Demo' },
      ];
      const found = localAccounts.find(a => a.email === email && a.password === password);
      if (found) {
        userRole = found.role; currentBizId = found.bizId; sessionName = found.name;
        hideModal(); startDeliveryConsole();
      } else {
        showLoginError("Credenciales incorrectas. Prueba: reparto@nexus.com / reparto123");
      }
    }
  });
}

function showLoginError(msg) { DOM.loginErrorMsg.innerText = msg; DOM.loginErrorMsg.style.display = 'block'; }
function hideModal() { DOM.modalLogin.classList.remove('active'); }

// ============================================================
// CONSOLE START
// ============================================================
async function startDeliveryConsole() {
  // Show session header
  DOM.headerSession.style.display = 'flex';
  DOM.headerStats.style.display = 'flex';
  DOM.sessionName.innerText = sessionName;
  const roleLabel = { repartidor: '🚴 Repartidor', admin: '⚡ Admin', owner: '🏪 Dueño' };
  DOM.sessionRole.innerText = roleLabel[userRole] || userRole;
  DOM.btnLogout.addEventListener('click', () => { location.reload(); });

  // Setup biz filter (for admin/multi-biz)
  if (currentBizId === 'all' || userRole === 'admin') {
    await loadBizFilter();
  } else {
    startOrdersListener(currentBizId);
  }
}

async function loadBizFilter() {
  if (isFirebaseEnabled) {
    try {
      const snap = await getDocs(collection(db, 'businesses'));
      const businesses = [];
      snap.forEach(d => businesses.push({ id: d.id, ...d.data() }));

      if (businesses.length > 1) {
        DOM.bizFilterBar.style.display = 'flex';
        DOM.bizFilterSelect.innerHTML = '<option value="all">— Todos los negocios —</option>';
        businesses.forEach(b => {
          const opt = document.createElement('option');
          opt.value = b.id; opt.innerText = b.name;
          DOM.bizFilterSelect.appendChild(opt);
        });
        DOM.bizFilterSelect.addEventListener('change', (e) => {
          startOrdersListener(e.target.value);
        });
      }
      startOrdersListener('all');
    } catch (err) {
      console.error('Error cargando negocios:', err);
      startOrdersListener('all');
    }
  } else {
    const mock = ['burger-shack', 'pizza-napolitana'];
    DOM.bizFilterBar.style.display = 'flex';
    DOM.bizFilterSelect.innerHTML = '<option value="all">— Todos —</option>';
    mock.forEach(id => {
      const opt = document.createElement('option');
      opt.value = id; opt.innerText = id.replace('-', ' ');
      DOM.bizFilterSelect.appendChild(opt);
    });
    DOM.bizFilterSelect.addEventListener('change', (e) => startOrdersListener(e.target.value));
    startOrdersListener('all');
  }
}

// ============================================================
// ORDERS LISTENER
// ============================================================
function startOrdersListener(bizId) {
  currentBizId = bizId;
  if (ordersUnsubscribe) ordersUnsubscribe();

  if (isFirebaseEnabled) {
    let q;
    if (bizId === 'all') {
      // Listen to all orders (admin-only)
      q = collection(db, 'orders');
    } else {
      q = query(collection(db, 'orders'), where('storeId', '==', bizId));
    }

    ordersUnsubscribe = onSnapshot(q, (snap) => {
      const incoming = [];
      snap.forEach(d => incoming.push({ firestoreId: d.id, ...d.data() }));
      detectNewOrders(incoming);
      orders = incoming;
      renderBoard();
    });
  } else {
    // Local fallback
    const all = JSON.parse(localStorage.getItem('nexus_orders')) || [];
    orders = bizId === 'all' ? all : all.filter(o => o.storeId === bizId || o.restaurantId === bizId);
    renderBoard();

    // Poll for changes every 5s in local mode
    setInterval(() => {
      const fresh = JSON.parse(localStorage.getItem('nexus_orders')) || [];
      orders = bizId === 'all' ? fresh : fresh.filter(o => o.storeId === bizId || o.restaurantId === bizId);
      renderBoard();
    }, 5000);
  }
}

function detectNewOrders(incoming) {
  const incomingIds = new Set(incoming.map(o => o.firestoreId));
  const newOnes = incoming.filter(o => !previousOrderIds.has(o.firestoreId) && o.status === 'pendiente');

  if (newOnes.length > 0 && previousOrderIds.size > 0) {
    // Play sound for new orders
    try { newOrderSound?.(); } catch (e) { /* ignore */ }

    // Show browser notification if permitted
    if (Notification.permission === 'granted') {
      new Notification('🔔 Nuevo pedido — Nexus Delivery', {
        body: `${newOnes.length} pedido(s) nuevo(s) esperando confirmación.`,
        icon: 'https://fonts.gstatic.com/s/i/materialiconsoutlined/delivery_dining/v4/24px.svg'
      });
    }
  }

  previousOrderIds = incomingIds;
}

// Request notification permission on first interaction
document.addEventListener('click', () => {
  if (Notification.permission === 'default') {
    Notification.requestPermission();
  }
}, { once: true });

// ============================================================
// RENDER BOARD
// ============================================================
function renderBoard() {
  const pending = orders.filter(o => o.status === 'pendiente' || o.status === 'preparando');
  const transit = orders.filter(o => o.status === 'transit');
  const completed = orders.filter(o => o.status === 'completed');

  // Update counts
  DOM.countPending.innerText = pending.length;
  DOM.countTransit.innerText = transit.length;
  DOM.countCompleted.innerText = completed.length;

  // Update header stats
  DOM.statPending.innerText = pending.length;
  DOM.statTransit.innerText = transit.length;
  DOM.statCompleted.innerText = completed.length;

  renderCol(DOM.colPending, pending, 'pending');
  renderCol(DOM.colTransit, transit, 'transit');
  renderCol(DOM.colCompleted, completed, 'completed');
}

function renderCol(colEl, orderList, type) {
  colEl.innerHTML = '';
  if (orderList.length === 0) {
    const icons = { pending: 'bx-time-five', transit: 'bx-cycling', completed: 'bx-trophy' };
    const msgs = { pending: 'Sin pedidos pendientes', transit: 'Sin repartos en curso', completed: 'Sin entregas hoy' };
    colEl.innerHTML = `<div class="empty-state"><i class="bx ${icons[type]}"></i><p>${msgs[type]}</p></div>`;
    return;
  }

  const sorted = [...orderList].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  sorted.forEach(o => colEl.appendChild(createDeliveryCard(o)));
}

function createDeliveryCard(order) {
  const card = document.createElement('div');
  card.className = `delivery-card status-${order.status}`;
  const refId = order.firestoreId || order.id;
  const items = (order.items || []).map(i => `${i.qty}x ${i.name}`).join(' · ');

  let actionBtn = '';
  if (order.status === 'pendiente') {
    actionBtn = `<button class="primary-btn btn-sm btn-warning" data-ref="${refId}" data-next="preparando"><i class="bx bx-dish"></i> Cocinar</button>`;
  } else if (order.status === 'preparando') {
    actionBtn = `<button class="primary-btn btn-sm btn-info" data-ref="${refId}" data-next="transit"><i class="bx bx-cycling"></i> Salir a Entregar</button>`;
  } else if (order.status === 'transit') {
    actionBtn = `<button class="primary-btn btn-sm btn-success" data-ref="${refId}" data-next="completed"><i class="bx bx-check-circle"></i> Entregado ✔</button>`;
  }

  card.innerHTML = `
    <div class="card-header-row">
      <span class="card-order-id">#${(order.id || '???').replace('NEX-', '')}</span>
      <span class="card-time">${order.time || ''}</span>
    </div>
    <div class="card-customer">${order.customer || order.name || '—'}</div>
    <div class="card-address"><i class="bx bx-map-pin"></i>${order.address || 'Retiro en local'}</div>
    <div class="card-phone"><i class="bx bx-phone"></i>${order.phone || '—'}</div>
    <div class="card-items">${items || 'Sin detalle'}</div>
    <div class="card-footer">
      <span class="card-total">$${(order.total || 0).toFixed(2)}</span>
      ${actionBtn}
    </div>`;

  card.querySelector('button[data-ref]')?.addEventListener('click', (e) => {
    const btn = e.currentTarget;
    advanceStatus(btn.dataset.ref, btn.dataset.next);
  });

  return card;
}

// ============================================================
// UPDATE ORDER STATUS
// ============================================================
async function advanceStatus(refId, nextStatus) {
  if (isFirebaseEnabled) {
    try {
      await updateDoc(doc(db, 'orders', refId), { status: nextStatus });
    } catch (err) {
      console.error('Error actualizando estado:', err);
    }
  } else {
    const all = JSON.parse(localStorage.getItem('nexus_orders')) || [];
    const o = all.find(o => o.firestoreId === refId || o.id === refId);
    if (o) {
      o.status = nextStatus;
      localStorage.setItem('nexus_orders', JSON.stringify(all));
      // Re-render from localStorage
      const fresh = JSON.parse(localStorage.getItem('nexus_orders')) || [];
      orders = currentBizId === 'all' ? fresh : fresh.filter(o => o.storeId === currentBizId || o.restaurantId === currentBizId);
      renderBoard();
    }
  }
}

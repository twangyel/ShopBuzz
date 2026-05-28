/* ---------- CONFIG ---------- */
const SUPABASE_URL = 'https://mzkbjfcdagomqirfsjld.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16a2JqZmNkYWdvbXFpcmZzamxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4NTQ0MzcsImV4cCI6MjA5NTQzMDQzN30.H05EbXCSUYADZWlgOU1_rtxcYLFpjpg7W7Iaytc0OS4'

/* ---------- STATE ---------- */
let supabaseClient = null
let allItems = []
let allCategories = []
let allOutlets = []
let currentCategory = 'all'
let menuSections = []
let menuSubCategories = []
let activeSection = 'all'
let activeSubCategory = 'all'
let tableSession = null

let cart = JSON.parse(localStorage.getItem('cart') || '[]')
let selectedOutlet = localStorage.getItem('selected_outlet')
let currentUser = null
let currentCustomer = null
let isLoginMode = true

/* ---------- HELPERS ---------- */
const $ = (id) => document.getElementById(id)

function withTimeout(promise, ms = 8000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timed out')), ms)
    )
  ])
}

async function retry(fn, attempts = 2, delay = 800) {
  let lastErr
  for (let i = 0; i < attempts; i++) {
    try { return await fn() }
    catch (e) { lastErr = e; await new Promise(r => setTimeout(r, delay)) }
  }
  throw lastErr
}

function setFatal(msg, canRetry = true) {
  $('menu-container').innerHTML = `
    <div class="text-center py-24">
      <div class="empty-icon">⚠️</div>
      <p class="text-lg font-bold text-gray-900">Unable to load menu</p>
      <p class="text-sm text-gray-500 mt-1 mb-6">${msg}</p>
      ${canRetry ? `<button onclick="boot()" class="btn-add" style="width:auto;padding:10px 24px;">Retry</button>` : ''}
    </div>`
  $('loader').classList.add('hidden')
}

/* ---------- TABLE ORDER ---------- */
async function initTableSession() {
  const urlParams = new URLSearchParams(window.location.search)
  const tableNumber = urlParams.get('table')
  const outletId = urlParams.get('outlet')

  // No QR params? Check if returning to an active session
  if (!tableNumber || !outletId) {
    const existingTable = localStorage.getItem('table_number')
    if (existingTable) showTableBanner(existingTable)
    return
  }

  // Force outlet to match the table's outlet
  localStorage.setItem('selected_outlet', outletId)
  selectedOutlet = outletId

  // Skip RPC if same table already active
  const existingSession = localStorage.getItem('table_session_id')
  const existingTable = localStorage.getItem('table_number')
  const existingOutlet = localStorage.getItem('table_outlet_id')
  if (existingSession && existingTable === tableNumber && existingOutlet === outletId) {
    showTableBanner(tableNumber)
    return
  }

  // Call the RPC function
  const { data, error } = await supabaseClient.rpc('start_table_session', {
    p_table_number: tableNumber,
    p_outlet_id: parseInt(outletId)
  })

  if (error || !data || data.length === 0) {
    console.error('Table session error:', error)
    showToast('Unable to start table order')
    return
  }

  const session = data[0]
  localStorage.setItem('table_session_id', session.id)
  localStorage.setItem('table_id', session.table_id)
  localStorage.setItem('table_number', tableNumber)
  localStorage.setItem('table_outlet_id', outletId)

  showTableBanner(tableNumber)
  showToast(`Table ${tableNumber} session started`)
}

function showTableBanner(tableNumber) {
  const banner = $('table-banner')
  const num = $('banner-table-num')
  if (!banner || !num) return
  num.textContent = tableNumber
  banner.classList.remove('hidden')
}

window.clearTableSession = function() {
  localStorage.removeItem('table_session_id')
  localStorage.removeItem('table_id')
  localStorage.removeItem('table_number')
  localStorage.removeItem('table_outlet_id')
  const url = new URL(window.location.href)
  url.searchParams.delete('table')
  url.searchParams.delete('outlet')
  window.location.href = url.toString()
}

/* ---------- AUTH ---------- */
async function initAuth() {
  if (!supabaseClient) return
  const { data: { session } } = await supabaseClient.auth.getSession()
  if (session?.user) {
    currentUser = session.user
    await loadCustomer()
  }
  updateAuthUI()
}

async function loadCustomer() {
  const { data } = await supabaseClient
    .from('customers')
    .select('*')
    .eq('auth_user_id', currentUser.id)
    .single()
  if (data) {
    currentCustomer = data
    localStorage.setItem('customer_name', data.name || '')
    localStorage.setItem('customer_phone', data.phone || '')
    localStorage.setItem('customer_email', data.email || '')
    updateAuthUI()
  }
}

function updateAuthUI() {
  const btn = $('auth-btn')
  if (!btn) return
  if (currentCustomer) {
    const initial = (currentCustomer.name || currentCustomer.email || '?').charAt(0).toUpperCase()
    btn.innerHTML = `<div class="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center text-sm font-bold border-2 border-white/20 shadow-lg">${initial}</div>`
    btn.onclick = () => location.href = 'profile.html'
    btn.title = `Hi, ${currentCustomer.name || 'there'}`
  } else {
    btn.innerHTML = `<svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>`
    btn.onclick = openAuthModal
    btn.title = 'Login'
  }
}

/* ---------- MENU ---------- */
async function loadOutlets() {
  const { data, error } = await withTimeout(
    supabaseClient.from('outlets').select('*').eq('is_active', true).order('name')
  )
  if (error) throw error
  allOutlets = data || []
  if (allOutlets.length === 0) throw new Error('No active outlets')
  const active = allOutlets.find(o => String(o.id) === String(selectedOutlet)) || allOutlets[0]
  selectedOutlet = String(active.id)
  localStorage.setItem('selected_outlet', selectedOutlet)
  $('outlet-name').textContent = active.name
  $('outlet-info').textContent = active.location || 'Open now • Delivery available'
}

async function loadMenuData() {
  const [catRes, itemRes] = await withTimeout(
    Promise.all([
      supabaseClient.from('categories').select('*').order('sort_order'),
      supabaseClient.from('menu_items')
        .select('*')
        .eq('outlet_id', selectedOutlet)
        .eq('is_available', true)
        .order('name')
    ])
  )
  if (catRes.error) throw catRes.error
  if (itemRes.error) throw itemRes.error
  allCategories = catRes.data || []
  menuSections = allCategories.filter(c => !c.parent_id).sort((a,b) => (a.sort_order||0) - (b.sort_order||0))
  menuSubCategories = allCategories.filter(c => c.parent_id).sort((a,b) => (a.sort_order||0) - (b.sort_order||0))
  allItems = itemRes.data || []
}

function renderSectionTabs() {
  try {
  const container = $('section-tabs')
  let html = `<button onclick="selectSection('all')" class="section-tab ${activeSection === 'all' ? 'active' : ''}" data-section="all">All</button>`
  menuSections.forEach(sec => {
    const secId = String(sec.id)
    const subIds = menuSubCategories
      .filter(sc => String(sc.parent_id) === secId)
      .map(sc => String(sc.id))
    const hasItems = subIds.length 
      ? allItems.some(i => subIds.includes(String(i.category_id)))
      : allItems.some(i => String(i.category_id) === secId)
    if (hasItems) {
      html += `<button onclick="selectSection('${secId}')" class="section-tab ${activeSection === secId ? 'active' : ''}" data-section="${secId}">${sec.name}</button>`
    }
  })
  container.innerHTML = html
  } catch (e) { console.error('Tab render error:', e) }
}

window.selectSection = function(secId) {
  activeSection = String(secId)
  activeSubCategory = 'all'
  document.querySelectorAll('.section-tab').forEach(tab => {
    tab.classList.toggle('active', String(tab.dataset.section) === activeSection)
  })
  const activeTab = document.querySelector(`.section-tab[data-section="${escapeCSS(activeSection)}"]`)
  if (activeTab) activeTab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  renderSubCategories()
  renderMenu()
}

function renderSubCategories() {
  try {
  const container = $('category-pills')
  if (activeSection === 'all') {
    container.classList.add('hidden')
    return
  }
  const children = menuSubCategories.filter(c => String(c.parent_id) === activeSection)
  if (children.length === 0) {
    container.classList.add('hidden')
    return
  }
  container.classList.remove('hidden')
  const sectionName = menuSections.find(s => String(s.id) === activeSection)?.name || ''
  let html = `<button onclick="selectSubCategory('all')" class="cat-pill ${activeSubCategory === 'all' ? 'active' : ''}" data-cat="all">All ${sectionName}</button>`
  children.forEach(sub => {
    const subId = String(sub.id)
    if (allItems.some(i => String(i.category_id) === subId)) {
      html += `<button onclick="selectSubCategory('${subId}')" class="cat-pill ${activeSubCategory === subId ? 'active' : ''}" data-cat="${subId}">${sub.name}</button>`
    }
  })
  container.innerHTML = html
  } catch (e) { console.error('Subcategory render error:', e) }
}

window.selectSubCategory = function(subId) {
  activeSubCategory = String(subId)
  document.querySelectorAll('.cat-pill').forEach(pill => {
    pill.classList.toggle('active', String(pill.dataset.cat) === activeSubCategory)
  })
  const activePill = document.querySelector(`.cat-pill[data-cat="${escapeCSS(activeSubCategory)}"]`)
  if (activePill) activePill.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  renderMenu()
}

function renderMenu(itemsToRender = null) {
  try {
  const container = $('menu-container')
  let items = itemsToRender || allItems

  if (activeSection !== 'all') {
    const childIds = menuSubCategories
      .filter(c => String(c.parent_id) === activeSection)
      .map(c => String(c.id))
    if (activeSubCategory !== 'all') {
      items = items.filter(i => String(i.category_id) === activeSubCategory)
    } else if (childIds.length > 0) {
      items = items.filter(i => childIds.includes(String(i.category_id)))
    } else {
      items = items.filter(i => String(i.category_id) === activeSection)
    }
  }

  if (items.length === 0) {
    container.innerHTML = ''
    $('no-results').classList.remove('hidden')
    return
  }
  $('no-results').classList.add('hidden')

  container.innerHTML = `<div class="menu-grid pt-2">${items.map(renderDishCard).join('')}</div>`
  } catch (e) {
    console.error('Render error:', e)
    container.innerHTML = `<div class="text-center py-12"><p class="text-red-500">Error displaying menu. Please refresh.</p></div>`
  }
}

function renderDishCard(item) {
  const cartItem = cart.find(c => String(c.id) === String(item.id))
  const qty = cartItem ? cartItem.qty : 0
  const imgHtml = item.image_url
    ? `<img src="${item.image_url}" alt="${item.name || 'Menu item'}" loading="lazy" onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=&quot;width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#d1d5db;font-size:40px;font-weight:800&quot;>${(item.name || '?').charAt(0)}</div>'">`
    : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#d1d5db;font-size:40px;font-weight:800">${(item.name || '?').charAt(0)}</div>`

  return `
    <div class="menu-card">
      <div class="card-img-wrap">${imgHtml}</div>
      <div class="card-body">
        <h3 class="dish-name">${item.name}</h3>
        <p class="dish-desc">${item.description || 'Delicious freshly prepared item'}</p>
        <div class="flex items-center justify-between mt-auto gap-2">
          <span class="dish-price">Nu ${item.price != null ? parseFloat(item.price).toFixed(0) : "--"}</span>
        </div>
        <div class="mt-3">
          ${qty > 0
            ? `<div class="stepper">
                 <button onclick="updateQty('${item.id}', -1, event)">−</button>
                 <span class="qty">${qty}</span>
                 <button onclick="updateQty('${item.id}', 1, event)">+</button>
               </div>`
            : `<button onclick="addToCart('${item.id}', event)" class="btn-add">
                 <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                   <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
                 </svg> ADD
               </button>`
          }
        </div>
      </div>
    </div>`
}

/* ---------- CART ---------- */
window.addToCart = function(itemId, e) {
  if (e) e.stopPropagation()
  const item = allItems.find(i => String(i.id) === String(itemId))
  if (!item) return
  const existing = cart.find(c => String(c.id) === String(itemId))
  if (existing) existing.qty++
  else cart.push({ id: item.id, name: item.name, price: item.price, qty: 1, image_url: item.image_url })
  saveCart()
  renderMenu()
  showToast(`Added ${item.name}`)
}

window.updateQty = function(itemId, delta, e) {
  if (e) e.stopPropagation()
  const idx = cart.findIndex(c => String(c.id) === String(itemId))
  if (idx === -1) return
  cart[idx].qty += delta
  if (cart[idx].qty <= 0) cart.splice(idx, 1)
  saveCart()
  renderMenu()
}

function saveCart() {
  localStorage.setItem('cart', JSON.stringify(cart))
  updateCartBadge()
}

function updateCartBadge() {
  const total = cart.reduce((sum, c) => sum + c.qty, 0)
  const badge = $('cart-badge')
  if (total > 0) {
    badge.textContent = total > 99 ? '99+' : total
    badge.classList.remove('hidden')
    requestAnimationFrame(() => {
      badge.classList.remove('scale-0')
      badge.classList.add('scale-110')
      setTimeout(() => badge.classList.remove('scale-110'), 150)
    })
  } else {
    badge.classList.add('scale-0')
    setTimeout(() => badge.classList.add('hidden'), 200)
  }
}

/* ---------- SEARCH ---------- */
let searchDebounce
$('search-input').addEventListener('input', (e) => {
  clearTimeout(searchDebounce)
  searchDebounce = setTimeout(() => {
    const query = e.target.value.toLowerCase().trim()
    if (!query) { renderMenu(); return }
    const filtered = allItems.filter(i =>
      i.name.toLowerCase().includes(query) ||
      (i.description || '').toLowerCase().includes(query)
    )
    renderMenu(filtered)
  }, 250)
})

/* ---------- TOAST ---------- */
function showToast(msg) {
  const toast = $('toast')
  $('toast-msg').textContent = msg
  toast.classList.add('show')
  setTimeout(() => toast.classList.remove('show'), 2200)
}

/* ---------- AUTH MODAL ---------- */
function openAuthModal() {
  $('auth-modal').classList.remove('hidden')
  setTimeout(() => $('auth-sheet').classList.remove('translate-y-full'), 10)
}
window.closeAuthModal = function() {
  $('auth-sheet').classList.add('translate-y-full')
  setTimeout(() => $('auth-modal').classList.add('hidden'), 300)
}
window.toggleAuthMode = function() {
  isLoginMode = !isLoginMode
  $('auth-title').textContent = isLoginMode ? 'Welcome back' : 'Create account'
  $('auth-btn-text').textContent = isLoginMode ? 'Login' : 'Create Account'
  $('auth-toggle-label').textContent = isLoginMode ? "Don't have an account?" : 'Already have an account?'
  $('auth-toggle-btn').textContent = isLoginMode ? 'Create account' : 'Login'
  const nameField = $('name-field')
  const nameInput = $('auth-name')
  if (isLoginMode) { nameField.classList.add('hidden'); nameInput.removeAttribute('required') }
  else { nameField.classList.remove('hidden'); nameInput.setAttribute('required', 'true') }
}
window.handleAuth = async function(e) {
  e.preventDefault()
  const phone = $('auth-phone').value.trim().replace(/\D/g, '')
  const name = $('auth-name').value.trim()
  const emailInput = $('auth-email').value.trim()
  const password = $('auth-password').value
  const authEmail = emailInput || `${phone}@buzzcafe.local`

  if (isLoginMode) {
    const { error } = await supabaseClient.auth.signInWithPassword({ email: authEmail, password })
    if (error) { showToast('Invalid phone or password'); return }
    closeAuthModal(); showToast('Welcome back!')
  } else {
    if (phone.length !== 8) { showToast('Please enter a valid 8-digit phone number'); return }
    const { error } = await supabaseClient.auth.signUp({
      email: authEmail, password,
      options: { data: { phone, name: name || null } }
    })
    if (error) { showToast(error.message); return }
    closeAuthModal(); showToast('Account created! You can now login.')
  }
}

/* ---------- BOOT ---------- */
async function boot() {
  if (!window.supabase || !window.supabase.createClient) {
    setFatal('Supabase library failed to load. Check your network or CDN block.', true)
    return
  }
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    currentUser = session?.user || null
    if (currentUser) { await loadCustomer(); syncLocalCartToUser() }
    else { currentCustomer = null; updateAuthUI() }
  })

  try {
    // 1. Init table session FIRST (with short timeout, non-blocking)
    try {
      await Promise.race([
        initTableSession(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
      ])
    } catch (e) {
      console.log('Table session init skipped:', e.message)
    }

    // 2. Load outlets with retry
    await retry(loadOutlets, 2, 1000)
    // 3. Load menu with retry
    await retry(loadMenuData, 2, 1000)
    // 4. Render
    await initAuth()
    renderSectionTabs()
    renderSubCategories()
    renderMenu()
    updateCartBadge()
    $('loader').classList.add('hidden')
  } catch (err) {
    console.error('Boot error:', err)
    $('loader').classList.add('hidden')
    setFatal(err.message || 'Failed to load menu. Please check your connection.', true)
  }
}

async function syncLocalCartToUser() {
  // placeholder for future DB sync
}

/* ---------- INIT ---------- */
window.addEventListener('load', () => {
  setTimeout(boot, 300)
})

window.addEventListener('scroll', () => {
  const header = $('main-header')
  header.classList.toggle('header-scrolled', window.scrollY > 10)
})
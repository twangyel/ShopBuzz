// ===== SUPABASE =====
const SUPABASE_URL = 'https://mzkbjfcdagomqirfsjld.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16a2JqZmNkYWdvbXFpcmZzamxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4NTQ0MzcsImV4cCI6MjA5NTQzMDQzN30.H05EbXCSUYADZWlgOU1_rtxcYLFpjpg7W7Iaytc0OS4'
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const outletId = localStorage.getItem('selected_outlet')
if (!outletId) { window.location.href = 'order.html' }

// ===== GLOBAL DATA =====
let menuData = { categories: [], items: [] }

// ===== LOADING =====
window.addEventListener('load', () => {
  setTimeout(() => document.getElementById('loader').classList.add('hidden'), 800)
})

// ===== CART FUNCTIONS =====
function getCart() { return JSON.parse(localStorage.getItem('cart') || '[]') }

function saveCart(cart) {
  localStorage.setItem('cart', JSON.stringify(cart))
  updateBadge()
}

function clearCart() {
  localStorage.removeItem('cart')
  updateBadge()
}

function updateBadge() {
  const cart = getCart()
  const count = cart.reduce((sum, i) => sum + i.quantity, 0)
  const badge = document.getElementById('cart-badge')
  if (count > 0) {
    badge.textContent = count
    badge.classList.remove('hidden')
  } else {
    badge.classList.add('hidden')
  }
}

function getQty(id) {
  const cart = getCart()
  const item = cart.find(i => i.id === id)
  return item ? item.quantity : 0
}

// ===== QUANTITY CONTROLS =====
function renderQtyControls(id, qty) {
  if (qty === 0) {
    return `
      <button type="button" onclick="changeQty('${id}', 1)"
        class="bg-cream-900 text-cream-50 px-5 py-2 rounded-xl text-xs font-bold hover:bg-cream-800 active:scale-95 transition shrink-0 whitespace-nowrap shadow-md shadow-cream-900/10">
        Add
      </button>
    `
  }
  return `
    <div class="flex items-center gap-1 bg-cream-100 rounded-xl p-1 shrink-0 border border-cream-200">
      <button type="button" onclick="changeQty('${id}', -1)"
        class="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm text-cream-900 font-bold hover:bg-cream-50 active:scale-95 transition text-sm">−</button>
      <span class="w-6 text-center text-sm font-bold text-cream-900" id="qty-${id}">${qty}</span>
      <button type="button" onclick="changeQty('${id}', 1)"
        class="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm text-cream-900 font-bold hover:bg-cream-50 active:scale-95 transition text-sm">+</button>
    </div>
  `
}

window.changeQty = function(id, delta) {
  let cart = getCart()
  const existingIdx = cart.findIndex(i => i.id === id)
  const existing = existingIdx >= 0 ? cart[existingIdx] : null

  if (delta > 0 && !existing) {
    const item = menuData.items.find(i => i.id === id)
    if (!item) return
    cart.push({
      id: item.id,
      name: item.name,
      price: item.price,
      image_url: item.image_url || '',
      quantity: 1
    })
    showToast(`${item.name} added`)
  } else if (existing) {
    existing.quantity += delta
    if (existing.quantity <= 0) {
      cart.splice(existingIdx, 1)
      showToast('Removed from cart')
    } else {
      showToast(delta > 0 ? 'Quantity increased' : 'Quantity decreased')
    }
  }

  saveCart(cart)

  const controls = document.querySelector(`.qty-controls[data-item-id="${id}"]`)
  if (controls) {
    controls.innerHTML = renderQtyControls(id, getQty(id))
  }
}

function showToast(msg) {
  const toast = document.getElementById('toast')
  toast.textContent = msg
  toast.classList.add('show')
  setTimeout(() => toast.classList.remove('show'), 2200)
}

// ===== OUTLET SWITCHER =====
async function loadOutlets() {
  const { data: outlets, error } = await supabaseClient
    .from('outlets')
    .select('id, name')
    .order('name')

  if (error || !outlets) {
    console.error('Failed to load outlets:', error)
    return
  }

  const select = document.getElementById('outlet-switcher')
  select.innerHTML = outlets.map(o =>
    `<option value="${o.id}" ${String(o.id) === String(outletId) ? 'selected' : ''}>${o.name}</option>`
  ).join('')

  const current = outlets.find(o => String(o.id) === String(outletId))
  if (current) {
    document.getElementById('outlet-name').textContent = current.name
  }

  select.addEventListener('change', (e) => {
    const newId = e.target.value
    if (!newId || newId === String(outletId)) return

    const cart = getCart()
    if (cart.length > 0) {
      const confirmed = confirm('Switching outlets will clear your current cart. Continue?')
      if (!confirmed) {
        select.value = outletId
        return
      }
      clearCart()
    }

    localStorage.setItem('selected_outlet', newId)
    window.location.reload()
  })
}

// ===== LOAD & RENDER MENU =====
async function loadMenu() {
  const { data: categories } = await supabaseClient
    .from('categories').select('*').order('sort_order')

  const { data: items } = await supabaseClient
    .from('menu_items')
    .select('*')
    .eq('outlet_id', outletId)
    .eq('is_available', true)
    .order('name')

  if (!items || items.length === 0) {
    document.getElementById('menu-container').innerHTML =
      `<div class="text-center py-24">
        <div class="w-16 h-16 rounded-2xl bg-cream-100 border border-cream-200 flex items-center justify-center mx-auto mb-4 text-2xl">🍽️</div>
        <p class="text-cream-700 text-lg font-medium">No items available at this outlet.</p>
        <p class="text-sm text-cream-500 mt-2">Add items in the Supabase database.</p>
      </div>`
    return
  }

  menuData.categories = categories || []
  menuData.items = items

  renderMenu(items)

  const searchInput = document.getElementById('search-input')
  searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase().trim()
    if (!term) {
      renderMenu(menuData.items)
      return
    }
    const filtered = menuData.items.filter(i =>
      (i.name && i.name.toLowerCase().includes(term)) ||
      (i.description && i.description.toLowerCase().includes(term))
    )
    renderMenu(filtered)
  })
}

function renderMenu(items) {
  const container = document.getElementById('menu-container')
  const noResults = document.getElementById('no-results')

  if (items.length === 0) {
    container.innerHTML = ''
    noResults.classList.remove('hidden')
    return
  }
  noResults.classList.add('hidden')

  const cats = menuData.categories
  let html = ''

  cats.forEach(cat => {
    const catItems = items.filter(i => i.category_id === cat.id)
    if (catItems.length === 0) return

    html += `
      <section class="mb-10 animate-fade-up">
        <div class="flex items-center gap-3 mb-5 pb-3 border-b border-cream-200">
          <div class="w-8 h-8 rounded-lg bg-cream-100 flex items-center justify-center">
            <span class="text-cream-500 text-sm">✦</span>
          </div>
          <h2 class="font-display text-xl font-bold text-cream-900 tracking-wide">${cat.name}</h2>
          <div class="flex-1 h-px bg-cream-200 ml-2"></div>
          <span class="text-xs text-cream-500 font-medium">${catItems.length} items</span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          ${catItems.map(item => `
            <div class="bg-white rounded-2xl border border-cream-100 overflow-hidden flex items-center gap-3 p-3 hover:border-cream-300 transition-all duration-300 hover:shadow-lg hover:shadow-cream-900/5 hover:-translate-y-0.5 group" data-item-id="${item.id}">
              ${item.image_url ?
                `<div class="w-20 h-20 sm:w-24 sm:h-24 shrink-0 rounded-xl bg-cream-50 overflow-hidden relative">
                  <img src="${item.image_url}" alt="${item.name}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy">
                  <div class="absolute inset-0 ring-1 ring-inset ring-cream-200/50 rounded-xl"></div>
                </div>` :
                `<div class="w-20 h-20 sm:w-24 sm:h-24 shrink-0 rounded-xl bg-cream-100 flex items-center justify-center text-cream-400 text-2xl border border-cream-200">☕</div>`
              }
              <div class="flex-1 min-w-0 py-1">
                <div class="flex justify-between items-start gap-2 mb-1">
                  <h3 class="font-semibold text-cream-900 text-sm leading-tight truncate group-hover:text-cream-700 transition">${item.name}</h3>
                  <span class="font-bold text-cream-600 text-sm shrink-0">Nu ${item.price}</span>
                </div>
                <p class="text-cream-500 text-xs line-clamp-2 leading-relaxed mb-3">${item.description || ''}</p>
                <div class="qty-controls shrink-0" data-item-id="${item.id}">
                  ${renderQtyControls(item.id, getQty(item.id))}
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </section>
    `
  })

  container.innerHTML = html
}

updateBadge()
loadOutlets()
loadMenu()

// ===== PWA =====
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
}
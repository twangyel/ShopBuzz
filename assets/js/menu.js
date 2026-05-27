// ===== SUPABASE =====
const SUPABASE_URL = 'https://mzkbjfcdagomqirfsjld.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16a2JqZmNkYWdvbXFpcmZzamxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4NTQ0MzcsImV4cCI6MjA5NTQzMDQzN30.H05EbXCSUYADZWlgOU1_rtxcYLFpjpg7W7Iaytc0OS4'
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const outletId = localStorage.getItem('selected_outlet')
if (!outletId) { window.location.href = 'order.html' }

// ===== LOADING =====
window.addEventListener('load', () => {
  setTimeout(() => document.getElementById('loader').classList.add('hidden'), 600)
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

// ===== ADD TO CART =====
window.addToCart = function(btn) {
  const item = {
    id: btn.dataset.id,
    name: btn.dataset.name,
    price: parseFloat(btn.dataset.price),
    image_url: btn.dataset.image || ''
  }

  let cart = getCart()
  const existing = cart.find(i => i.id === item.id)
  if (existing) {
    existing.quantity += 1
  } else {
    cart.push({ ...item, quantity: 1 })
  }
  saveCart(cart)
  showToast(`${item.name} added`)
}

function showToast(msg) {
  const toast = document.getElementById('toast')
  toast.textContent = msg
  toast.classList.add('show')
  setTimeout(() => toast.classList.remove('show'), 2000)
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
      const confirmed = confirm(
        'Switching outlets will clear your current cart. Continue?'
      )
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

// ===== LOAD MENU =====
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
      '<div class="text-center py-20"><p class="text-cream-500 text-lg">No items available at this outlet.</p><p class="text-sm text-cream-400 mt-2">Add items in Supabase database.</p></div>'
    return
  }

  let html = ''
  categories.forEach(cat => {
    const catItems = items.filter(i => i.category_id === cat.id)
    if (catItems.length === 0) return

    html += `
      <section class="mb-8">
        <h2 class="font-display text-lg font-bold text-espresso-900 mb-3 pb-2 border-b border-cream-200">${cat.name}</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          ${catItems.map(item => `
            <div class="bg-white rounded-xl shadow-sm border border-cream-100 overflow-hidden flex flex-row sm:flex-col">
              ${item.image_url ?
                `<div class="w-24 h-24 sm:w-full sm:h-36 shrink-0 bg-gray-100"><img src="${item.image_url}" alt="${item.name}" class="w-full h-full object-cover" loading="lazy"></div>` :
                `<div class="w-24 h-24 sm:w-full sm:h-36 shrink-0 bg-cream-100 flex items-center justify-center text-cream-400 text-2xl">🍽️</div>`
              }
              <div class="p-3 flex-1 flex flex-col min-w-0">
                <div class="flex justify-between items-start gap-2 mb-0.5">
                  <h3 class="font-semibold text-espresso-900 text-sm truncate">${item.name}</h3>
                  <span class="font-bold text-orange-600 text-sm shrink-0">Nu ${item.price}</span>
                </div>
                <p class="text-cream-600 text-xs mb-2 line-clamp-2 flex-1">${item.description || ''}</p>
                <button type="button"
                  data-id="${item.id}"
                  data-name="${item.name.replace(/"/g, '&quot;')}"
                  data-price="${item.price}"
                  data-image="${item.image_url || ''}"
                  onclick="addToCart(this)"
                  class="w-full bg-espresso-900 text-white py-2 rounded-lg hover:bg-espresso-800 active:scale-[0.98] transition text-xs font-semibold cursor-pointer flex items-center justify-center gap-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Add
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </section>
    `
  })

  document.getElementById('menu-container').innerHTML = html
}

updateBadge()
loadOutlets()
loadMenu()

// ===== PWA =====
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
}
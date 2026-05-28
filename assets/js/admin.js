const SUPABASE_URL = 'https://mzkbjfcdagomqirfsjld.supabase.co'
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16a2JqZmNkYWdvbXFpcmZzamxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4NTQ0MzcsImV4cCI6MjA5NTQzMDQzN30.H05EbXCSUYADZWlgOU1_rtxcYLFpjpg7W7Iaytc0OS4'
    const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

    let allOrders = []
    let allPayments = []
    let allReviews = []
    let allOutlets = []
    let currentFilter = 'all'
    let notifications = []

    // Products state
    let allProducts = []
    let productCategories = []
    let currentProductFilter = 'all'
    let editingProductId = null

    // ========== AUTH ==========
    // FIX #5: Check role on session restore too
    supabaseClient.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const { data: profile } = await supabaseClient
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single()
        if (profile && ['admin', 'staff'].includes(profile.role)) {
          showDashboard(session.user.email)
        } else {
          await supabaseClient.auth.signOut()
        }
      }
    })

    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault()
      const email = document.getElementById('login-email').value
      const password = document.getElementById('login-password').value
      
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password })
      if (error) {
        document.getElementById('login-error').textContent = error.message
        document.getElementById('login-error').classList.remove('hidden')
      } else {
        // FIX #5: Verify user has admin/staff role before granting access
        const { data: profile, error: profileError } = await supabaseClient
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single()

        if (profileError || !profile || !['admin', 'staff'].includes(profile.role)) {
          await supabaseClient.auth.signOut()
          document.getElementById('login-error').textContent = 'Access denied. Staff accounts only.'
          document.getElementById('login-error').classList.remove('hidden')
          return
        }
        showDashboard(data.user.email)
      }
    })

    async function logout() {
      await supabaseClient.auth.signOut()
      location.reload()
    }

    // ========== DASHBOARD INIT ==========
    async function showDashboard(email) {
      document.getElementById('login-view').classList.add('hidden')
      document.getElementById('dashboard-view').classList.remove('hidden')
      document.getElementById('staff-email').textContent = email

      await loadOutlets()
      loadOrders()
      loadPayments()
      loadReviews()
      loadAnalytics()
      loadProducts()
      setupRealtimeSubscriptions()
    }

    // ========== OUTLETS & STORE CONTROL ==========
    async function loadOutlets() {
      const { data: outlets } = await supabaseClient.from('outlets').select('*').order('name')
      allOutlets = outlets || []
      renderOutletsControl()
      updatePortalInfo()
    }

    function renderOutletsControl() {
      const container = document.getElementById('outlets-control-list')
      
      if (allOutlets.length === 0) {
        container.innerHTML = '<p class="text-gray-400 text-sm col-span-full">No outlets found</p>'
        return
      }

      container.innerHTML = allOutlets.map(outlet => {
        const isOpen = outlet.status === 'open'
        return `
          <div class="bg-white rounded-xl border shadow-sm p-4 flex items-center justify-between">
            <div>
              <h4 class="font-semibold text-gray-900 text-sm">${escapeHtml(outlet.name)}</h4>
              <p class="text-xs text-gray-500 mt-0.5">${escapeHtml(outlet.location || 'No location')}</p>
              <span class="inline-flex items-center gap-1 text-xs mt-1 ${isOpen ? 'text-green-600' : 'text-red-600'}">
                <span class="w-1.5 h-1.5 rounded-full ${isOpen ? 'bg-green-500' : 'bg-red-500'}"></span>
                ${isOpen ? 'Open' : 'Closed'}
              </span>
            </div>
            <label class="outlet-toggle">
              <input type="checkbox" 
                onchange="toggleOutletStatus(${outlet.id}, this.checked)" 
                ${isOpen ? 'checked' : ''}>
              <span class="outlet-toggle-track"></span>
            </label>
          </div>
        `
      }).join('')
    }

    async function toggleOutletStatus(outletId, isOpen) {
      const newStatus = isOpen ? 'open' : 'closed'
      const { error } = await supabaseClient
        .from('outlets')
        .update({ status: newStatus })
        .eq('id', outletId)

      if (error) {
        showToast('Failed to update status', 'error')
        loadOutlets() // Revert UI
      } else {
        const outlet = allOutlets.find(o => o.id === outletId)
        showToast(`${outlet?.name || 'Store'} is now ${newStatus}`, 'outlet')
        addNotification(`${outlet?.name || 'Store'} status changed to ${newStatus}`, 'outlet')
        loadOutlets()
      }
    }

    function updatePortalInfo() {
      if (allOutlets.length === 0) {
        document.getElementById('portal-outlet-info').innerHTML = '<p class="text-gray-400">No outlets</p>'
        return
      }
      
      // FIX #8: Show all outlets, not just allOutlets[0]
      document.getElementById('portal-outlet-info').innerHTML = allOutlets.map(outlet => `
        <div class="mb-3 pb-3 border-b border-gray-100 last:border-0 last:mb-0 last:pb-0">
          <div class="flex justify-between py-1">
            <span class="text-gray-400">Name</span>
            <span class="font-medium text-gray-900">${escapeHtml(outlet.name)}</span>
          </div>
          <div class="flex justify-between py-1">
            <span class="text-gray-400">Location</span>
            <span class="text-gray-700">${escapeHtml(outlet.location || 'N/A')}</span>
          </div>
          <div class="flex justify-between py-1">
            <span class="text-gray-400">Phone</span>
            <span class="text-gray-700">${escapeHtml(outlet.phone || 'N/A')}</span>
          </div>
          <div class="flex justify-between py-1">
            <span class="text-gray-400">Status</span>
            <span class="${outlet.status === 'open' ? 'text-green-600' : 'text-red-600'} font-medium">${escapeHtml(outlet.status || 'open')}</span>
          </div>
        </div>
      `).join('')
    }

    // ========== NOTIFICATIONS ==========
    function addNotification(message, type = 'order') {
      const notif = {
        id: Date.now(),
        message,
        type,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        read: false
      }
      notifications.unshift(notif)
      updateNotifBadge()
      renderNotifications()
    }

    function updateNotifBadge() {
      const unread = notifications.filter(n => !n.read).length
      const badge = document.getElementById('notif-badge')
      if (unread > 0) {
        badge.textContent = unread > 9 ? '9+' : unread
        badge.classList.remove('hidden')
      } else {
        badge.classList.add('hidden')
      }
    }

    function renderNotifications() {
      const list = document.getElementById('notif-list')
      if (notifications.length === 0) {
        list.innerHTML = '<div class="px-4 py-8 text-center text-gray-400 text-sm">No notifications</div>'
        return
      }

      const icons = { order: '📋', payment: '💳', review: '⭐', outlet: '🏪' }
      
      list.innerHTML = notifications.map(n => `
        <div class="notif-item ${n.read ? '' : 'unread'}" onclick="markNotifRead(${n.id})">
          <div class="flex items-start gap-2">
            <span class="text-base">${icons[n.type] || 'ℹ️'}</span>
            <div class="flex-1 min-w-0">
              <p class="text-sm text-gray-800 leading-snug">${n.message}</p>
              <p class="text-xs text-gray-400 mt-1">${n.time}</p>
            </div>
            ${n.read ? '' : '<span class="w-2 h-2 bg-orange-500 rounded-full flex-shrink-0 mt-1"></span>'}
          </div>
        </div>
      `).join('')
    }

    function toggleNotifDropdown(event) {
      if (event) event.stopPropagation()
      const dropdown = document.getElementById('notif-dropdown')
      dropdown.classList.toggle('show')
      
      // Mark all as read when opened
      if (dropdown.classList.contains('show')) {
        notifications.forEach(n => n.read = true)
        updateNotifBadge()
        renderNotifications()
      }
    }

    function markNotifRead(id) {
      const notif = notifications.find(n => n.id === id)
      if (notif) {
        notif.read = true
        updateNotifBadge()
        renderNotifications()
      }
    }

    function clearAllNotifications() {
      notifications = []
      updateNotifBadge()
      renderNotifications()
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      const wrapper = document.getElementById('notif-wrapper')
      if (!wrapper.contains(e.target)) {
        document.getElementById('notif-dropdown').classList.remove('show')
      }
    })

    // ========== TAB SWITCHING ==========
    window.switchMainTab = function(tabName) {
      document.querySelectorAll('.main-tab').forEach(btn => {
        const isActive = btn.dataset.tab === tabName
        btn.classList.toggle('border-orange-600', isActive)
        btn.classList.toggle('text-orange-600', isActive)
        btn.classList.toggle('border-transparent', !isActive)
        btn.classList.toggle('text-gray-500', !isActive)
      })

      document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `tab-${tabName}`)
      })
    }

    window.switchOrdersSubTab = function(subTabName) {
      document.querySelectorAll('.orders-sub-tab').forEach(btn => {
        const isActive = btn.dataset.subtab === subTabName
        btn.classList.toggle('bg-orange-100', isActive)
        btn.classList.toggle('text-orange-700', isActive)
        btn.classList.toggle('text-gray-600', !isActive)
        btn.classList.toggle('hover:bg-gray-100', !isActive)
      })

      document.querySelectorAll('.orders-sub-content').forEach(content => {
        content.classList.toggle('hidden', content.id !== `orders-sub-${subTabName}`)
        content.classList.toggle('active', content.id === `orders-sub-${subTabName}`)
      })
    }

    // ========== ORDERS ==========
    async function loadOrders() {
      const { data: orders } = await supabaseClient
        .from('orders')
        .select('*, order_items(*), payments(*)')
        .order('created_at', { ascending: false })
        .limit(200)

      allOrders = orders || []
      renderOrders()
      updateStats()
    }

    function updateStats() {
      const today = new Date().toISOString().split('T')[0]
      const todayOrders = allOrders.filter(o => o.created_at.startsWith(today))
      const todayRevenue = todayOrders.reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0)

      document.getElementById('stat-today').textContent = todayOrders.length
      document.getElementById('stat-pending').textContent = allOrders.filter(o => o.status === 'pending').length
      document.getElementById('stat-preparing').textContent = allOrders.filter(o => o.status === 'preparing').length
      document.getElementById('stat-revenue').textContent = 'Nu. ' + todayRevenue.toFixed(2)
    }

    window.filterOrders = function(status) {
      currentFilter = status
      document.querySelectorAll('.filter-btn').forEach(btn => {
        const isActive = btn.dataset.filter === status
        btn.classList.toggle('bg-gray-900', isActive)
        btn.classList.toggle('text-white', isActive)
        btn.classList.toggle('bg-white', !isActive)
        btn.classList.toggle('text-gray-700', !isActive)
      })
      // FIX #11: Re-apply any active search query when changing filter
      const query = document.getElementById('orders-search').value.toLowerCase().trim()
      if (query) {
        searchOrders()
      } else {
        renderOrders()
      }
    }

    function renderOrders(ordersToRender = null) {
      const tbody = document.getElementById('orders-table')
      let filtered = ordersToRender || (currentFilter === 'all' ? allOrders : allOrders.filter(o => o.status === currentFilter))

      if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="px-4 py-8 text-center text-gray-400">No orders found</td></tr>'
        return
      }

      const statusColors = {
        pending: 'bg-yellow-100 text-yellow-800',
        confirmed: 'bg-blue-100 text-blue-800',
        preparing: 'bg-purple-100 text-purple-800',
        ready: 'bg-green-100 text-green-800',
        completed: 'bg-gray-100 text-gray-800',
        cancelled: 'bg-red-100 text-red-800'
      }

      tbody.innerHTML = filtered.map(order => {
        const time = new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        const itemCount = order.order_items?.reduce((sum, i) => sum + i.quantity, 0) || 0

        return `
          <tr class="hover:bg-gray-50 transition">
            <td class="px-3 py-2 font-mono text-xs text-gray-500">#${escapeHtml(order.order_number || order.id.slice(0,8).toUpperCase())}</td>
            <td class="px-3 py-2">
              <div class="font-medium text-gray-900 text-sm">${escapeHtml(order.customer_name)}</div>
              <div class="text-gray-500 text-xs">${escapeHtml(order.customer_phone)}</div>
            </td>
            <td class="px-3 py-2 text-gray-600 text-sm">${itemCount} items</td>
            <td class="px-3 py-2 font-semibold text-sm">Nu. ${parseFloat(order.total_amount).toFixed(2)}</td>
            <td class="px-3 py-2">
              <span class="text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[order.status] || 'bg-gray-100'}">${order.status}</span>
            </td>
            <td class="px-3 py-2 text-gray-500 text-xs">${time}</td>
            <td class="px-3 py-2">
              <div class="flex items-center gap-1">
                <button onclick="openOrderModal('${order.id}')" class="p-1.5 hover:bg-gray-100 rounded-lg transition text-gray-500" title="View Details">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                </button>
                <select onchange="updateStatus('${order.id}', this.value)" class="text-xs border rounded-lg px-2 py-1 bg-white cursor-pointer hover:border-orange-400 outline-none">
                  <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Pending</option>
                  <option value="confirmed" ${order.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
                  <option value="preparing" ${order.status === 'preparing' ? 'selected' : ''}>Preparing</option>
                  <option value="ready" ${order.status === 'ready' ? 'selected' : ''}>Ready</option>
                  <option value="completed" ${order.status === 'completed' ? 'selected' : ''}>Completed</option>
                  <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                </select>
              </div>
            </td>
          </tr>
        `
      }).join('')
    }

    // ========== ORDER DETAIL MODAL ==========
    window.openOrderModal = function(orderId) {
      const order = allOrders.find(o => o.id === orderId)
      if (!order) return

      const time = new Date(order.created_at).toLocaleString()
      const items = order.order_items || []
      const payment = order.payments?.[0] || {}

      document.getElementById('modal-order-title').textContent = `Order #${order.order_number || order.id.slice(0,8).toUpperCase()}`
      document.getElementById('modal-order-time').textContent = time

      const statusColors = {
        pending: 'bg-yellow-100 text-yellow-800',
        confirmed: 'bg-blue-100 text-blue-800',
        preparing: 'bg-purple-100 text-purple-800',
        ready: 'bg-green-100 text-green-800',
        completed: 'bg-gray-100 text-gray-800',
        cancelled: 'bg-red-100 text-red-800'
      }

      document.getElementById('modal-order-content').innerHTML = `
        <!-- Customer Info -->
        <div class="bg-gray-50 rounded-lg p-3 space-y-1">
          <div class="flex justify-between">
            <span class="text-xs text-gray-500">Customer</span>
            <span class="text-sm font-medium text-gray-900">${escapeHtml(order.customer_name)}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-xs text-gray-500">Phone</span>
            <span class="text-sm text-gray-700">${escapeHtml(order.customer_phone)}</span>
          </div>
          ${order.customer_email ? `
          <div class="flex justify-between">
            <span class="text-xs text-gray-500">Email</span>
            <span class="text-sm text-gray-700">${escapeHtml(order.customer_email)}</span>
          </div>` : ''}
          ${order.delivery_type ? `
          <div class="flex justify-between">
            <span class="text-xs text-gray-500">Type</span>
            <span class="text-sm text-gray-700 capitalize">${escapeHtml(order.delivery_type)}</span>
          </div>` : ''}
          ${order.address ? `
          <div class="flex justify-between">
            <span class="text-xs text-gray-500">Address</span>
            <span class="text-sm text-gray-700">${escapeHtml(order.address)}</span>
          </div>` : ''}
        </div>

        <!-- Status -->
        <div class="flex items-center justify-between">
          <span class="text-sm text-gray-500">Status</span>
          <span class="text-xs font-medium px-3 py-1 rounded-full ${statusColors[order.status] || 'bg-gray-100'}">${escapeHtml(order.status)}</span>
        </div>

        <!-- Items -->
        <div>
          <h4 class="text-sm font-semibold text-gray-900 mb-2">Items (${items.reduce((s,i)=>s+i.quantity,0)})</h4>
          <div class="space-y-2">
            ${items.map(item => `
              <div class="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                <div class="flex items-center gap-2">
                  <span class="w-6 h-6 bg-orange-100 text-orange-700 rounded-full flex items-center justify-center text-xs font-bold">${item.quantity}</span>
                  <span class="text-sm text-gray-700">${escapeHtml(item.item_name)}</span>
                </div>
                <span class="text-sm font-medium text-gray-900">Nu. ${(item.price * item.quantity).toFixed(2)}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Totals -->
        <div class="border-t border-gray-100 pt-3 space-y-1">
          <div class="flex justify-between text-sm">
            <span class="text-gray-500">Subtotal</span>
            <span class="text-gray-700">Nu. ${parseFloat(order.total_amount).toFixed(2)}</span>
          </div>
          ${payment.method ? `
          <div class="flex justify-between text-sm">
            <span class="text-gray-500">Payment</span>
            <span class="text-xs font-medium px-2 py-0.5 rounded-full ${payment.method === 'cash-on-delivery' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}">${escapeHtml(payment.method.replace(/-/g, ' '))}</span>
          </div>
          ${payment.screenshot_url ? `
          <div class="flex justify-between text-sm items-center">
            <span class="text-gray-500">Proof</span>
            <a href="${escapeHtml(payment.screenshot_url)}" target="_blank" rel="noopener noreferrer" class="text-xs text-blue-600 hover:underline">View Screenshot</a>
          </div>` : ''}
          ` : ''}
          ${order.special_instructions ? `
          <div class="mt-2 p-2 bg-amber-50 rounded-lg border border-amber-100">
            <p class="text-xs text-amber-700 font-medium">Special Instructions:</p>
            <p class="text-xs text-amber-600 mt-0.5">${escapeHtml(order.special_instructions)}</p>
          </div>
          ` : ''}
        </div>
      `

      document.getElementById('order-modal').classList.add('active')
    }

    window.closeOrderModal = function() {
      document.getElementById('order-modal').classList.remove('active')
    }

    window.searchOrders = function() {
      const query = document.getElementById('orders-search').value.toLowerCase().trim()
      if (!query) {
        renderOrders()
        return
      }

      // FIX #11: Apply search within the currently active status filter
      const baseList = currentFilter === 'all' ? allOrders : allOrders.filter(o => o.status === currentFilter)
      const filtered = baseList.filter(o => 
        (o.customer_name || '').toLowerCase().includes(query) ||
        (o.customer_phone || '').toLowerCase().includes(query) ||
        (o.order_number || '').toLowerCase().includes(query) ||
        (o.id || '').toLowerCase().includes(query)
      )
      renderOrders(filtered)
    }

    window.updateStatus = async function(orderId, status) {
      const { error } = await supabaseClient.from('orders').update({ status }).eq('id', orderId)
      if (!error) {
        showToast(`Order updated to ${status}`, 'order')
        addNotification(`Order #${orderId.slice(0,8)} status: ${status}`, 'order')
        loadOrders()
      }
    }

    // ========== PAYMENTS ==========
    async function loadPayments() {
      const { data: payments } = await supabaseClient
        .from('payments')
        .select('*, orders(customer_name, customer_phone, order_number)')
        .order('created_at', { ascending: false })
        .limit(200)

      allPayments = payments || []
      renderPayments()
    }

    function renderPayments(paymentsToRender = null) {
      const tbody = document.getElementById('payments-table')
      const filtered = paymentsToRender || allPayments

      if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="px-4 py-8 text-center text-gray-400">No payments found</td></tr>'
        return
      }

      const methodColors = {
        'half-payment': 'bg-orange-100 text-orange-800',
        'full-payment': 'bg-green-100 text-green-800',
        'cash-on-delivery': 'bg-blue-100 text-blue-800'
      }

      tbody.innerHTML = filtered.map(p => {
        const time = new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        const order = p.orders || {}
        
        return `
          <tr class="hover:bg-gray-50 transition">
            <td class="px-3 py-2 font-mono text-xs text-gray-500">#${escapeHtml(order.order_number || p.order_id?.slice(0,8).toUpperCase() || '')}</td>
            <td class="px-3 py-2">
              <div class="font-medium text-gray-900 text-sm">${escapeHtml(order.customer_name || 'N/A')}</div>
              <div class="text-gray-500 text-xs">${escapeHtml(order.customer_phone || '')}</div>
            </td>
            <td class="px-3 py-2 font-semibold text-sm">Nu. ${parseFloat(p.amount).toFixed(2)}</td>
            <td class="px-3 py-2">
              <span class="text-xs font-medium px-2 py-0.5 rounded-full ${methodColors[p.method] || 'bg-gray-100'}">${escapeHtml(p.method?.replace(/-/g, ' ') || '')}</span>
            </td>
            <td class="px-3 py-2">
              <span class="text-xs font-medium px-2 py-0.5 rounded-full ${p.status === 'verified' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}">${escapeHtml(p.status || '')}</span>
            </td>
            <td class="px-3 py-2">
              ${p.screenshot_url 
                ? `<a href="${escapeHtml(p.screenshot_url)}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline text-xs">View</a>` 
                : '<span class="text-gray-400 text-xs">—</span>'}
            </td>
            <td class="px-3 py-2 text-gray-500 text-xs">${time}</td>
          </tr>
        `
      }).join('')
    }

    window.searchPayments = function() {
      const query = document.getElementById('payments-search').value.toLowerCase().trim()
      if (!query) {
        renderPayments()
        return
      }

      const filtered = allPayments.filter(p => {
        const order = p.orders || {}
        return (
          (order.order_number || '').toLowerCase().includes(query) ||
          (p.order_id || '').toLowerCase().includes(query) ||
          (p.method || '').toLowerCase().includes(query) ||
          (order.customer_name || '').toLowerCase().includes(query)
        )
      })
      renderPayments(filtered)
    }
// ========== REVIEWS ==========
let currentReviewFilter = 'all'

async function loadReviews() {
  // Fetch ALL reviews (admin sees everything, not just approved)
  const { data: reviews, error } = await supabaseClient
    .from('reviews')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    console.error('Reviews load error:', error)
    document.getElementById('reviews-table').innerHTML = 
      '<tr><td colspan="6" class="px-4 py-8 text-center text-red-500">Error loading reviews: ' + error.message + '</td></tr>'
    return
  }

  allReviews = reviews || []
  updateReviewStats()
  renderReviews()
}

function updateReviewStats() {
  const total = allReviews.length
  const pending = allReviews.filter(r => !r.approved).length
  const avg = total > 0 
    ? (allReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / total).toFixed(1)
    : '0.0'

  document.getElementById('stat-total-reviews').textContent = total
  document.getElementById('stat-pending-reviews').textContent = pending
  document.getElementById('stat-avg-rating').textContent = avg
}

window.filterReviews = function(filter) {
  currentReviewFilter = filter
  document.querySelectorAll('.review-filter').forEach(btn => {
    const isActive = btn.dataset.filter === filter
    btn.classList.toggle('bg-orange-100', isActive)
    btn.classList.toggle('text-orange-700', isActive)
    btn.classList.toggle('text-gray-600', !isActive)
    btn.classList.toggle('hover:bg-gray-100', !isActive)
  })
  renderReviews()
}

// Helper: escape HTML to prevent XSS
function escapeHtml(text) {
  if (!text) return ''
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

function renderReviews(reviewsToRender = null) {
  const tbody = document.getElementById('reviews-table')
  let filtered = reviewsToRender || allReviews

  // Apply status filter (FIX #3: use 'approved' consistently)
  if (currentReviewFilter === 'pending') {
    filtered = filtered.filter(r => !r.approved)
  } else if (currentReviewFilter === 'approved') {
    filtered = filtered.filter(r => r.approved)
  }

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="px-4 py-8 text-center text-gray-400">No reviews found</td></tr>'
    return
  }

  tbody.innerHTML = filtered.map(r => {
    const date = new Date(r.created_at).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    })
    const time = new Date(r.created_at).toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit'
    })
    const stars = '★'.repeat(r.rating || 0) + '☆'.repeat(5 - (r.rating || 0))

    return `
      <tr class="hover:bg-gray-50 transition">
        <td class="px-3 py-2">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-xs">
              ${escapeHtml((r.name || 'G').charAt(0).toUpperCase())}
            </div>
            <div>
              <div class="font-medium text-gray-900 text-sm">${escapeHtml(r.name || 'Anonymous')}</div>
              ${r.order_id ? `<div class="text-gray-400 text-[10px] font-mono">Order: ${escapeHtml(r.order_id.slice(0, 8))}</div>` : ''}
            </div>
          </div>
        </td>
        <td class="px-3 py-2">
          <span class="text-amber-500 text-sm">${stars}</span>
          <span class="text-xs text-gray-500 ml-1">${r.rating || 0}/5</span>
        </td>
        <td class="px-3 py-2 text-sm text-gray-600 max-w-[200px] truncate">${escapeHtml(r.comment || '—')}</td>
        <td class="px-3 py-2 text-xs text-gray-500">${date}<br>${time}</td>
        <td class="px-3 py-2">
          <span class="text-xs font-medium px-2 py-0.5 rounded-full ${r.approved ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-700'}">
            ${r.approved ? 'Approved' : 'Pending'}
          </span>
        </td>
        <td class="px-3 py-2 text-right">
          ${r.approved
            ? `<button onclick="toggleReviewApproved('${r.id}', false)" class="text-xs text-red-600 hover:underline">Reject</button>`
            : `<button onclick="toggleReviewApproved('${r.id}', true)" class="text-xs text-green-600 hover:underline font-medium">Approve</button>`
          }
        </td>
      </tr>
    `
  }).join('')
}

// FIX #2: Single correct searchReviews (removed duplicate that used r.orders which was never joined)
window.searchReviews = function() {
  const query = document.getElementById('reviews-search').value.toLowerCase().trim()
  if (!query) {
    renderReviews()
    return
  }
  const filtered = allReviews.filter(r =>
    (r.name || '').toLowerCase().includes(query) ||
    (r.comment || '').toLowerCase().includes(query) ||
    (r.rating?.toString() || '').includes(query) ||
    (r.order_id || '').toLowerCase().includes(query)
  )
  renderReviews(filtered)
}

// FIX #3: toggleReviewApproved uses 'approved' column only (removed conflicting toggleReviewVerified)
window.toggleReviewApproved = async function(id, approved) {
  const { error } = await supabaseClient
    .from('reviews')
    .update({ approved })
    .eq('id', id)

  if (error) {
    showToast('Failed to update review: ' + error.message, 'error')
    console.error(error)
  } else {
    showToast(`Review ${approved ? 'approved' : 'rejected'}`, 'review')
    loadReviews()
  }
}

    // ========== ANALYTICS ==========
    async function loadAnalytics() {
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0,0,0,0)

      const { data: monthOrders } = await supabaseClient
        .from('orders')
        .select('total_amount')
        .gte('created_at', startOfMonth.toISOString())

      const { data: allReviewsData } = await supabaseClient
        .from('reviews')
        .select('rating')

      const { data: topItems } = await supabaseClient
        .from('order_items')
        .select('item_name, quantity')
        .limit(500)

      const totalOrders = monthOrders?.length || 0
      const totalRevenue = monthOrders?.reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0) || 0
      const avgRating = allReviewsData?.length 
        ? (allReviewsData.reduce((sum, r) => sum + r.rating, 0) / allReviewsData.length).toFixed(1) 
        : '0.0'

      const itemCounts = {}
      topItems?.forEach(i => {
        itemCounts[i.item_name] = (itemCounts[i.item_name] || 0) + i.quantity
      })
      const sortedItems = Object.entries(itemCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)

      document.getElementById('analytics-orders').textContent = totalOrders
      document.getElementById('analytics-revenue').textContent = 'Nu. ' + totalRevenue.toFixed(2)
      document.getElementById('analytics-rating').textContent = avgRating

      document.getElementById('analytics-top-items').innerHTML = sortedItems.length 
        ? sortedItems.map(([name, count], i) => `
            <div class="flex items-center justify-between py-2 ${i < sortedItems.length - 1 ? 'border-b border-gray-50' : ''}">
              <div class="flex items-center gap-2">
                <span class="w-5 h-5 bg-orange-100 text-orange-700 rounded-full flex items-center justify-center text-[10px] font-bold">${i + 1}</span>
                <span class="text-sm text-gray-700">${name}</span>
              </div>
              <span class="text-sm font-medium text-gray-900">${count} sold</span>
            </div>
          `).join('')
        : '<p class="text-gray-400 text-sm">No data available</p>'
    }

    // ========== PRODUCTS ==========
    async function loadProducts() {
      // Load categories from categories table
      const { data: categories } = await supabaseClient
        .from('categories')
        .select('*')
        .order('sort_order', { ascending: true })

      productCategories = categories || []

      // Load menu items
      const { data: items } = await supabaseClient
        .from('menu_items')
        .select('*')

      // Map category names for display
      allProducts = (items || []).map(item => ({
        ...item,
        category_name: productCategories.find(c => c.id === item.category_id)?.name || 'Uncategorized'
      }))

      renderProducts()
      renderCategoryFilters()
      populateCategorySelect()
      populateOutletSelect()
    }

    function populateCategorySelect() {
      const select = document.getElementById('product-category')
      const currentVal = select.value
      select.innerHTML = '<option value="">Select category...</option>'
      productCategories.forEach(cat => {
        const option = document.createElement('option')
        option.value = cat.id
        option.textContent = cat.name
        select.appendChild(option)
      })
      if (currentVal) select.value = currentVal
    }

    function populateOutletSelect() {
      const select = document.getElementById('product-outlet')
      if (!select) return
      const currentVal = select.value
      select.innerHTML = '<option value="">Select outlet...</option>'
      allOutlets.forEach(o => {
        const option = document.createElement('option')
        option.value = o.id
        option.textContent = o.name
        select.appendChild(option)
      })
      if (currentVal) select.value = currentVal
      else if (allOutlets.length === 1) select.value = allOutlets[0].id
    }

    function renderCategoryFilters() {
      const container = document.getElementById('category-filters')
      let html = `<button onclick="filterProducts('all')" class="cat-filter active px-3 py-1 rounded-lg text-xs font-medium bg-gray-900 text-white" data-cat="all">All</button>`
      productCategories.forEach(cat => {
        html += `<button onclick="filterProducts('${escapeHtml(cat.id)}')" class="cat-filter px-3 py-1 rounded-lg text-xs font-medium bg-white border text-gray-700" data-cat="${escapeHtml(cat.id)}">${escapeHtml(cat.name)}</button>`
      })
      container.innerHTML = html
    }

    window.filterProducts = function(categoryId) {
      currentProductFilter = categoryId
      document.querySelectorAll('.cat-filter').forEach(btn => {
        const isActive = btn.dataset.cat === categoryId
        btn.classList.toggle('bg-gray-900', isActive)
        btn.classList.toggle('text-white', isActive)
        btn.classList.toggle('bg-white', !isActive)
        btn.classList.toggle('text-gray-700', !isActive)
        btn.classList.toggle('border', !isActive)
      })
      renderProducts()
    }

    function renderProducts(productsToRender = null) {
      const tbody = document.getElementById('products-table')
      let filtered = productsToRender || (currentProductFilter === 'all' ? allProducts : allProducts.filter(p => p.category_id === currentProductFilter))

      if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="px-4 py-8 text-center text-gray-400">No products found</td></tr>'
        return
      }

      tbody.innerHTML = filtered.map(p => {
        return `
          <tr class="hover:bg-gray-50 transition">
            <td class="px-3 py-2">
              ${p.image_url ? `<img src="${escapeHtml(p.image_url)}" alt="" class="product-photo-thumb">` : `<div class="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-xs">No img</div>`}
            </td>
            <td class="px-3 py-2">
              <div class="font-medium text-gray-900 text-sm">${escapeHtml(p.name)}</div>
              <div class="text-gray-500 text-xs truncate max-w-[200px]">${escapeHtml(p.description || '')}</div>
            </td>
            <td class="px-3 py-2">
              <span class="text-xs font-medium px-2 py-0.5 rounded-full bg-orange-50 text-orange-700">${escapeHtml(p.category_name || 'Uncategorized')}</span>
            </td>
            <td class="px-3 py-2 font-semibold text-sm">Nu. ${parseFloat(p.price).toFixed(2)}</td>
            <td class="px-3 py-2">
              <span class="text-xs font-medium px-2 py-0.5 rounded-full ${p.is_available !== false ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}">${p.is_available !== false ? 'Available' : 'Unavailable'}</span>
            </td>
            <td class="px-3 py-2 text-right">
              <div class="flex items-center justify-end gap-1">
                <button onclick="editProduct('${p.id}')" class="p-1.5 hover:bg-gray-100 rounded-lg transition text-gray-500" title="Edit">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                </button>
                <button onclick="toggleProductStatus('${p.id}', ${p.is_available === false})" class="p-1.5 hover:bg-gray-100 rounded-lg transition ${p.is_available !== false ? 'text-green-600' : 'text-gray-400'}" title="${p.is_available !== false ? 'Mark Unavailable' : 'Mark Available'}">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${p.is_available !== false ? 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z' : 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'}"/></svg>
                </button>
                <button onclick="deleteProduct('${p.id}')" class="p-1.5 hover:bg-red-50 rounded-lg transition text-red-500" title="Delete">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </button>
              </div>
            </td>
          </tr>
        `
      }).join('')
    }

    window.previewPhoto = function() {
      const file = document.getElementById('product-photo').files[0]
      const preview = document.getElementById('photo-preview')
      const img = preview.querySelector('img')
      // FIX #12: Revoke previous object URL to avoid memory leak
      if (img.src && img.src.startsWith('blob:')) {
        URL.revokeObjectURL(img.src)
      }
      if (file) {
        img.src = URL.createObjectURL(file)
        preview.classList.remove('hidden')
      } else {
        preview.classList.add('hidden')
        img.src = ''
      }
    }

    window.addCategory = async function() {
      const input = document.getElementById('new-category')
      const name = input.value.trim()
      if (!name) return

      // Check if exists locally
      const exists = productCategories.find(c => c.name.toLowerCase() === name.toLowerCase())
      if (exists) {
        document.getElementById('product-category').value = exists.id
        input.value = ''
        return
      }

      const { data: sortData } = await supabaseClient
        .from('categories')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1)
      // FIX #13: Use MAX existing sort_order + 1 to avoid collisions after deletions
      const nextSortOrder = sortData?.[0]?.sort_order != null ? sortData[0].sort_order + 1 : 1
      const { data, error } = await supabaseClient.from('categories').insert({ name, sort_order: nextSortOrder }).select()
      if (error) {
        showToast('Failed to add category', 'error')
        return
      }

      await loadProducts() // Reload to get new category with proper ID
      if (data && data[0]) document.getElementById('product-category').value = data[0].id
      input.value = ''
      showToast('Category added', 'order')
    }

    window.handleProductSubmit = async function(e) {
      e.preventDefault()
      const name = document.getElementById('product-name').value.trim()
      const category_id = document.getElementById('product-category').value
      const outlet_id = document.getElementById('product-outlet').value
      const price = parseFloat(document.getElementById('product-price').value)
      const description = document.getElementById('product-description').value.trim()
      const fileInput = document.getElementById('product-photo')
      const file = fileInput.files[0]

      if (!name || !category_id || !outlet_id || isNaN(price)) {
        showToast('Please fill all required fields', 'error')
        return
      }

      let image_url = null
      const existing = editingProductId ? allProducts.find(p => p.id === editingProductId) : null
      image_url = existing?.image_url || null

      if (file) {
        const ext = file.name.split('.').pop()
        const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
        const { data: uploadData, error: uploadError } = await supabaseClient.storage
          .from('product-photos')
          .upload(fileName, file)

        if (uploadError) {
          showToast('Photo upload failed', 'error')
          console.error(uploadError)
        } else {
          const { data: urlData } = supabaseClient.storage.from('product-photos').getPublicUrl(fileName)
          image_url = urlData.publicUrl
        }
      }

      const payload = {
        outlet_id,
        category_id,
        name,
        description: description || null,
        price,
        image_url,
        is_available: true
      }

      let error
      if (editingProductId) {
        // Preserve existing availability status when editing
        payload.is_available = existing?.is_available !== false
        const { error: updateError } = await supabaseClient.from('menu_items').update(payload).eq('id', editingProductId)
        error = updateError
      } else {
        const { error: insertError } = await supabaseClient.from('menu_items').insert(payload)
        error = insertError
      }

      if (error) {
        showToast(error.message, 'error')
      } else {
        showToast(editingProductId ? 'Product updated' : 'Product added', 'order')
        resetProductForm()
        loadProducts()
      }
    }

    window.editProduct = function(id) {
      const p = allProducts.find(x => x.id === id)
      if (!p) return

      editingProductId = id
      document.getElementById('product-form-title').textContent = 'Edit Product'
      document.getElementById('product-id').value = p.id
      document.getElementById('product-name').value = p.name
      document.getElementById('product-category').value = p.category_id || ''
      document.getElementById('product-outlet').value = p.outlet_id || ''
      document.getElementById('product-price').value = p.price
      document.getElementById('product-description').value = p.description || ''
      document.getElementById('product-submit-btn').textContent = 'Update Product'
      document.getElementById('product-cancel-btn').classList.remove('hidden')

      if (p.image_url) {
        const preview = document.getElementById('photo-preview')
        preview.querySelector('img').src = p.image_url
        preview.classList.remove('hidden')
      }

      window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    window.resetProductForm = function() {
      editingProductId = null
      document.getElementById('product-form').reset()
      document.getElementById('product-form-title').textContent = 'Add New Product'
      document.getElementById('product-submit-btn').textContent = 'Save Product'
      document.getElementById('product-cancel-btn').classList.add('hidden')
      document.getElementById('photo-preview').classList.add('hidden')
      document.getElementById('photo-preview').querySelector('img').src = ''
      populateOutletSelect()
    }

    window.toggleProductStatus = async function(id, makeAvailable) {
      const { error } = await supabaseClient.from('menu_items').update({ is_available: makeAvailable }).eq('id', id)
      if (!error) {
        showToast(`Product ${makeAvailable ? 'available' : 'unavailable'}`, 'outlet')
        loadProducts()
      }
    }

    window.deleteProduct = async function(id) {
      if (!confirm('Delete this product?')) return
      const { error } = await supabaseClient.from('menu_items').delete().eq('id', id)
      if (!error) {
        showToast('Product deleted', 'order')
        if (editingProductId === id) resetProductForm()
        loadProducts()
      }
    }

    window.searchProducts = function() {
      const query = document.getElementById('products-search').value.toLowerCase().trim()
      if (!query) {
        renderProducts()
        return
      }
      const filtered = allProducts.filter(p => 
        (p.name || '').toLowerCase().includes(query) ||
        (p.category_name || '').toLowerCase().includes(query) ||
        (p.description || '').toLowerCase().includes(query)
      )
      renderProducts(filtered)
    }

    // ========== REALTIME SUBSCRIPTIONS ==========
    function setupRealtimeSubscriptions() {
      // FIX #7: Use event: 'INSERT' so status updates don't show "New order!" toast
      supabaseClient
        .channel('admin-orders')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, payload => {
          const orderRef = escapeHtml(payload.new.order_number || payload.new.id.slice(0,8))
          showToast(`New order! #${orderRef}`, 'order')
          addNotification(`New order received #${orderRef}`, 'order')
          loadOrders()
        })
        .subscribe()

      supabaseClient
        .channel('admin-payments')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, payload => {
          const status = escapeHtml(payload.new.status || '')
          const orderId = escapeHtml(payload.new.order_id?.slice(0,8) || '')
          showToast('Payment updated', 'payment')
          addNotification(`Payment ${status} for order #${orderId}`, 'payment')
          loadPayments()
        })
        .subscribe()

      supabaseClient
        .channel('admin-reviews')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reviews' }, payload => {
          const rating = parseInt(payload.new.rating) || 0
          showToast('New review received!', 'review')
          addNotification(`New ${rating}★ review received`, 'review')
          loadReviews()
        })
        .subscribe()

      supabaseClient
        .channel('admin-outlets')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'outlets' }, payload => {
          const status = escapeHtml(payload.new.status || '')
          showToast(`Store status: ${status}`, 'outlet')
          loadOutlets()
        })
        .subscribe()

      supabaseClient
        .channel('admin-menu')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, payload => {
          loadProducts()
        })
        .subscribe()
    }

    // ========== TOAST ==========
    function showToast(message, type = 'order') {
      const container = document.getElementById('toast-container')
      const toast = document.createElement('div')
      toast.className = `toast toast-${type}`
      
      const icons = {
        order: '📋',
        payment: '💳',
        review: '⭐',
        outlet: '🏪',
        error: '⚠️'
      }
      
      toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${message}</span>`
      container.appendChild(toast)
      requestAnimationFrame(() => toast.classList.add('show'))
      setTimeout(() => {
        toast.classList.remove('show')
        setTimeout(() => toast.remove(), 300)
      }, 4000)
    }
    // ========== WINDOW EXPORTS ==========
    // Required because this file is loaded as type="module" — plain function
    // declarations are module-scoped and invisible to HTML onclick="..." attributes.
    window.logout = logout
    window.toggleNotifDropdown = toggleNotifDropdown
    window.clearAllNotifications = clearAllNotifications
    window.markNotifRead = markNotifRead
    window.toggleOutletStatus = toggleOutletStatus
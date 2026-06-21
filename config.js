// ─── KNRA API CONFIG ──────────────────────────────────────────────────────────
// Supabase direct REST API integration
// All pages import this file via <script src="config.js">
// ─────────────────────────────────────────────────────────────────────────────

const API = {
  BASE_URL:   'https://hhkztoklgeozegehcsmc.supabase.co',
  REST_URL:   'https://hhkztoklgeozegehcsmc.supabase.co/rest/v1',
  ANON_KEY:   'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhoa3p0b2tsZ2VvemVnZWhjc21jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMjI1MjEsImV4cCI6MjA5NTc5ODUyMX0.fWs-vU_gIXLNJUh1DA1edrqKh7tc3wv9hjT-ZhhjytY',   // ← paste your anon/public key here

  ENDPOINTS: {
    LOGIN:        '/auth/v1/token?grant_type=password',
    LOGOUT:       '/auth/v1/logout',
    ME:           '/auth/v1/user',

    ACCOUNTS:     '/accounts',
    TRANSACTIONS: '/transactions',
    PAYOUTS:      '/payouts',
    PAYOUT_RULES: '/payout_rules',
    REFERRAL:     '/referrals',
    CERTIFICATES: '/certificates',
    USERS:        '/users',
  },


  // ─── AUTH REQUESTS (Supabase Auth endpoints) ────────────────────────────────
  async authRequest(endpoint, options = {}) {
    const token = localStorage.getItem('knra_token');
    const headers = {
      'Content-Type':  'application/json',
      'apikey':         this.ANON_KEY,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    };

    const res = await fetch(this.BASE_URL + endpoint, { ...options, headers });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error_description || data.message || `HTTP ${res.status}`);
    return data;
  },


  // ─── DATABASE REQUESTS (Supabase REST/PostgREST endpoints) ──────────────────
  async request(endpoint, options = {}) {
    const token = localStorage.getItem('knra_token');
    const headers = {
      'Content-Type':  'application/json',
      'apikey':         this.ANON_KEY,
      'Prefer':         'return=representation',
      ...(token ? { Authorization: `Bearer ${token}` } : { Authorization: `Bearer ${this.ANON_KEY}` }),
      ...(options.headers || {}),
    };

    const res = await fetch(this.REST_URL + endpoint, { ...options, headers });

    if (res.status === 401) {
      localStorage.removeItem('knra_token');
      localStorage.removeItem('knra_user');
      window.location.href = 'login.html';
      return;
    }

    // 204 No Content (DELETE/UPDATE with no return)
    if (res.status === 204) return { success: true };

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || `HTTP ${res.status}`);
    return data;
  },


  // ─── SHORTHAND METHODS ───────────────────────────────────────────────────────

  // GET rows — pass query params as string e.g. '?user_id=eq.5&status=eq.active'
  get(endpoint, query = '')        { return this.request(endpoint + query); },

  // POST — insert row
  post(endpoint, body)             { return this.request(endpoint, { method: 'POST', body: JSON.stringify(body) }); },

  // PATCH — update row (use with query) e.g. patch('/accounts?id=eq.5', data)
  patch(endpoint, body)            { return this.request(endpoint, { method: 'PATCH', body: JSON.stringify(body) }); },

  // DELETE — delete row (use with query) e.g. del('/accounts?id=eq.5')
  del(endpoint)                    { return this.request(endpoint, { method: 'DELETE' }); },


  // ─── AUTH HELPERS ────────────────────────────────────────────────────────────

  async login(email, password) {
    const data = await this.authRequest(this.ENDPOINTS.LOGIN, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    // Save token and user info
    localStorage.setItem('knra_token', data.access_token);
    localStorage.setItem('knra_refresh', data.refresh_token);
    localStorage.setItem('knra_user', JSON.stringify(data.user));

    return data;
  },

  async logout() {
    const token = localStorage.getItem('knra_token');
    try {
      await this.authRequest(this.ENDPOINTS.LOGOUT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (e) {
      // ignore logout errors
    } finally {
      localStorage.removeItem('knra_token');
      localStorage.removeItem('knra_refresh');
      localStorage.removeItem('knra_user');
      window.location.href = 'login.html';
    }
  },

  async getUser() {
    return await this.authRequest(this.ENDPOINTS.ME);
  },


  // ─── QUERY BUILDER HELPERS ───────────────────────────────────────────────────
  // Makes building Supabase filter queries easier

  query: {
    // Build query string from filters object
    // e.g. build({ user_id: 5, status: 'active' }) → '?user_id=eq.5&status=eq.active'
    build(filters = {}, options = {}) {
      const params = [];

      for (const [key, value] of Object.entries(filters)) {
        params.push(`${key}=eq.${value}`);
      }

      // Ordering: options.order = 'created_at.desc'
      if (options.order)  params.push(`order=${options.order}`);

      // Pagination: options.limit, options.offset
      if (options.limit)  params.push(`limit=${options.limit}`);
      if (options.offset) params.push(`offset=${options.offset}`);

      // Select specific columns: options.select = 'id,name,email'
      if (options.select) params.push(`select=${options.select}`);

      return params.length ? '?' + params.join('&') : '';
    },

    // Range filter: e.g. gte('amount', 100) → 'amount=gte.100'
    gte: (col, val) => `${col}=gte.${val}`,
    lte: (col, val) => `${col}=lte.${val}`,
    like: (col, val) => `${col}=ilike.%${val}%`,
  },
};


// ─── AUTH GUARD ───────────────────────────────────────────────────────────────
// Call requireAuth() at the top of every protected page
function requireAuth() {
  if (!localStorage.getItem('knra_token')) {
    window.location.href = 'login.html';
  }
}

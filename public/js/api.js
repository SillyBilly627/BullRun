// ============================================================
// BullRun — API Module
// ============================================================
// Handles all communication with the backend.
// Every function returns a JSON response or throws an error.
// ============================================================

const API = (() => {
  // Base URL for API calls
  // In production (Cloudflare Pages), this is the same domain
  // For local dev, wrangler serves everything on the same port
  const BASE = '/api';

  // Get the saved auth token from localStorage
  function getToken() {
    return localStorage.getItem('bullrun_token');
  }

  // Save the auth token
  function setToken(token) {
    if (token) {
      localStorage.setItem('bullrun_token', token);
    } else {
      localStorage.removeItem('bullrun_token');
    }
  }

  // Core fetch wrapper — adds auth header and handles errors
  async function request(path, options = {}) {
    const token = getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    };

    try {
      const response = await fetch(`${BASE}/${path}`, {
        ...options,
        headers,
      });

      const data = await response.json();

      // If we get a 401, the session expired — log out
      if (response.status === 401) {
        setToken(null);
        // Don't redirect here, let the caller handle it
      }

      return { ok: response.ok, status: response.status, data };
    } catch (err) {
      console.error('API request failed:', err);
      return { ok: false, status: 0, data: { error: 'Network error — check your connection' } };
    }
  }

  // GET request
  async function get(path) {
    return request(path, { method: 'GET' });
  }

  // POST request with JSON body
  async function post(path, body) {
    return request(path, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  // ---- AUTH ENDPOINTS ----
  async function signup(username, password) {
    const res = await post('auth/signup', { username, password });
    if (res.ok && res.data.token) {
      setToken(res.data.token);
    }
    return res;
  }

  async function login(username, password) {
    const res = await post('auth/login', { username, password });
    if (res.ok && res.data.token) {
      setToken(res.data.token);
    }
    return res;
  }

  async function logout() {
    await post('auth/logout', {});
    setToken(null);
  }

  async function getMe() {
    return get('auth/me');
  }

  // ---- STOCK ENDPOINTS ----
  async function getStocks() {
    return get('stocks');
  }

  async function getStockDetail(stockId, minutes = 60) {
    return get(`stocks/${stockId}?minutes=${minutes}`);
  }

  async function buyStock(stockId, shares) {
    return post('stocks/buy', { stockId, shares });
  }

  async function sellStock(stockId, shares) {
    return post('stocks/sell', { stockId, shares });
  }

  // ---- PORTFOLIO ----
  async function getPortfolio() {
    return get('portfolio');
  }

  async function getTransactions(limit = 50) {
    return get(`transactions?limit=${limit}`);
  }

  // ---- LEADERBOARDS ----
  async function getLeaderboard(type) {
    return get(`leaderboards/${type}`);
  }

  // ---- PROFILES ----
  async function getProfile(userId) {
    return get(`profile/${userId}`);
  }

  // ---- ANNOUNCEMENTS ----
  async function getAnnouncements() {
    return get('announcements');
  }

  // ---- STOCK TICK (polling for live prices) ----
  async function pollTick() {
    return get('stocks/tick');
  }

  // ---- WATCHLIST ----
  async function getWatchlist() {
    return get('watchlist');
  }

  async function toggleWatchlist(stockId) {
    return post('watchlist/toggle', { stockId });
  }

  // ---- CONFIG ----
  async function getChatStatus() {
    return get('config/chat-status');
  }

  // ---- LOBBY ENDPOINTS ----
  async function getLobbies() {
    return get('lobbies');
  }

  async function getMyActiveLobby() {
    return get('lobbies/my-active');
  }

  async function createLobby(settings) {
    return post('lobbies/create', settings);
  }

  async function getLobbyDetails(lobbyId) {
    return get(`lobbies/${lobbyId}`);
  }

  async function joinLobby(lobbyId) {
    return post('lobbies/join', { lobbyId });
  }

  async function leaveLobby(lobbyId) {
    return post('lobbies/leave', { lobbyId });
  }

  async function startLobby(lobbyId) {
    return post('lobbies/start', { lobbyId });
  }

  async function lobbyTick(lobbyId) {
    return get(`lobbies/tick?lobbyId=${lobbyId}`);
  }

  async function lobbyBuy(lobbyId, stockId, shares) {
    return post('lobbies/buy', { lobbyId, stockId, shares });
  }

  async function lobbySell(lobbyId, stockId, shares) {
    return post('lobbies/sell', { lobbyId, stockId, shares });
  }

  async function getLobbyPortfolio(lobbyId) {
    return get(`lobbies/portfolio?lobbyId=${lobbyId}`);
  }

  async function getLobbyResults(lobbyId) {
    return get(`lobbies/results/${lobbyId}`);
  }

  async function getLobbyStockDetail(lobbyId, stockId) {
    return get(`lobbies/stock-detail?lobbyId=${lobbyId}&stockId=${stockId}`);
  }

  async function getAllLobbyHistory(lobbyId) {
    return get(`lobbies/all-history?lobbyId=${lobbyId}`);
  }

  // ---- CHAT ENDPOINTS ----
  async function getChatMessages(since) {
    return get(`chat/messages${since ? '?since=' + encodeURIComponent(since) : ''}`);
  }

  async function sendChatMessage(message) {
    return post('chat/send', { message });
  }

  // ---- ADMIN ENDPOINTS ----
  async function adminVerify(password) {
    return post('admin/verify', { password });
  }

  async function adminGetUsers() {
    return get('admin/users');
  }

  async function adminBan(userId, ban = true, reason = '') {
    return post('admin/ban', { userId, ban, reason });
  }

  async function adminChatBan(userId, ban = true) {
    return post('admin/chat-ban', { userId, ban });
  }

  async function adminSetMoney(userId, amount) {
    return post('admin/set-money', { userId, amount });
  }

  async function adminSetXp(userId, xp) {
    return post('admin/set-xp', { userId, xp });
  }

  async function adminSetStockPrice(stockId, price) {
    return post('admin/set-stock-price', { stockId, price });
  }

  async function adminAnnouncement(message, action = 'create') {
    return post('admin/announcement', { message, action });
  }

  async function adminToggleChat(enabled) {
    return post('admin/toggle-chat', { enabled });
  }

  async function adminClearChat() {
    return post('admin/clear-chat', {});
  }

  async function adminForceCloseLobby(lobbyId) {
    return post('admin/force-close-lobby', { lobbyId });
  }

  async function adminGetLobbies() {
    return get('admin/lobbies');
  }

  async function adminWeeklyReset() {
    return post('admin/weekly-reset', {});
  }

  async function adminToggleAdmin(userId, admin = true) {
    return post('admin/toggle-admin', { userId, admin });
  }

  async function adminGiveCosmetic(userId, cosmeticId) {
    return post('admin/give-cosmetic', { userId, cosmeticId });
  }

  async function adminGetConfig() {
    return get('admin/config');
  }

  // ---- COSMETICS ENDPOINTS ----
  async function getCosmetics() {
    return get('cosmetics');
  }

  async function equipCosmetic(cosmeticId) {
    return post('cosmetics/equip', { cosmeticId });
  }

  async function unequipCosmetic(type) {
    return post('cosmetics/equip', { unequip: true, type });
  }

  async function checkUnlocks() {
    return post('cosmetics/check-unlocks', {});
  }

  async function crateSpin(placement) {
    return post('cosmetics/crate-spin', { placement });
  }

  // Public interface
  return {
    getToken, setToken,
    signup, login, logout, getMe,
    getStocks, getStockDetail, buyStock, sellStock,
    getPortfolio, getTransactions,
    getLeaderboard, getProfile,
    getAnnouncements, getChatStatus,
    pollTick, getWatchlist, toggleWatchlist,
    // Lobbies
    getLobbies, getMyActiveLobby, createLobby, getLobbyDetails,
    joinLobby, leaveLobby, startLobby, lobbyTick,
    lobbyBuy, lobbySell, getLobbyPortfolio, getLobbyResults, getLobbyStockDetail, getAllLobbyHistory,
    // Chat
    getChatMessages, sendChatMessage,
    // Admin
    adminVerify, adminGetUsers, adminBan, adminChatBan,
    adminSetMoney, adminSetXp, adminSetStockPrice,
    adminAnnouncement, adminToggleChat, adminClearChat,
    adminForceCloseLobby, adminGetLobbies, adminWeeklyReset,
    adminToggleAdmin, adminGiveCosmetic, adminGetConfig,
    // Cosmetics
    getCosmetics, equipCosmetic, unequipCosmetic, checkUnlocks, crateSpin,
  };
})();

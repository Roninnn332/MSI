// Remove the import line for Supabase
// import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://tmqwjmebyiqqgevsaquh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRtcXdqbWVieWlxcWdldnNhcXVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk3Mzk2OTMsImV4cCI6MjA2NTMxNTY5M30.W_cxVD4is0GFUql8UqAafM8Tx8rSvP_aeLBDLpqjOuo';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- INVITE CODE TOOLTIP LOGIC ---
// Remove all tooltip logic
// (No updateInviteTooltip, attachInviteTooltipCopyHandler, or tooltip event listeners)

// Helper to generate invite code
function generateInviteCode(length = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Fetch user profile
async function fetchUserProfile(userId) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

// Update user profile
async function updateUserProfile(userId, profile) {
  const { data, error } = await supabase
    .from('users')
    .update(profile)
    .eq('id', userId);
  if (error) throw error;
  return data;
}

// Fetch servers list from Supabase and update sidebar
async function fetchServers() {
  const serverList = document.querySelector('.server-list');
  // Show skeletons while loading
  serverList.innerHTML = '';
  for (let i = 0; i < 5; i++) {
    const skeleton = document.createElement('li');
    skeleton.innerHTML = '<div class="server-skeleton"></div>';
    serverList.appendChild(skeleton);
  }
  try {
    const userId = localStorage.getItem('user_id');
    // Only fetch servers the user is a member of
    const { data, error } = await supabase
      .from('server_members')
      .select('servers:server_id(*, owner:owner_id(display_name))')
      .eq('user_id', userId);
    serverList.innerHTML = '';
    if (error) {
      console.error('Error fetching servers:', error);
      return;
    }
    // Flatten and filter out nulls
    const servers = (data || []).map(sm => sm.servers).filter(Boolean);
    servers.forEach(server => {
      const li = document.createElement('li');
      li.innerHTML = `<img src="${server.icon_url}" alt="${server.name}" title="${server.name}" />`;
      li.style.cursor = 'pointer';
      li.addEventListener('click', () => {
        selectServer(server);
      });
      serverList.appendChild(li);
    });
    // If a server is already selected, keep it selected, else select the first
    if (servers.length > 0 && !window.selectedServer) {
      selectServer(servers[0]);
    }
  } catch (err) {
    serverList.innerHTML = '';
    console.error('Error fetching servers:', err);
  }
}

// Show/hide server header and dropdown
function showServerHeader(server) {
  const header = document.querySelector('.channels-server-header');
  const ownerSpan = document.querySelector('.server-owner-name');
  if (header && ownerSpan) {
    ownerSpan.textContent = `${server.owner && server.owner.display_name ? server.owner.display_name : 'Unknown'}'s Server`;
    header.style.display = 'flex';
  }
}
function hideServerHeader() {
  const header = document.querySelector('.channels-server-header');
  if (header) header.style.display = 'none';
  const dropdown = document.querySelector('.server-dropdown-menu');
  if (dropdown) dropdown.style.display = 'none';
}

// Dropdown logic
const serverHeader = document.querySelector('.channels-server-header');
const dropdownBtn = document.querySelector('.server-dropdown-btn');
const dropdownMenu = document.querySelector('.server-dropdown-menu');
function toggleDropdown(e) {
  e.stopPropagation();
  if (dropdownMenu) {
    const isOpen = dropdownMenu.classList.contains('open');
    if (isOpen) {
      dropdownMenu.classList.remove('open');
      dropdownMenu.style.display = 'none';
    } else {
      dropdownMenu.classList.add('open');
      dropdownMenu.style.display = 'block';
      // Position dropdown below header
      const headerRect = serverHeader.getBoundingClientRect();
      dropdownMenu.style.top = headerRect.height + 'px';
    }
  }
}
if (serverHeader) serverHeader.addEventListener('click', toggleDropdown);
if (dropdownBtn) dropdownBtn.addEventListener('click', toggleDropdown);
document.addEventListener('mousedown', (e) => {
  if (dropdownMenu && !serverHeader.contains(e.target) && !dropdownMenu.contains(e.target)) {
    dropdownMenu.classList.remove('open');
    dropdownMenu.style.display = 'none';
  }
});

// Server selection logic
window.selectedServer = null;
async function renderServerChannels(server) {
  const channelList = document.querySelector('.channel-list');
  if (!channelList) return;
  // Always clear the channel list and only show placeholder
  channelList.innerHTML = '';
  // Defensive: remove any friend-list-item classes
  Array.from(channelList.querySelectorAll('.friend-list-item')).forEach(el => el.remove());
  // Show placeholder for now
  const li = document.createElement('li');
  li.textContent = 'No channels yet';
  li.style.color = 'var(--text-secondary)';
  li.style.fontStyle = 'italic';
  channelList.appendChild(li);
}
function selectServer(server) {
  currentSidebarView = 'servers'; // Ensure mode is set immediately
  window.selectedServer = server;
  showServerHeader(server);

  // Hide friends header if visible
  const channelsHeader = document.querySelector('.channels-header');
  if (channelsHeader) channelsHeader.style.display = 'none';

  // --- FIX: Clear the channel-list and hide add-friend-btn ---
  const channelList = document.querySelector('.channel-list');
  if (channelList) {
    channelList.innerHTML = '';
    channelList.style.display = '';
    // Defensive: remove any friend-list-item classes
    Array.from(channelList.querySelectorAll('.friend-list-item')).forEach(el => el.remove());
  }
  const addFriendBtn = document.querySelector('.add-friend-btn');
  if (addFriendBtn) addFriendBtn.style.display = 'none';

  // Always render server channels (even if just a placeholder)
  renderServerChannels(server);

  // --- Clear main chat area and header when switching to a server ---
  const channelTitle = document.querySelector('.channel-title');
  if (channelTitle) channelTitle.textContent = '';
  const messagesSection = document.querySelector('.messages');
  if (messagesSection) messagesSection.innerHTML = '<!-- Messages will be dynamically added here -->';
  const chatInput = document.querySelector('.chat-input');
  if (chatInput) chatInput.style.display = '';
}

// Hide server header in friends/DMs mode
function enterFriendsMode() {
  currentSidebarView = 'friends';
  selectedFriendId = null;
  document.querySelector('.friends-btn').classList.add('active');
  // --- DEFENSIVE: Always show .server-list (servers sidebar) ---
  const serverList = document.querySelector('.server-list');
  if (serverList) serverList.style.display = '';
  // --- Show .channel-list (friends/DMs) and clear it ---
  const channelList = document.querySelector('.channel-list');
  if (channelList) {
    channelList.style.display = '';
    channelList.innerHTML = '';
  }
  // --- Hide server header and clear owner name ---
  const serverHeader = document.querySelector('.channels-server-header');
  if (serverHeader) serverHeader.style.display = 'none';
  const ownerSpan = document.querySelector('.server-owner-name');
  if (ownerSpan) ownerSpan.textContent = '';
  // --- Set channels header to Friends ---
  const channelsHeader = document.querySelector('.channels-header');
  if (channelsHeader) {
    channelsHeader.textContent = 'Friends';
    channelsHeader.style.display = '';
  }
  // --- Show only friends UI in channel-list and main area ---
  fetchFriendsAndRequests().then(() => {
    renderFriendsSidebar();
    renderFriendsChat(null);
    renderAddFriendModal();
  });
}
function exitFriendsMode() {
  currentSidebarView = 'servers';
  selectedFriendId = null;
  document.querySelector('.friends-btn').classList.remove('active');
  // --- DEFENSIVE: Always show .server-list (servers sidebar) ---
  const serverList = document.querySelector('.server-list');
  if (serverList) serverList.style.display = '';
  // --- Show .channel-list (server channels) and clear it ---
  const channelList = document.querySelector('.channel-list');
  if (channelList) {
    channelList.style.display = '';
    channelList.innerHTML = '';
  }
  const addFriendBtn = document.querySelector('.add-friend-btn');
  if (addFriendBtn) addFriendBtn.style.display = 'none';
  // --- Set channels header to # Channels ---
  const channelsHeader = document.querySelector('.channels-header');
  if (channelsHeader) {
    channelsHeader.textContent = '# Channels';
    channelsHeader.style.display = '';
  }
  // --- Hide server header if no server selected, else show it ---
  const serverHeader = document.querySelector('.channels-server-header');
  const ownerSpan = document.querySelector('.server-owner-name');
  if (window.selectedServer) {
    if (serverHeader) serverHeader.style.display = 'flex';
    showServerHeader(window.selectedServer);
  } else {
    if (serverHeader) serverHeader.style.display = 'none';
    if (ownerSpan) ownerSpan.textContent = '';
  }
  // --- Clear main area ---
  const channelTitle = document.querySelector('.channel-title');
  if (channelTitle) channelTitle.textContent = '';
  const messagesSection = document.querySelector('.messages');
  if (messagesSection) messagesSection.innerHTML = '<!-- Messages will be dynamically added here -->';
  const chatInput = document.querySelector('.chat-input');
  if (chatInput) chatInput.style.display = '';
}

// --- FRIENDS MODE STATE ---
let currentSidebarView = 'servers'; // 'servers' or 'friends'
let selectedFriendId = null;

// --- FRIEND SYSTEM STATE ---
let friends = [];
let incomingRequests = [];
let sentRequests = [];

// --- FRIENDS LOGIC ---
async function fetchFriendsAndRequests() {
  const userId = localStorage.getItem('user_id');
  if (!userId) return;
  // Fetch friends
  const { data: friendsData } = await supabase
    .from('friends')
    .select('friend_id, users:friend_id(display_name, avatar_url)')
    .eq('user_id', userId);
  friends = (friendsData || []).map(f => ({
    id: f.friend_id,
    name: f.users?.display_name || 'Unknown',
    avatar: f.users?.avatar_url || '',
    status: 'online', // TODO: add real status later
  }));
  // Fetch incoming requests
  const { data: incoming } = await supabase
    .from('friend_requests')
    .select('id, sender_id, status, users:sender_id(display_name)')
    .eq('receiver_id', userId)
    .eq('status', 'pending');
  incomingRequests = (incoming || []).map(r => ({
    id: r.id,
    sender_id: r.sender_id,
    sender_name: r.users?.display_name || r.sender_id,
    status: r.status,
  }));
  // Fetch sent requests
  const { data: sent } = await supabase
    .from('friend_requests')
    .select('id, receiver_id, status, users:receiver_id(display_name)')
    .eq('sender_id', userId);
  sentRequests = (sent || []).map(r => ({
    id: r.id,
    receiver_id: r.receiver_id,
    receiver_name: r.users?.display_name || r.receiver_id,
    status: r.status,
  }));
}

function renderFriendsSidebar() {
  if (currentSidebarView !== 'friends') return;
  const channelsHeader = document.querySelector('.channels-header');
  const channelList = document.querySelector('.channel-list');
  const addFriendBtn = document.querySelector('.add-friend-btn');
  channelsHeader.textContent = 'Friends';
  channelList.innerHTML = '';
  if (addFriendBtn) addFriendBtn.style.display = 'block';
  if (friends.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No friends yet';
    li.style.color = 'var(--text-secondary)';
    li.style.fontStyle = 'italic';
    channelList.appendChild(li);
    return;
  }
  friends.forEach(friend => {
    const li = document.createElement('li');
    li.className = 'friend-list-item';
    li.style.display = 'flex';
    li.style.alignItems = 'center';
    li.style.gap = '12px';
    li.style.cursor = 'pointer';
    li.innerHTML = `
      <div style="width:32px;height:32px;border-radius:50%;background:var(--background-secondary);display:flex;align-items:center;justify-content:center;overflow:hidden;border:2px solid var(--accent);">
        ${friend.avatar ? `<img src="${friend.avatar}" alt="${friend.name}" style="width:100%;height:100%;object-fit:cover;display:block;" />` : `<span style=\"font-size:1.2rem;color:var(--accent);\">👤</span>`}
      </div>
      <span style="color:var(--text);font-weight:600;">${friend.name}</span>
      <span style="font-size:0.9rem;color:var(--online);margin-left:auto;">online</span>
    `;
    li.onclick = () => {
      selectedFriendId = friend.id;
      renderFriendsChat(friend);
      openDmWithFriend(friend.id, friend.name);
      document.querySelectorAll('.friend-list-item').forEach(el => el.classList.remove('active'));
      li.classList.add('active');
    };
    channelList.appendChild(li);
  });
}

// Utility to show/hide welcome overlay
function showWelcomeMessage() {
  const welcome = document.getElementById('welcome-message');
  if (welcome) welcome.classList.remove('hide');
}
function hideWelcomeMessage() {
  const welcome = document.getElementById('welcome-message');
  if (welcome) welcome.classList.add('hide');
}

// --- Modify renderFriendsChat to hide welcome overlay when a friend is selected ---
function renderFriendsChat(friend) {
  const chatHeader = document.querySelector('.chat-header');
  const channelTitle = document.querySelector('.channel-title');
  const messagesSection = document.querySelector('.messages');
  const chatInput = document.querySelector('.chat-input');
  channelTitle.textContent = friend ? friend.name : 'Friends';
  chatHeader.style.background = 'var(--background-secondary)';
  messagesSection.innerHTML = '';
  if (!friend) {
    messagesSection.innerHTML = '<div style="color:var(--text-secondary);font-size:1.1rem;text-align:center;margin-top:40px;">Select a friend to start chatting</div>';
    chatInput.style.display = 'none';
    showWelcomeMessage();
    return;
  }
  // Mock DM messages
  messagesSection.innerHTML = `
    <div style="color:var(--text-secondary);font-size:1.1rem;text-align:center;margin-top:40px;">This is the beginning of your direct message with <b>${friend.name}</b>.</div>
  `;
  chatInput.style.display = '';
  hideWelcomeMessage();
  // Animate input
  chatInput.classList.remove('chat-input-animate-in');
  void chatInput.offsetWidth; // force reflow
  chatInput.classList.add('chat-input-animate-in');
  chatInput.addEventListener('animationend', function handler() {
    chatInput.classList.remove('chat-input-animate-in');
    chatInput.removeEventListener('animationend', handler);
  });
}

function renderAddFriendModal() {
  // Incoming Requests
  const incomingSection = document.querySelectorAll('.add-friend-section')[0];
  const incomingList = incomingSection.querySelectorAll('.add-friend-request-row');
  incomingList.forEach(el => el.remove());
  incomingRequests.forEach(req => {
    const row = document.createElement('div');
    row.className = 'add-friend-request-row';
    row.innerHTML = `
      <span class="add-friend-request-username">${req.sender_name}</span>
      <button class="add-friend-accept-btn">Accept</button>
      <button class="add-friend-reject-btn">Reject</button>
    `;
    row.querySelector('.add-friend-accept-btn').onclick = async () => {
      await supabase.from('friend_requests').update({ status: 'accepted' }).eq('id', req.id);
      // Add both as friends
      const userId = localStorage.getItem('user_id');
      await supabase.from('friends').insert([
        { user_id: userId, friend_id: req.sender_id },
        { user_id: req.sender_id, friend_id: userId },
      ]);
      await fetchFriendsAndRequests();
      renderAddFriendModal();
      renderFriendsSidebar();
    };
    row.querySelector('.add-friend-reject-btn').onclick = async () => {
      await supabase.from('friend_requests').update({ status: 'rejected' }).eq('id', req.id);
      await fetchFriendsAndRequests();
      renderAddFriendModal();
    };
    incomingSection.appendChild(row);
  });
  // Sent Requests
  const sentSection = document.querySelectorAll('.add-friend-section')[1];
  const sentList = sentSection.querySelectorAll('.add-friend-request-row');
  sentList.forEach(el => el.remove());
  sentRequests.forEach(req => {
    const row = document.createElement('div');
    row.className = 'add-friend-request-row';
    row.innerHTML = `
      <span class="add-friend-request-username">${req.receiver_name}</span>
      <span class="add-friend-request-status">(${req.status.charAt(0).toUpperCase() + req.status.slice(1)})</span>
    `;
    sentSection.appendChild(row);
  });
}

// --- Real-time DM Chat Logic ---
const socket = io(); // Use same origin for deployment

let currentDmFriendId = null;
let currentDmFriendName = null;

function openDmWithFriend(friendId, friendName) {
  const userId = localStorage.getItem('user_id');
  currentDmFriendId = friendId;
  currentDmFriendName = friendName;
  const friend = friends.find(f => f.id === friendId);
  const friendAvatar = friend ? friend.avatar : '';
  const friendStatus = friend ? friend.status : 'online';
  socket.emit('join_dm', { userId, friendId });
  fetch(`/dm/${userId}/${friendId}`)
    .then(res => res.json())
    .then(messages => renderDmMessages(messages, friendName, friendAvatar, friendStatus));
}

function sendDmMessage(content, file_url, file_type, file_name) {
  const from = localStorage.getItem('user_id');
  const to = currentDmFriendId;
  if ((!content.trim() && !file_url) || !to) return;
  socket.emit('dm_message', { from, to, content, file_url, file_type, file_name });
}

socket.on('dm_message', (msg) => {
  if (
    (msg.from === currentDmFriendId && msg.to === localStorage.getItem('user_id')) ||
    (msg.from === localStorage.getItem('user_id') && msg.to === currentDmFriendId)
  ) {
    const friend = friends.find(f => f.id === currentDmFriendId);
    const friendAvatar = friend ? friend.avatar : '';
    const friendStatus = friend ? friend.status : 'online';
    appendDmMessage(msg, currentDmFriendName, friendAvatar, msg.from === localStorage.getItem('user_id'), !msg.from === localStorage.getItem('user_id'), false, true);
    document.querySelector('.messages').scrollTop = document.querySelector('.messages').scrollHeight;
  }
});

// --- Modify renderDmMessages to hide welcome overlay when messages are rendered ---
function renderDmMessages(messages, friendName, friendAvatar, friendStatus) {
  const chatHeader = document.querySelector('.chat-header');
  const channelTitle = document.querySelector('.channel-title');
  channelTitle.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;">
      <img src="${friendAvatar || ''}" alt="${friendName}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;${friendAvatar ? '' : 'display:none;'}" />
      <span style="font-weight:600;">${friendName || 'Friend'}</span>
      <span style="font-size:0.95rem;color:var(--online);margin-left:8px;">${friendStatus || 'online'}</span>
    </div>
  `;
  chatHeader.style.background = 'var(--background-secondary)';
  const messagesSection = document.querySelector('.messages');
  messagesSection.innerHTML = '';
  let lastSender = null;
  let lastTime = null;
  // Normalize all messages to have .from and .to
  const normalizedMessages = messages.map(msg => ({
    ...msg,
    from: msg.from || msg.sender_id,
    to: msg.to || msg.receiver_id,
  }));
  normalizedMessages.forEach((msg, i) => {
    const isMine = msg.from === localStorage.getItem('user_id');
    const showAvatar = !isMine && (lastSender !== msg.from);
    const showName = !isMine && (lastSender !== msg.from);
    const showTime = !lastTime || Math.abs(new Date(msg.created_at) - new Date(lastTime)) > 5 * 60 * 1000;
    appendDmMessage(msg, friendName, friendAvatar, isMine, showAvatar, showName, showTime);
    lastSender = msg.from;
    lastTime = msg.created_at;
  });
  messagesSection.scrollTop = messagesSection.scrollHeight;
  if (normalizedMessages.length > 0) {
    hideWelcomeMessage();
  } else {
    showWelcomeMessage();
  }
}

function formatFullTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function appendDmMessage(msg, friendName, friendAvatar, isMine, showAvatar, showName, showTime) {
  const messagesSection = document.querySelector('.messages');
  const div = document.createElement('div');
  div.className = isMine ? 'dm-message mine' : 'dm-message';
  let checkHtml = '';
  if (isMine) {
    checkHtml = '<span class="dm-message-check read">&#10003;&#10003;</span>';
  }
  const fullTime = formatFullTime(msg.created_at);
  let fileHtml = '';
  if (msg.file_url) {
    if (msg.file_type === 'image') {
      fileHtml = `<img src="${msg.file_url}" class="dm-msg-img" style="max-width:220px;max-height:180px;border-radius:10px;box-shadow:0 2px 8px var(--shadow);margin-bottom:4px;cursor:pointer;transition:box-shadow 0.2s;" onclick="window.open('${msg.file_url}','_blank')" />`;
    } else if (msg.file_type === 'video') {
      fileHtml = `<video src="${msg.file_url}" class="dm-msg-video" style="max-width:220px;max-height:180px;border-radius:10px;box-shadow:0 2px 8px var(--shadow);margin-bottom:4px;" controls></video>`;
    } else if (msg.file_type === 'audio') {
      fileHtml = `<audio src="${msg.file_url}" class="dm-msg-audio" style="width:180px;margin-bottom:4px;" controls></audio>`;
    } else if (msg.file_type === 'document') {
      fileHtml = `<a href="${msg.file_url}" class="dm-msg-doc" target="_blank" style="display:flex;align-items:center;gap:8px;color:var(--accent);font-weight:600;text-decoration:none;margin-bottom:4px;"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="12" height="12" rx="2"/><line x1="8" y1="8" x2="12" y2="8"/><line x1="8" y1="12" x2="12" y2="12"/></svg>${msg.file_name || 'Document'}</a>`;
    }
  }
  div.innerHTML = `
    <div class="dm-message-bubble-wrapper" style="display:flex;align-items:flex-end;${isMine ? 'justify-content:flex-end;' : ''}">
      ${!isMine && showAvatar ? `<img src="${friendAvatar || ''}" alt="${friendName}" class="dm-message-avatar" style="width:28px;height:28px;border-radius:50%;object-fit:cover;margin-right:8px;${friendAvatar ? '' : 'display:none;'}" />` : ''}
      <div class="dm-message-bubble dm-message-animate-in" data-content="${escapeHtml(msg.content)}" data-time="${fullTime}" title="${fullTime}">
        ${!isMine && showName ? `<div class="dm-message-sender" style="font-size:0.92rem;color:var(--accent);font-weight:500;">${friendName}</div>` : ''}
        ${fileHtml}
        <span class="dm-message-content">${escapeHtml(msg.content)}"
          ${showTime ? `<span class="dm-message-meta">${formatTime(msg.created_at)}</span>` : ''}
          ${checkHtml}
        </span>
        <div class="dm-message-tooltip" style="display:none;position:absolute;bottom:100%;left:50%;transform:translateX(-50%) translateY(-8px);background:var(--accent);color:#fff;padding:3px 10px;border-radius:8px;font-size:0.92em;white-space:nowrap;box-shadow:0 2px 8px rgba(40,16,80,0.13);z-index:10;">Copied!</div>
      </div>
    </div>
  `;
  messagesSection.appendChild(div);
  const bubble = div.querySelector('.dm-message-bubble');
  if (bubble) {
    bubble.addEventListener('animationend', function handler() {
      bubble.classList.remove('dm-message-animate-in');
      bubble.removeEventListener('animationend', handler);
    });
    bubble.addEventListener('click', function(e) {
      const content = bubble.getAttribute('data-content');
      if (!content) return;
      navigator.clipboard.writeText(content);
      const tooltip = bubble.querySelector('.dm-message-tooltip');
      if (tooltip) {
        tooltip.style.display = 'block';
        setTimeout(() => { tooltip.style.display = 'none'; }, 1200);
      }
    });
  }
  messagesSection.scrollTo({ top: messagesSection.scrollHeight, behavior: 'smooth' });
}

function escapeHtml(text) {
  return text.replace(/[&<>'\"]/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[c]));
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

document.addEventListener('DOMContentLoaded', function() {
  // Fetch servers list on page load
  fetchServers();
  const addServerBtn = document.querySelector('.add-server');
  const modal = document.getElementById('create-server-modal');
  const closeBtn = document.querySelector('.modal-close');
  const backBtn = document.querySelector('.modal-back');
  const modalContent = document.querySelector('.modal-content');

  function openModal() {
    // Calculate the center of the + button
    const btnRect = addServerBtn.getBoundingClientRect();
    const btnCenterX = btnRect.left + btnRect.width / 2;
    const btnCenterY = btnRect.top + btnRect.height / 2;
    // Calculate modal-content's top-left
    modal.style.display = 'flex';
    modal.classList.remove('modal-closing');
    // Wait for modal-content to render
    setTimeout(() => {
      const modalRect = modalContent.getBoundingClientRect();
      const originX = btnCenterX - modalRect.left;
      const originY = btnCenterY - modalRect.top;
      modalContent.style.transformOrigin = `${originX}px ${originY}px`;
      modal.classList.add('modal-open');
    }, 10);
    document.body.style.overflow = 'hidden';
  }
  function closeModal() {
    modal.classList.remove('modal-open');
    modal.classList.add('modal-closing');
    setTimeout(() => {
      modal.classList.remove('modal-closing');
      modal.style.display = 'none';
      modalContent.style.transformOrigin = '';
      document.body.style.overflow = '';
    }, 350);
  }

  addServerBtn.addEventListener('click', openModal);
  closeBtn.addEventListener('click', closeModal);
  backBtn.addEventListener('click', closeModal);

  // Close modal on Escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeModal();
  });

  // Close modal when clicking outside modal content
  modal.addEventListener('mousedown', function(e) {
    if (!modalContent.contains(e.target)) closeModal();
  });

  // Cloudinary upload function
  async function uploadToCloudinary(file, type) {
    const url = `https://api.cloudinary.com/v1_1/dbriuheef/${type}/upload`;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'user_media'); // Use the correct unsigned preset
    const res = await fetch(url, {
      method: 'POST',
      body: formData
    });
    if (!res.ok) throw new Error('Upload failed');
    const data = await res.json();
    return data.secure_url;
  }

  // --- CROPPER.JS INTEGRATION ---
  let cropper = null;
  let cropperType = null; // 'avatar' or 'banner'
  let cropperFile = null;
  const cropperModal = document.getElementById('cropper-modal');
  const cropperImage = document.getElementById('cropper-image');
  const cropperCancel = document.getElementById('cropper-cancel');
  const cropperConfirm = document.getElementById('cropper-confirm');
  const cropperLoading = document.getElementById('cropper-loading');

  // Helper: open cropper modal
  function openCropper(file, type) {
    cropperType = type;
    cropperFile = file;
    const reader = new FileReader();
    reader.onload = function(e) {
      cropperImage.src = e.target.result;
      cropperModal.style.display = 'flex';
      cropper = new Cropper(cropperImage, {
        aspectRatio: type === 'avatar' ? 1 : (type === 'server' ? 1 : 4/1),
        viewMode: 1,
        background: false,
        autoCropArea: 1,
      });
    };
    reader.readAsDataURL(file);
  }
  // Helper: close cropper modal
  function closeCropper() {
    cropperModal.style.display = 'none';
    if (cropper) { cropper.destroy(); cropper = null; }
    cropperImage.src = '';
    cropperType = null;
    cropperFile = null;
  }
  cropperCancel.addEventListener('click', closeCropper);

  cropperConfirm.addEventListener('click', async function() {
    if (!cropper) return;
    cropperConfirm.disabled = true;
    cropperLoading.classList.add('flex');
    if (cropperType === 'banner-video') {
      // Get crop data
      const cropData = cropper.getData();
      // Upload original video to Cloudinary
      try {
        const url = await uploadToCloudinary(cropperFile, 'video');
        // Save crop data and url to Supabase
        await supabase.from('users').update({ banner_url: url, banner_crop: JSON.stringify(cropData) }).eq('id', localStorage.getItem('user_id'));
        // Immediately update UI
        const bannerVideo = document.querySelector('.profile-banner-video');
        const bannerImg = document.querySelector('.profile-banner');
        bannerVideo.style.display = 'block';
        bannerImg.style.display = 'none';
        bannerVideo.src = '';
        bannerVideo.src = url;
        bannerVideo.style.objectFit = 'cover';
        bannerVideo.style.objectPosition = 'center';
        // Save crop data to hidden input for later use
        document.querySelector('.banner-crop-data').value = JSON.stringify(cropData);
      } catch (err) {
        alert('Upload failed. Please try again.');
      } finally {
        cropperLoading.classList.remove('flex');
        cropperConfirm.disabled = false;
        closeCropper();
      }
      return;
    }
    cropper.getCroppedCanvas().toBlob(async (blob) => {
      try {
        // Upload cropped image to Cloudinary
        const url = await uploadToCloudinary(blob, 'image');
        if (cropperType === 'avatar') {
          document.querySelector('.profile-avatar').src = url;
          document.querySelector('.profile-avatar').style.display = 'block';
          // Save to Supabase
          await supabase.from('users').update({ avatar_url: url }).eq('id', localStorage.getItem('user_id'));
        } else if (cropperType === 'banner') {
          // Immediately update UI
          const bannerImg = document.querySelector('.profile-banner');
          const bannerVideo = document.querySelector('.profile-banner-video');
          bannerImg.src = url;
          bannerImg.style.display = 'block';
          bannerVideo.style.display = 'none';
          await supabase.from('users').update({ banner_url: url }).eq('id', localStorage.getItem('user_id'));
        } else if (cropperType === 'server') {
          serverIconUrl = url;
          document.querySelector('.icon-upload-circle').style.backgroundImage = `url('${serverIconUrl}')`;
          document.querySelector('.icon-upload-circle').style.backgroundSize = 'cover';
          document.querySelector('.icon-upload-plus').style.display = 'none';
          document.querySelector('.icon-upload-camera').style.display = 'none';
          document.querySelector('.icon-upload-text').textContent = 'UPLOADED';
          checkCreateBtn();
        }
        closeCropper();
      } catch (err) {
        alert('Upload failed. Please try again.');
      } finally {
        cropperLoading.classList.remove('flex');
        cropperConfirm.disabled = false;
      }
    }, 'image/jpeg', 0.95);
  });

  // Avatar/Banner change event listeners (use cropper)
  const avatarInput = document.createElement('input');
  avatarInput.type = 'file';
  avatarInput.accept = 'image/*';
  const bannerInput = document.createElement('input');
  bannerInput.type = 'file';
  bannerInput.accept = 'image/*,video/*';

  document.querySelector('.change-avatar-btn').addEventListener('click', () => avatarInput.click());
  document.querySelector('.change-banner-btn').addEventListener('click', () => bannerInput.click());
  avatarInput.addEventListener('change', (e) => {
    if (e.target.files[0]) openCropper(e.target.files[0], 'avatar');
  });
  bannerInput.addEventListener('change', async (e) => {
    if (!e.target.files[0]) return;
    const file = e.target.files[0];
    const isVideo = file.type.startsWith('video/');
    if (!isVideo) {
      // Image or GIF: use cropper as before
      openCropper(file, 'banner');
      return;
    }
    // --- Video: extract first frame for cropping ---
    const video = document.createElement('video');
    video.src = URL.createObjectURL(file);
    video.muted = true;
    video.playsInline = true;
    video.currentTime = 0.1;
    video.addEventListener('loadeddata', function onLoaded() {
      video.removeEventListener('loadeddata', onLoaded);
      // Draw first frame to canvas
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      // Use canvas as cropper image
      cropperType = 'banner-video';
      cropperFile = file;
      cropperImage.src = canvas.toDataURL('image/jpeg');
      cropperModal.style.display = 'flex';
      cropper = new Cropper(cropperImage, {
        aspectRatio: 4/1,
        viewMode: 1,
        background: false,
        autoCropArea: 1,
      });
    });
  });

  // --- CREATE SERVER LOGIC ---
  const serverIconInput = document.getElementById('server-icon-upload');
  const serverNameInput = document.getElementById('server-name');
  const createBtn = document.querySelector('.modal-create');
  let serverIconUrl = '';

  // Handle icon upload for server
  serverIconInput.addEventListener('change', async (e) => {
    if (e.target.files[0]) {
      try {
        createBtn.disabled = true;
        createBtn.textContent = 'Uploading...';
        // Open cropper for server icon
        openCropper(e.target.files[0], 'server');
      } catch (err) {
        alert('Icon upload failed.');
        createBtn.textContent = 'Create';
      }
    }
  });

  // Enable Create button only if name and icon are present
  serverNameInput.addEventListener('input', checkCreateBtn);
  function checkCreateBtn() {
    createBtn.disabled = !(serverNameInput.value.trim() && serverIconUrl);
  }

  // Handle Create button click
  createBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    if (!serverNameInput.value.trim() || !serverIconUrl) return;
    createBtn.disabled = true;
    createBtn.textContent = 'Creating...';
    try {
      // Use actual user ID from localStorage
      const ownerId = localStorage.getItem('user_id');
      if (!ownerId) {
        alert('You must be logged in to create a server.');
        createBtn.textContent = 'Create';
        createBtn.disabled = false;
        return;
      }
      const inviteCode = generateInviteCode();
      const { data, error } = await supabase.from('servers').insert([
        {
          name: serverNameInput.value.trim(),
          icon_url: serverIconUrl,
          owner_id: ownerId,
          invite_code: inviteCode
        }
      ]).select();
      if (error) throw error;
      const newServer = data && data[0];
      if (newServer) {
        const { error: memberError } = await supabase.from('server_members').insert([
          { server_id: newServer.id, user_id: ownerId }
        ]);
        if (memberError) {
          console.error('Failed to add creator as server member:', memberError.message);
          alert('Failed to add you as a server member: ' + memberError.message);
        }
      }
      // Hide modal and all options
      closeModal();
      // Show new minimal success feedback
      showServerSuccess();
      // Refresh servers list in sidebar
      await fetchServers();
      // Reset form
      createBtn.textContent = 'Create';
      createBtn.disabled = false;
      serverNameInput.value = '';
      serverIconUrl = '';
      document.querySelector('.icon-upload-circle').style.backgroundImage = '';
      document.querySelector('.icon-upload-plus').style.display = '';
      document.querySelector('.icon-upload-camera').style.display = '';
      document.querySelector('.icon-upload-text').textContent = 'UPLOAD';
    } catch (err) {
      alert('Failed to create server: ' + err.message);
      createBtn.textContent = 'Create';
      createBtn.disabled = false;
    }
  });

  // --- AUTH OVERLAY LOGIC ---
  const authOverlay = document.getElementById('auth-overlay');
  const loginForm = document.getElementById('auth-login-form');
  const signupForm = document.getElementById('auth-signup-form');
  const showSignup = document.getElementById('show-signup');
  const showLogin = document.getElementById('show-login');

  // AUTH MESSAGE HANDLER
  const authMessage = document.getElementById('auth-message');
  function showAuthMessage(msg) {
    authMessage.textContent = msg;
    authMessage.style.display = 'block';
  }
  function hideAuthMessage() {
    authMessage.textContent = '';
    authMessage.style.display = 'none';
  }

  // On page load, hide auth overlay if user is logged in
  if (localStorage.getItem('user_id')) {
    authOverlay.style.display = 'none';
    // Set display name in profile
    const profileName = document.querySelector('.profile-name');
    if (profileName) {
      profileName.textContent = localStorage.getItem('display_name') || 'Username';
    }
    // Set user ID in profile (shortened)
    const profileId = document.querySelector('.profile-id');
    const userId = localStorage.getItem('user_id');
    if (profileId && userId) {
      profileId.textContent = userId.length > 12 ? userId.slice(0, 6) + '...' + userId.slice(-4) : userId;
      profileId.setAttribute('data-full-id', userId);
    }
  } else {
    authOverlay.style.display = 'flex';
  }

  // Animate text on load (already handled by CSS keyframes)

  // Switch to signup
  showSignup.addEventListener('click', function(e) {
    e.preventDefault();
    loginForm.classList.add('slide-out');
    setTimeout(() => {
      loginForm.style.display = 'none';
      loginForm.classList.remove('slide-out');
      signupForm.style.display = 'flex';
      signupForm.classList.add('slide-in');
      setTimeout(() => signupForm.classList.remove('slide-in'), 500);
    }, 500);
  });
  // Switch to login
  showLogin.addEventListener('click', function(e) {
    e.preventDefault();
    signupForm.classList.add('slide-out');
    setTimeout(() => {
      signupForm.style.display = 'none';
      signupForm.classList.remove('slide-out');
      loginForm.style.display = 'flex';
      loginForm.classList.add('slide-in');
      setTimeout(() => loginForm.classList.remove('slide-in'), 500);
    }, 500);
  });

  // SIGNUP LOGIC (no bcrypt, plain text password)
  signupForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    hideAuthMessage();
    const displayName = document.getElementById('signup-display-name').value.trim();
    const password = document.getElementById('signup-password').value;
    if (!displayName || !password) return showAuthMessage('Please fill all fields.');
    try {
      // Check if display name is taken
      const { data: existing, error: findErr } = await supabase
        .from('users')
        .select('id')
        .eq('display_name', displayName)
        .single();
      if (existing) return showAuthMessage('Display name already taken.');
      // Insert user (plain text password)
      const { data, error } = await supabase
        .from('users')
        .insert([{ display_name: displayName, password: password }])
        .select();
      if (error || !data || !data[0]) throw error || new Error('Signup failed.');
      // Log the user in immediately
      localStorage.setItem('user_id', data[0].id);
      localStorage.setItem('display_name', data[0].display_name);
      authOverlay.style.display = 'none';
      hideAuthMessage();
    } catch (err) {
      showAuthMessage('Signup failed: ' + (err.message || err));
    }
  });

  // LOGIN LOGIC (no bcrypt, plain text password)
  loginForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    hideAuthMessage();
    const displayName = document.getElementById('login-display-name').value.trim();
    const password = document.getElementById('login-password').value;
    if (!displayName || !password) return showAuthMessage('Please fill all fields.');
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('display_name', displayName)
        .single();
      if (error || !user) return showAuthMessage('User not found.');
      if (user.password !== password) return showAuthMessage('Incorrect password.');
      // Store user in localStorage/session (for demo)
      localStorage.setItem('user_id', user.id);
      localStorage.setItem('display_name', user.display_name);
      authOverlay.style.display = 'none';
      hideAuthMessage();
      // Reload the main page to update UI
      window.location.reload();
    } catch (err) {
      showAuthMessage('Login failed: ' + (err.message || err));
    }
  });

  // LOGOUT BUTTON LOGIC
  const logoutBtn = document.querySelector('.logout-account-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function() {
      localStorage.removeItem('user_id');
      localStorage.removeItem('display_name');
      // Optionally clear other user data

      // Reset UI fields
      const profileName = document.querySelector('.profile-name');
      if (profileName) profileName.textContent = 'Username';
      const profileId = document.querySelector('.profile-id');
      if (profileId) {
        profileId.textContent = '#0000';
        profileId.removeAttribute('data-full-id');
      }
      const profileAvatar = document.querySelector('.profile-avatar');
      if (profileAvatar) {
        profileAvatar.src = '';
        profileAvatar.style.display = 'none';
      }
      const bannerImg = document.querySelector('.profile-banner');
      if (bannerImg) {
        bannerImg.src = '';
        bannerImg.style.display = 'none';
      }
      const bannerVideo = document.querySelector('.profile-banner-video');
      if (bannerVideo) {
        bannerVideo.src = '';
        bannerVideo.style.display = 'none';
      }
      const profileBio = document.querySelector('.profile-bio');
      if (profileBio) profileBio.textContent = 'This is your bio. Tell us about yourself!';

      // Show auth overlay
      authOverlay.style.display = 'flex';
    });
  }

  // On page load, fetch avatar/banner/bio from Supabase
  async function loadUserProfileImages() {
    const userId = localStorage.getItem('user_id');
    if (!userId) return;
    const { data: user, error } = await supabase.from('users').select('avatar_url, banner_url, banner_crop, bio').eq('id', userId).single();
    if (user) {
      if (user.avatar_url) {
        document.querySelector('.profile-avatar').src = user.avatar_url;
        document.querySelector('.profile-avatar').style.display = 'block';
      }
      // Banner logic
      const bannerImg = document.querySelector('.profile-banner');
      const bannerVideo = document.querySelector('.profile-banner-video');
      bannerImg.style.display = 'none';
      bannerVideo.style.display = 'none';
      if (user.banner_url) {
        if (/\.(mp4|webm|mov)$/i.test(user.banner_url)) {
          // Video
          bannerVideo.style.display = 'block';
          bannerImg.style.display = 'none';
          bannerVideo.src = '';
          bannerVideo.src = user.banner_url;
          bannerVideo.style.objectFit = 'cover';
          bannerVideo.style.objectPosition = 'center';
        } else {
          // Image or GIF
          bannerImg.src = user.banner_url;
          bannerImg.style.display = 'block';
          bannerVideo.style.display = 'none';
        }
      }
      if (user.bio !== undefined && user.bio !== null) {
        const profileBioSpan = document.querySelector('.profile-bio');
        if (profileBioSpan) profileBioSpan.textContent = user.bio;
      }
    }
  }
  loadUserProfileImages();

  // Copy full user ID on copy button click
  const copyIdBtn = document.querySelector('.copy-id-btn');
  if (copyIdBtn) {
    copyIdBtn.addEventListener('click', function() {
      const profileId = document.querySelector('.profile-id');
      const fullId = profileId ? profileId.getAttribute('data-full-id') : '';
      if (fullId) {
        navigator.clipboard.writeText(fullId);
        // Show copied feedback
        copyIdBtn.textContent = 'Copied!';
        setTimeout(() => {
          copyIdBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="5" width="10" height="10" rx="2" stroke="currentColor" stroke-width="1.5"/><rect x="2.5" y="2.5" width="10" height="10" rx="2" stroke="currentColor" stroke-width="1.5"/></svg>';
        }, 1200);
      }
    });
  }

  // --- ANIMATED EDIT FIELDS FOR NAME & BIO ---
  // Name
  const editNameBtn = document.querySelector('.edit-name-btn');
  const saveNameBtn = document.querySelector('.save-name-btn');
  const cancelNameBtn = document.querySelector('.cancel-name-btn');
  const profileNameSpan = document.querySelector('.profile-name');
  const profileNameInput = document.querySelector('.profile-name-input');
  let originalName = '';
  if (editNameBtn && saveNameBtn && cancelNameBtn && profileNameSpan && profileNameInput) {
    editNameBtn.addEventListener('click', () => {
      originalName = profileNameSpan.textContent;
      profileNameInput.value = originalName;
      profileNameSpan.classList.add('editing');
      profileNameInput.classList.add('editing');
      saveNameBtn.classList.add('show');
      cancelNameBtn.classList.add('show');
      editNameBtn.style.display = 'none';
      profileNameInput.style.display = 'block';
      profileNameInput.focus();
    });
    cancelNameBtn.addEventListener('click', () => {
      profileNameSpan.classList.remove('editing');
      profileNameInput.classList.remove('editing');
      saveNameBtn.classList.remove('show');
      cancelNameBtn.classList.remove('show');
      editNameBtn.style.display = '';
      profileNameInput.style.display = 'none';
    });
    saveNameBtn.addEventListener('click', async () => {
      const newName = profileNameInput.value.trim();
      if (!newName) return;
      // Update in Supabase
      await supabase.from('users').update({ display_name: newName }).eq('id', localStorage.getItem('user_id'));
      profileNameSpan.textContent = newName;
      localStorage.setItem('display_name', newName);
      profileNameSpan.classList.remove('editing');
      profileNameInput.classList.remove('editing');
      saveNameBtn.classList.remove('show');
      cancelNameBtn.classList.remove('show');
      editNameBtn.style.display = '';
      profileNameInput.style.display = 'none';
    });
  }
  // Bio (edit on click, save on blur, show feedback)
  const editBioBtn = document.querySelector('.edit-bio-btn');
  const profileBioSpan = document.querySelector('.profile-bio');
  const profileBioInput = document.querySelector('.profile-bio-input');
  const bioFeedback = document.getElementById('bio-feedback');
  const bioFeedbackSvg = document.getElementById('bio-feedback-svg');
  let originalBio = '';
  if (editBioBtn && profileBioSpan && profileBioInput && bioFeedback && bioFeedbackSvg) {
    editBioBtn.addEventListener('click', () => {
      originalBio = profileBioSpan.textContent;
      profileBioInput.value = originalBio;
      profileBioSpan.classList.add('editing');
      profileBioInput.classList.add('editing');
      profileBioInput.style.display = 'block';
      profileBioInput.focus();
      profileBioSpan.style.display = 'none';
    });
    profileBioInput.addEventListener('blur', async () => {
      const newBio = profileBioInput.value.trim();
      // Update in Supabase
      await supabase.from('users').update({ bio: newBio }).eq('id', localStorage.getItem('user_id'));
      profileBioSpan.textContent = newBio;
      profileBioSpan.classList.remove('editing');
      profileBioInput.classList.remove('editing');
      profileBioInput.style.display = 'none';
      profileBioSpan.style.display = '';
      // Show feedback with SVG animation
      bioFeedback.classList.add('show');
      // Reset SVG animations
      const circle = bioFeedbackSvg.querySelector('circle');
      const check = bioFeedbackSvg.querySelector('path');
      circle.style.animation = 'none';
      check.style.animation = 'none';
      void circle.offsetWidth; // force reflow
      void check.offsetWidth;
      circle.style.animation = '';
      check.style.animation = '';
      setTimeout(() => {
        bioFeedback.classList.remove('show');
      }, 1800);
    });
  }

  // --- AUTH HEADING EMERGE ANIMATION ---
  const authHeading = document.getElementById('auth-heading');
  if (authHeading) {
    setTimeout(() => {
      authHeading.classList.add('show-bottom');
    }, 1200);
  }

  // --- SERVER SUCCESS FEEDBACK ---
  const serverSuccessPopup = document.getElementById('server-success-popup');
  const serverSuccessSvg = document.getElementById('server-success-svg');
  function showServerSuccess() {
    if (!serverSuccessPopup || !serverSuccessSvg) return;
    serverSuccessPopup.classList.add('show');
    serverSuccessPopup.style.display = 'flex';
    // Reset SVG animations
    const circle = serverSuccessSvg.querySelector('circle');
    const check = serverSuccessSvg.querySelector('path');
    circle.style.animation = 'none';
    check.style.animation = 'none';
    void circle.offsetWidth;
    void check.offsetWidth;
    circle.style.animation = '';
    check.style.animation = '';
    setTimeout(() => {
      serverSuccessPopup.classList.remove('show');
      serverSuccessPopup.style.display = 'none';
    }, 1800);
  }

  // --- FRIENDS BUTTON EVENT ---
  const friendsBtn = document.querySelector('.friends-btn');
  if (friendsBtn) {
    friendsBtn.addEventListener('click', function() {
      if (currentSidebarView !== 'friends') {
        enterFriendsMode();
      }
    });
  }

  // --- ADD FRIEND MODAL LOGIC ---
  const addFriendBtn = document.querySelector('.add-friend-btn');
  const addFriendModal = document.getElementById('add-friend-modal');
  const addFriendModalContent = document.querySelector('.add-friend-modal-content');
  const addFriendModalClose = document.querySelector('.add-friend-modal-close');
  const addFriendForm = document.querySelector('.add-friend-form');

  function openAddFriendModal() {
    if (!addFriendModal) return;
    addFriendModal.classList.remove('modal-closing');
    addFriendModal.style.display = 'flex';
    setTimeout(() => {
      addFriendModal.classList.add('modal-open');
    }, 10);
    document.body.style.overflow = 'hidden';
  }
  function closeAddFriendModal() {
    if (!addFriendModal) return;
    addFriendModal.classList.remove('modal-open');
    addFriendModal.classList.add('modal-closing');
    setTimeout(() => {
      addFriendModal.style.display = 'none';
      addFriendModal.classList.remove('modal-closing');
      document.body.style.overflow = '';
    }, 350);
  }
  if (addFriendBtn) {
    addFriendBtn.addEventListener('click', function(e) {
      e.preventDefault();
      openAddFriendModal();
    });
  }
  if (addFriendModalClose) {
    addFriendModalClose.addEventListener('click', closeAddFriendModal);
  }
  // Close modal on Escape key
  if (addFriendModal) {
    document.addEventListener('keydown', function(e) {
      if (addFriendModal.style.display === 'flex' && e.key === 'Escape') closeAddFriendModal();
    });
    // Close modal when clicking outside modal content
    addFriendModal.addEventListener('mousedown', function(e) {
      if (!addFriendModalContent.contains(e.target)) closeAddFriendModal();
    });
  }

  // Add Friend Form Submission (moved inside DOMContentLoaded)
  if (addFriendForm) {
    addFriendForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      const input = addFriendForm.querySelector('.add-friend-input');
      const friendId = input.value.trim();
      const userId = localStorage.getItem('user_id');
      if (!friendId || friendId === userId) return;
      // Check if already friends or request exists
      const { data: existing } = await supabase
        .from('friend_requests')
        .select('*')
        .or(`and(sender_id.eq.${userId},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${userId})`)
        .neq('status', 'rejected');
      if (existing && existing.length > 0) return;
      await supabase.from('friend_requests').insert({ sender_id: userId, receiver_id: friendId, status: 'pending' });
      input.value = '';
      await fetchFriendsAndRequests();
      renderAddFriendModal();
    });
  }

  // Live update (polling for now)
  setInterval(async () => {
    if (currentSidebarView === 'friends') {
      await fetchFriendsAndRequests();
      renderFriendsSidebar();
      renderAddFriendModal();
    }
  }, 3000);

  showWelcomeMessage();

  // --- JOIN SERVER MODAL LOGIC (profile section) ---
  const joinServerBtn = document.querySelector('.join-server-btn');
  const joinModal = document.getElementById('profile-join-server-modal');
  const joinInput = joinModal ? joinModal.querySelector('.profile-join-input') : null;
  const joinConfirmBtn = joinModal ? joinModal.querySelector('.profile-join-confirm-btn') : null;
  const joinCloseBtn = joinModal ? joinModal.querySelector('.profile-join-modal-close') : null;
  const joinFeedback = joinModal ? joinModal.querySelector('.profile-join-feedback') : null;

  function showJoinModal() {
    if (!joinModal) return;
    joinModal.style.display = 'flex';
    setTimeout(() => {
      joinModal.classList.add('open');
      if (joinInput) {
        joinInput.value = '';
        joinInput.focus();
      }
      if (joinFeedback) {
        joinFeedback.textContent = '';
        joinFeedback.classList.remove('show');
      }
    }, 10);
  }
  function hideJoinModal() {
    if (!joinModal) return;
    joinModal.classList.remove('open');
    setTimeout(() => {
      joinModal.style.display = 'none';
    }, 320);
  }
  if (joinServerBtn) {
    joinServerBtn.addEventListener('click', function(e) {
      e.preventDefault();
      showJoinModal();
    });
  }
  if (joinCloseBtn) {
    joinCloseBtn.addEventListener('click', function(e) {
      e.preventDefault();
      hideJoinModal();
    });
  }
  if (joinModal) {
    joinModal.addEventListener('mousedown', function(e) {
      if (e.target === joinModal) hideJoinModal();
    });
  }
  if (joinConfirmBtn && joinInput) {
    joinConfirmBtn.addEventListener('click', async function() {
      const code = joinInput.value.trim();
      if (!code) {
        showJoinFeedback('Please enter an invite code.', false);
        joinInput.focus();
        return;
      }
      joinConfirmBtn.disabled = true;
      showJoinFeedback('Joining...', true);
      // Simulate loading
      try {
        // Try to find the server by invite code
        const { data: servers, error } = await supabase.from('servers').select('*').eq('invite_code', code);
        if (error || !servers || servers.length === 0) {
          showJoinFeedback('Invalid invite code.', false);
          joinConfirmBtn.disabled = false;
          return;
        }
        const server = servers[0];
        // Add user as member if not already
        const userId = localStorage.getItem('user_id');
        const { data: existing } = await supabase.from('server_members').select('*').eq('server_id', server.id).eq('user_id', userId);
        if (existing && existing.length > 0) {
          showJoinFeedback('You are already a member!', false);
          joinConfirmBtn.disabled = false;
          return;
        }
        await supabase.from('server_members').insert({ server_id: server.id, user_id: userId });
        showJoinFeedback('Joined! 🎉', true);
        setTimeout(() => {
          hideJoinModal();
          fetchServers();
        }, 1200);
      } catch (err) {
        showJoinFeedback('Failed to join. Try again.', false);
      }
      joinConfirmBtn.disabled = false;
    });
    joinInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') joinConfirmBtn.click();
    });
  }
  function showJoinFeedback(msg, success) {
    if (!joinFeedback) return;
    joinFeedback.textContent = msg;
    joinFeedback.style.color = success ? '#7ed957' : '#ff4d4f';
    joinFeedback.classList.add('show');
    joinFeedback.style.opacity = '1';
    setTimeout(() => {
      joinFeedback.classList.remove('show');
      joinFeedback.style.opacity = '0';
    }, success ? 1100 : 1800);
  }

  // --- INVITE PEOPLE: Direct copy on click ---
  const inviteOption = document.querySelector('.invite-people-option');
  if (inviteOption) {
    inviteOption.addEventListener('click', async function(e) {
      e.stopPropagation();
      if (!window.selectedServer || !window.selectedServer.invite_code) {
        showInviteCopyFeedback('No invite code set.');
        return;
      }
      try {
        await navigator.clipboard.writeText(window.selectedServer.invite_code);
        showInviteCopyFeedback('Invite code copied!');
      } catch (err) {
        showInviteCopyFeedback('Copy failed.');
      }
    });
  }
});

// Show a temporary feedback message at the top of the server dropdown
function showInviteCopyFeedback(msg) {
  let feedback = document.getElementById('invite-copy-feedback');
  if (!feedback) {
    feedback = document.createElement('div');
    feedback.id = 'invite-copy-feedback';
    feedback.style.position = 'fixed';
    feedback.style.top = '24px';
    feedback.style.left = '50%';
    feedback.style.transform = 'translateX(-50%)';
    feedback.style.background = 'var(--accent)';
    feedback.style.color = '#fff';
    feedback.style.padding = '10px 24px';
    feedback.style.borderRadius = '12px';
    feedback.style.fontWeight = '600';
    feedback.style.fontSize = '1.08rem';
    feedback.style.boxShadow = '0 2px 16px var(--shadow)';
    feedback.style.zIndex = '9999';
    feedback.style.opacity = '0';
    feedback.style.transition = 'opacity 0.3s';
    document.body.appendChild(feedback);
  }
  feedback.textContent = msg;
  feedback.style.opacity = '1';
  setTimeout(() => {
    feedback.style.opacity = '0';
  }, 1400);
} 
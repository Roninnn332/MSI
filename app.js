const SUPABASE_URL = 'https://tmqwjmebyiqqgevsaquh.supabase.co';

const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRtcXdqbWVieWlxcWdldnNhcXVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk3Mzk2OTMsImV4cCI6MjA2NTMxNTY5M30.W_cxVD4is0GFUql8UqAafM8Tx8rSvP_aeLBDLpqjOuo';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const profileSettingsPreviewBanner = document.querySelector('.profile-settings-preview-banner');

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
  channelList.innerHTML = '';
  Array.from(channelList.querySelectorAll('.friend-list-item')).forEach(el => el.remove());

  // Debug: Log server id
  console.log('renderServerChannels: server.id =', server.id, 'server =', server);

  // Fetch channels from Supabase
  const { data: channels, error } = await supabase
    .from('channels')
    .select('*')
    .eq('server_id', server.id)
    .order('created_at', { ascending: true });

  // Debug: Log query result
  console.log('Supabase channels query result:', { channels, error });

  if (error || !channels || channels.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No channels yet';
    li.style.color = 'var(--text-secondary)';
    li.style.fontStyle = 'italic';
    channelList.appendChild(li);
    return;
  }

  channels.forEach(channel => {
    const li = document.createElement('li');
    li.textContent = (channel.type === 'voice' ? '🔊 ' : '# ') + channel.name;
    li.className = 'channel-list-item';
    li.style.cursor = 'pointer';
    // TODO: Add click handler to select channel, load messages, etc.
    channelList.appendChild(li);
  });
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
  if (friend) hideWelcomeMessage(); // Always hide welcome when a friend is selected
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
  if (normalizedMessages.length > 0) hideWelcomeMessage(); // Always hide welcome if any messages
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
  if (normalizedMessages.length === 0) {
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
        // --- Create default channels immediately after server creation ---
        const { error: channelError } = await supabase.from('channels').insert([
          { server_id: newServer.id, name: 'general', type: 'text', is_private: false },
          { server_id: newServer.id, name: 'General', type: 'voice', is_private: false }
        ]);
        if (channelError) {
          alert('Failed to create default channels: ' + channelError.message);
          console.error('Failed to create default channels:', channelError.message);
        }
        // --- Insert server creation log ---
        const { error: logError } = await supabase.from('server_logs').insert([
          {
            server_id: newServer.id,
            user_id: ownerId,
            action: 'Server created'
          }
        ]);
        if (logError) {
          console.error('Failed to create server log:', logError.message);
        }
        // --- Refresh channel list for the new server ---
        if (typeof renderServerChannels === 'function') {
          renderServerChannels(newServer);
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

  // --- SERVER SETTINGS PANEL LOGIC ---
  const serverSettingsPanel = document.getElementById('server-settings-panel');
  const appContainer = document.querySelector('.app-container');
  const serverSettingsClose = document.querySelector('.server-settings-close');
  const serverSettingsNav = document.querySelector('.server-settings-nav');
  const serverSettingsSectionTitle = document.querySelector('.server-settings-section-title');
  const serverSettingsContents = document.querySelectorAll('.server-settings-content');
  const serverSettingsNameInput = document.querySelector('.server-settings-name-input');
  const serverSettingsIconPreview = document.querySelector('.server-settings-icon-preview');
  const serverSettingsIconBtn = document.querySelector('.server-settings-icon-btn');
  const serverSettingsBannerColors = document.querySelectorAll('.server-settings-banner-color');
  const serverSettingsSaveBtn = document.querySelector('.server-settings-save-btn');
  const serverSettingsFeedback = document.querySelector('.server-settings-feedback');
  const serverSettingsPreviewBanner = document.querySelector('.server-settings-preview-banner');
  const serverSettingsPreviewIcon = document.querySelector('.server-settings-preview-icon img');
  const serverSettingsPreviewName = document.querySelector('.server-settings-preview-name');
  const serverSettingsPreviewDate = document.querySelector('.server-settings-preview-date-val');

  // Helper: open/close
  function openServerSettingsPanel() {
    if (!window.selectedServer) return;
    appContainer.style.display = 'none';
    serverSettingsPanel.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    // Fill form with current server data
    serverSettingsNameInput.value = window.selectedServer.name || '';
    serverSettingsIconPreview.src = window.selectedServer.icon_url || '';
    serverSettingsPreviewIcon.src = window.selectedServer.icon_url || '';
    serverSettingsPreviewName.textContent = window.selectedServer.name || '';
    // Banner color
    let bannerColor = window.selectedServer.banner_color || '#232129';
    serverSettingsBannerColors.forEach(el => {
      el.classList.toggle('selected', el.dataset.color === bannerColor);
      el.style.background = el.dataset.color;
    });
    serverSettingsPreviewBanner.style.background = bannerColor;
    // Date
    if (window.selectedServer.created_at) {
      const d = new Date(window.selectedServer.created_at);
      serverSettingsPreviewDate.textContent = d.toLocaleString('default', { month: 'short', year: 'numeric' });
    } else {
      serverSettingsPreviewDate.textContent = '';
    }
    // --- Update member count in preview ---
    updateServerSettingsPreviewMemberCount();
    // Feedback
    serverSettingsFeedback.textContent = '';
    serverSettingsFeedback.classList.remove('show');
    // Show profile section only
    serverSettingsContents.forEach(c => c.style.display = c.classList.contains('server-settings-section-profile') ? '' : 'none');
    serverSettingsSectionTitle.textContent = 'Server Profile';
    // Nav highlight
    serverSettingsNav.querySelectorAll('li').forEach(li => li.classList.remove('active'));
    serverSettingsNav.querySelector('li[data-section="profile"]').classList.add('active');
  }

  // Update member count in preview card
  async function updateServerSettingsPreviewMemberCount() {
    const previewMembers = document.querySelector('.server-settings-preview-members');
    if (!window.selectedServer || !previewMembers) return;
    // Fetch member count from Supabase
    const { count, error } = await supabase
      .from('server_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('server_id', window.selectedServer.id);
    if (!error && typeof count === 'number') {
      previewMembers.textContent = `${count} Member${count === 1 ? '' : 's'}`;
    } else {
      previewMembers.textContent = '1 Member';
    }
  }

  function closeServerSettingsPanel() {
    serverSettingsPanel.style.display = 'none';
    appContainer.style.display = '';
    document.body.style.overflow = '';
  }
  // Open on dropdown click
  document.addEventListener('click', function(e) {
    if (e.target.closest('.dropdown-option') && e.target.closest('.dropdown-option').textContent.includes('Server Settings')) {
      openServerSettingsPanel();
    }
  });
  // Close on ESC or close btn
  if (serverSettingsClose) {
    serverSettingsClose.addEventListener('click', closeServerSettingsPanel);
  }
  document.addEventListener('keydown', function(e) {
    if (serverSettingsPanel.style.display === 'flex' && (e.key === 'Escape' || e.key === 'Esc')) {
      closeServerSettingsPanel();
    }
  });
  // Nav switching (only profile works for now)
  if (serverSettingsNav) {
    serverSettingsNav.addEventListener('click', function(e) {
      const li = e.target.closest('li[data-section]');
      if (!li) return;
      serverSettingsNav.querySelectorAll('li').forEach(l => l.classList.remove('active'));
      li.classList.add('active');
      const section = li.dataset.section;
      serverSettingsContents.forEach(c => c.style.display = c.classList.contains('server-settings-section-' + section) ? '' : 'none');
      serverSettingsSectionTitle.textContent = li.textContent;
    });
  }
  // Live update preview on name/icon/banner change
  if (serverSettingsNameInput) {
    serverSettingsNameInput.addEventListener('input', function() {
      serverSettingsPreviewName.textContent = serverSettingsNameInput.value;
    });
  }
  if (serverSettingsIconPreview) {
    serverSettingsIconPreview.addEventListener('load', function() {
      serverSettingsPreviewIcon.src = serverSettingsIconPreview.src;
    });
  }
  serverSettingsBannerColors.forEach(el => {
    el.addEventListener('click', function() {
      serverSettingsBannerColors.forEach(c => c.classList.remove('selected'));
      el.classList.add('selected');
      serverSettingsPreviewBanner.style.background = el.dataset.color;
    });
  });
  // Save changes (only name, icon, banner color for now)
  if (serverSettingsSaveBtn) {
    serverSettingsSaveBtn.addEventListener('click', async function() {
      if (!window.selectedServer) return;
      const newName = serverSettingsNameInput.value.trim();
      const newBannerColor = serverSettingsPanel.querySelector('.server-settings-banner-color.selected')?.dataset.color || '#232129';
      // For icon, just use the preview src for now
      const newIconUrl = serverSettingsIconPreview.src;
      serverSettingsSaveBtn.disabled = true;
      serverSettingsFeedback.textContent = 'Saving...';
      serverSettingsFeedback.classList.add('show');
      try {
        await supabase.from('servers').update({
          name: newName,
          icon_url: newIconUrl,
          banner_color: newBannerColor
        }).eq('id', window.selectedServer.id);
        serverSettingsFeedback.textContent = 'Saved!';
        setTimeout(() => serverSettingsFeedback.classList.remove('show'), 1200);
        // Update local server object
        window.selectedServer.name = newName;
        window.selectedServer.icon_url = newIconUrl;
        window.selectedServer.banner_color = newBannerColor;
        fetchServers();
      } catch (err) {
        serverSettingsFeedback.textContent = 'Failed to save.';
        setTimeout(() => serverSettingsFeedback.classList.remove('show'), 1800);
      }
      serverSettingsSaveBtn.disabled = false;
    });
  }
  // Change icon (reuse cropper if available, else just file input for now)
  if (serverSettingsIconBtn) {
    serverSettingsIconBtn.addEventListener('click', function() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async function(e) {
        const file = e.target.files[0];
        if (!file) return;
        // Optionally: use cropper here
        // For now, upload directly
        try {
          const url = await uploadToCloudinary(file, 'image');
          serverSettingsIconPreview.src = url;
          serverSettingsPreviewIcon.src = url;
        } catch (err) {
          alert('Upload failed.');
        }
      };
      input.click();
    });
  }

  // --- SERVER MEMBERS SECTION LOGIC ---
  const serverMembersSection = document.querySelector('.server-settings-section-members');
  const serverMembersTableBody = serverMembersSection ? serverMembersSection.querySelector('tbody') : null;
  const serverMembersCountVal = serverMembersSection ? serverMembersSection.querySelector('.server-members-count-val') : null;
  const serverMembersSearch = serverMembersSection ? serverMembersSection.querySelector('.server-members-search') : null;
  const serverMembersInfoBanner = serverMembersSection ? serverMembersSection.querySelector('.server-members-info-banner') : null;
  const serverMembersInfoClose = serverMembersSection ? serverMembersSection.querySelector('.server-members-info-close') : null;

  let allServerMembers = [];

  async function fetchAndRenderServerMembers() {
    if (!window.selectedServer || !serverMembersTableBody) return;
    // Fetch members from Supabase
    const { data, error } = await supabase
      .from('server_members')
      .select('user_id, joined_at, users: user_id (display_name, avatar_url)')
      .eq('server_id', window.selectedServer.id)
      .order('joined_at', { ascending: false });
    if (error) {
      serverMembersTableBody.innerHTML = `<tr><td colspan="4" style="color:#ff4d4f;text-align:center;">Failed to load members</td></tr>`;
      if (serverMembersCountVal) serverMembersCountVal.textContent = '0';
      await updateServerSettingsPreviewMemberCount();
      return;
    }
    allServerMembers = (data || []).map(m => ({
      id: m.user_id,
      name: m.users?.display_name || m.user_id,
      avatar: m.users?.avatar_url || '',
      joined: m.joined_at,
      roles: 'Member', // Placeholder for now
    }));
    renderServerMembersTable(allServerMembers);
    await updateServerSettingsPreviewMemberCount();
  }

  function renderServerMembersTable(members) {
    if (!serverMembersTableBody) return;
    if (!members.length) {
      serverMembersTableBody.innerHTML = `<tr><td colspan="4" style="color:#888;text-align:center;">No members found</td></tr>`;
      if (serverMembersCountVal) serverMembersCountVal.textContent = '0';
      return;
    }
    serverMembersTableBody.innerHTML = '';
    members.forEach(member => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="checkbox" /></td>
        <td>
          <span class="server-members-name">
            <img src="${member.avatar}" class="server-members-avatar" alt="Avatar" />
            ${escapeHtml(member.name)}
          </span>
        </td>
        <td>${formatMemberSince(member.joined)}</td>
        <td><span class="server-members-roles">${member.roles}</span></td>
      `;
      serverMembersTableBody.appendChild(tr);
    });
    if (serverMembersCountVal) serverMembersCountVal.textContent = members.length;
  }

  function formatMemberSince(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - d) / (1000 * 60 * 60 * 24));
    if (diff < 1) return 'Today';
    if (diff === 1) return '1 day ago';
    if (diff < 30) return `${diff} days ago`;
    const months = Math.floor(diff / 30);
    if (months === 1) return '1 month ago';
    if (months < 12) return `${months} months ago`;
    const years = Math.floor(months / 12);
    return years === 1 ? '1 year ago' : `${years} years ago`;
  }

  // Dismiss info banner
  if (serverMembersInfoClose && serverMembersInfoBanner) {
    serverMembersInfoClose.addEventListener('click', function() {
      serverMembersInfoBanner.style.display = 'none';
    });
  }

  // Filter members as user types
  if (serverMembersSearch) {
    serverMembersSearch.addEventListener('input', function() {
      const q = serverMembersSearch.value.trim().toLowerCase();
      if (!q) {
        renderServerMembersTable(allServerMembers);
        return;
      }
      const filtered = allServerMembers.filter(m =>
        m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q)
      );
      renderServerMembersTable(filtered);
    });
  }

  // Show members when Members tab is selected
  if (serverSettingsNav) {
    serverSettingsNav.addEventListener('click', function(e) {
      const li = e.target.closest('li[data-section]');
      if (!li) return;
      if (li.dataset.section === 'members') {
        fetchAndRenderServerMembers();
      }
    });
  }
  // Also fetch members when opening settings if Members tab is active
  function openServerSettingsPanelWithMembersCheck() {
    openServerSettingsPanel();
    const active = serverSettingsNav.querySelector('li.active');
    if (active && active.dataset.section === 'members') {
      fetchAndRenderServerMembers();
    }
  }
  // Patch open logic to use this
  document.addEventListener('click', function(e) {
    if (e.target.closest('.dropdown-option') && e.target.closest('.dropdown-option').textContent.includes('Server Settings')) {
      openServerSettingsPanelWithMembersCheck();
    }
  });

  // --- ENGAGEMENT ANALYTICS LOGIC ---
  let memberGrowthChart = null;
  let messageActivityChart = null;

  async function fetchAndRenderEngagementAnalytics() {
    if (!window.selectedServer) return;
    // Fetch all members for this server
    const { data: members, error } = await supabase
      .from('server_members')
      .select('user_id, joined_at, users: user_id (display_name, avatar_url)')
      .eq('server_id', window.selectedServer.id)
      .order('joined_at', { ascending: true });
    if (error) return;
    // --- Stat cards ---
    const totalMembers = members.length;
    document.getElementById('engagement-total-members').textContent = totalMembers;
    // New members this week
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const newMembers = members.filter(m => new Date(m.joined_at) >= weekAgo).length;
    document.getElementById('engagement-new-members').textContent = newMembers;
    // --- Member Growth Chart (last 30 days) ---
    const growthLabels = [];
    const growthData = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      growthLabels.push(`${d.getMonth()+1}/${d.getDate()}`);
      const count = members.filter(m => new Date(m.joined_at) <= d).length;
      growthData.push(count);
    }
    if (window.Chart) {
      if (memberGrowthChart) memberGrowthChart.destroy();
      memberGrowthChart = new Chart(document.getElementById('member-growth-chart').getContext('2d'), {
        type: 'line',
        data: {
          labels: growthLabels,
          datasets: [{
            label: 'Members',
            data: growthData,
            borderColor: '#b39ddb',
            backgroundColor: 'rgba(179,157,219,0.12)',
            fill: true,
            tension: 0.3,
            pointRadius: 0,
          }]
        },
        options: {
          plugins: { legend: { display: false } },
          scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid: { color: '#222226' } } },
          responsive: true,
          maintainAspectRatio: false,
        }
      });
    }
    // --- Message Activity Chart (last 14 days) ---
    let messageCounts = [];
    let topMembers = [];
    if (window.supabase && supabase.from && supabase.from('messages')) {
      const { data: messages } = await supabase
        .from('messages')
        .select('user_id, created_at')
        .eq('server_id', window.selectedServer.id);
      // Messages per day
      const msgLabels = [];
      const msgData = [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        msgLabels.push(`${d.getMonth()+1}/${d.getDate()}`);
        const count = (messages || []).filter(msg => {
          const msgDate = new Date(msg.created_at);
          return msgDate.getFullYear() === d.getFullYear() && msgDate.getMonth() === d.getMonth() && msgDate.getDate() === d.getDate();
        }).length;
        msgData.push(count);
      }
      if (window.Chart) {
        if (messageActivityChart) messageActivityChart.destroy();
        messageActivityChart = new Chart(document.getElementById('message-activity-chart').getContext('2d'), {
          type: 'bar',
          data: {
            labels: msgLabels,
            datasets: [{
              label: 'Messages',
              data: msgData,
              backgroundColor: '#7ed957',
              borderRadius: 6,
              maxBarThickness: 18,
            }]
          },
          options: {
            plugins: { legend: { display: false } },
            scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid: { color: '#222226' } } },
            responsive: true,
            maintainAspectRatio: false,
          }
        });
      }
      // --- Most Active Members ---
      const counts = {};
      (messages || []).forEach(msg => {
        counts[msg.user_id] = (counts[msg.user_id] || 0) + 1;
      });
      topMembers = Object.entries(counts)
        .map(([id, count]) => {
          const user = members.find(m => m.user_id === id);
          return {
            id,
            name: user?.users?.display_name || id,
            avatar: user?.users?.avatar_url || '',
            count
          };
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    }
    // Render most active members
    const mostActiveList = document.querySelector('.most-active-members-list');
    if (mostActiveList) {
      mostActiveList.innerHTML = '';
      if (topMembers.length) {
        topMembers.forEach(m => {
          const li = document.createElement('li');
          li.innerHTML = `<img src="${m.avatar}" class="active-member-avatar" alt="Avatar" /> <span class="active-member-name">${escapeHtml(m.name)}</span> <span class="active-member-count">${m.count} messages</span>`;
          mostActiveList.appendChild(li);
        });
      } else {
        mostActiveList.innerHTML = '<li style="color:#888;">No message data yet</li>';
      }
    }
  }
  // Show analytics when Engagement tab is selected
  if (serverSettingsNav) {
    serverSettingsNav.addEventListener('click', function(e) {
      const li = e.target.closest('li[data-section]');
      if (!li) return;
      if (li.dataset.section === 'engagement') {
        fetchAndRenderEngagementAnalytics();
      }
    });
  }
  // Also fetch analytics when opening settings if Engagement tab is active
  function openServerSettingsPanelWithEngagementCheck() {
    openServerSettingsPanel();
    const active = serverSettingsNav.querySelector('li.active');
    if (active && active.dataset.section === 'engagement') {
      fetchAndRenderEngagementAnalytics();
    }
  }
  document.addEventListener('click', function(e) {
    if (e.target.closest('.dropdown-option') && e.target.closest('.dropdown-option').textContent.includes('Server Settings')) {
      openServerSettingsPanelWithEngagementCheck();
    }
  });
  // --- END ENGAGEMENT ANALYTICS LOGIC ---

  // --- Guild Glory Voting System Logic ---
  (function() {
    const serverSettingsNav = document.querySelector('.server-settings-nav');
    const boostSection = document.querySelector('.server-settings-section-boost');
    if (!serverSettingsNav || !boostSection) return;

    // GSAP CDN (if not loaded)
    if (!window.gsap) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js';
      document.head.appendChild(script);
    }

    let votes = [];
    let hasVoted = false;
    const milestones = [
      { level: 1, votes: 2, cardId: 'card1', milestoneId: 'milestone1' },
      { level: 2, votes: 5, cardId: 'card2', milestoneId: 'milestone2' },
      { level: 3, votes: 10, cardId: 'card3', milestoneId: 'milestone3' },
    ];
    const USER_ID = localStorage.getItem('user_id') || 'user-' + Math.floor(Math.random()*10000);
    localStorage.setItem('user_id', USER_ID);

    async function loadVotes() {
      if (!window.selectedServer) return;
      // Fetch votes for this server, join users for avatar
      const { data, error } = await supabase
        .from('guild_glory_votes')
        .select('user_id, users: user_id (avatar_url)')
        .eq('guild_id', window.selectedServer.id);
      if (error) {
        votes = [];
        hasVoted = false;
        updateUI();
        return;
      }
      votes = (data || []).map(v => ({
        user_id: v.user_id,
        avatar_url: v.users?.avatar_url || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${v.user_id}`
      }));
      hasVoted = votes.some(v => v.user_id === USER_ID);
      updateUI();
    }

    async function castVote() {
      if (hasVoted || !window.selectedServer) return;
      // Insert vote
      const { error } = await supabase.from('guild_glory_votes').insert({
        guild_id: window.selectedServer.id,
        user_id: USER_ID
      });
      if (error) {
        alert('Failed to vote: ' + error.message);
        return;
      }
      await loadVotes();
      hasVoted = true;
      updateUI(true);
    }

    function updateUI(justVoted = false) {
      const progressBar = document.getElementById('gloryProgressBar');
      const avatarsContainer = document.getElementById('gloryAvatars');
      const voteBtn = document.getElementById('gloryVoteBtn');
      const perkUnlock = document.getElementById('gloryPerkUnlock');
      if (!progressBar || !avatarsContainer || !voteBtn || !perkUnlock) return;
      const percent = Math.min((votes.length / milestones[milestones.length-1].votes) * 100, 100);
      progressBar.style.width = percent + '%';
      avatarsContainer.innerHTML = '';
      votes.forEach((v, i) => {
        const img = document.createElement('img');
        img.src = v.avatar_url;
        img.className = 'glory-avatar';
        img.style.animationDelay = (i * 0.08) + 's';
        avatarsContainer.appendChild(img);
      });
      if (hasVoted) {
        voteBtn.classList.add('voted');
        voteBtn.textContent = 'Thank you for voting!';
      } else {
        voteBtn.classList.remove('voted');
        voteBtn.textContent = 'Cast My Vote!';
      }
      milestones.forEach(m => {
        const card = document.getElementById(m.cardId);
        const marker = document.getElementById(m.milestoneId);
        if (votes.length >= m.votes) {
          card.classList.add('unlocked');
          card.classList.remove('locked');
          marker.classList.add('unlocked');
          if (justVoted && votes.length === m.votes) {
            showPerkUnlock(m.level);
          }
        } else {
          card.classList.remove('unlocked');
          card.classList.add('locked');
          marker.classList.remove('unlocked');
        }
      });
    }

    function showPerkUnlock(level) {
      const perkUnlock = document.getElementById('gloryPerkUnlock');
      if (!perkUnlock) return;
      perkUnlock.innerHTML = '';
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '120');
      svg.setAttribute('height', '120');
      svg.innerHTML = `
        <circle cx="60" cy="60" r="50" stroke="#fff" stroke-width="6" fill="none" stroke-dasharray="314" stroke-dashoffset="314"/>
        <polyline points="40,65 58,80 85,45" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="60" stroke-dashoffset="60"/>
      `;
      svg.style.filter = 'drop-shadow(0 0 32px #fff8)';
      perkUnlock.appendChild(svg);
      perkUnlock.style.display = 'flex';
      if (window.gsap) {
        gsap.to(svg.children[0], { strokeDashoffset: 0, duration: 0.7, ease: 'power2.out' });
        gsap.to(svg.children[1], { strokeDashoffset: 0, duration: 0.5, delay: 0.7, ease: 'power2.out' });
      }
      setTimeout(() => confettiBurst(perkUnlock), 1200);
      setTimeout(() => { perkUnlock.style.display = 'none'; }, 2200);
    }
    function confettiBurst(container) {
      if (!window.gsap) return;
      for (let i = 0; i < 18; i++) {
        const conf = document.createElement('div');
        conf.className = 'confetti';
        conf.style.position = 'absolute';
        conf.style.left = '50%';
        conf.style.top = '50%';
        conf.style.width = '10px';
        conf.style.height = '10px';
        conf.style.background = `hsl(${Math.random()*360},90%,60%)`;
        conf.style.borderRadius = '50%';
        conf.style.opacity = 0.8;
        container.appendChild(conf);
        gsap.to(conf, {
          x: Math.cos((i/18)*2*Math.PI) * (60 + Math.random()*40),
          y: Math.sin((i/18)*2*Math.PI) * (60 + Math.random()*40),
          scale: 0.7 + Math.random()*1.2,
          opacity: 0,
          duration: 1.1,
          delay: 0.1,
          ease: 'power2.out',
          onComplete: () => conf.remove()
        });
      }
    }
    function setupGuildGloryEvents() {
      const voteBtn = document.getElementById('gloryVoteBtn');
      if (voteBtn) voteBtn.onclick = castVote;
      loadVotes();
    }
    serverSettingsNav.addEventListener('click', function(e) {
      const li = e.target.closest('li[data-section]');
      if (!li) return;
      if (li.dataset.section === 'boost') {
        setTimeout(setupGuildGloryEvents, 50);
      }
    });
    if (document.querySelector('li[data-section="boost"].active')) {
      setTimeout(setupGuildGloryEvents, 50);
    }
  })();

  // --- PROFILE SETTINGS PANEL LOGIC ---
  const profileSettingsPanel = document.getElementById('profile-settings-panel');
  const profileSettingsClose = document.querySelector('.profile-settings-close');
  const profileSettingsNav = document.querySelector('.profile-settings-nav');
  const profileSettingsSectionTitle = document.querySelector('.profile-settings-section-title');
  const profileSettingsContents = document.querySelectorAll('.profile-settings-content');
  const profileSettingsNameInput = document.querySelector('.profile-settings-name-input');
  const profileSettingsAvatarPreview = document.querySelector('.profile-settings-avatar-preview');
  const profileSettingsAvatarBtn = document.querySelector('.profile-settings-avatar-btn');
  const profileSettingsBioInput = document.querySelector('.profile-settings-bio-input');
  const profileSettingsSaveBtn = document.querySelector('.profile-settings-save-btn');
  const profileSettingsFeedback = document.querySelector('.profile-settings-feedback');
  const profileSettingsPreviewBanner = document.querySelector('.profile-settings-preview-banner');
  const profileSettingsPreviewAvatar = document.querySelector('.profile-settings-preview-avatar img');
  const profileSettingsPreviewName = document.querySelector('.profile-settings-preview-name');
  const profileSettingsPreviewMeta = document.querySelector('.profile-settings-preview-meta');
  const profileSettingsPreviewId = document.querySelector('.profile-settings-preview-id');
  const profileSettingsPreviewBio = document.querySelector('.profile-settings-preview-bio');
  const statusToggleInput = document.querySelector('.status-toggle-input');

  const moreProfileSettingsBtn = document.querySelector('.more-profile-settings-btn');
  if (moreProfileSettingsBtn) {
    moreProfileSettingsBtn.addEventListener('click', openProfileSettingsPanel);
  }
  function openProfileSettingsPanel() {
    // Fill with current user data
    const displayName = localStorage.getItem('display_name') || 'Username';
    const avatarUrl = document.querySelector('.profile-avatar')?.src || '';
    const bio = document.querySelector('.profile-bio')?.textContent || '';
    const userId = localStorage.getItem('user_id') || '#0000';
    const bannerImg = document.querySelector('.profile-banner');
    const bannerVideo = document.querySelector('.profile-banner-video');
    let bannerUrl = '';
    let isVideo = false;
    if (bannerImg && bannerImg.style.display !== 'none' && bannerImg.src) {
      bannerUrl = bannerImg.src;
      isVideo = false;
    } else if (bannerVideo && bannerVideo.style.display !== 'none' && bannerVideo.src) {
      bannerUrl = bannerVideo.src;
      isVideo = true;
    }
    // Inputs
    profileSettingsNameInput.value = displayName;
    profileSettingsAvatarPreview.src = avatarUrl;
    profileSettingsBioInput.value = bio;
    // Preview
    profileSettingsPreviewAvatar.src = avatarUrl;
    profileSettingsPreviewName.textContent = displayName;
    profileSettingsPreviewId.textContent = userId.length > 12 ? userId.slice(0, 6) + '...' + userId.slice(-4) : userId;
    profileSettingsPreviewBio.textContent = bio;
    // Banner preview logic
    if (isVideo && bannerUrl) {
      // Remove any previous video
      let previewVideo = profileSettingsPreviewBanner.querySelector('video');
      if (!previewVideo) {
        previewVideo = document.createElement('video');
        previewVideo.autoplay = true;
        previewVideo.loop = true;
        previewVideo.muted = true;
        previewVideo.playsInline = true;
        previewVideo.style.width = '100%';
        previewVideo.style.height = '100%';
        previewVideo.style.objectFit = 'cover';
        previewVideo.style.objectPosition = 'center';
        previewVideo.style.borderRadius = 'inherit';
        profileSettingsPreviewBanner.appendChild(previewVideo);
      }
      previewVideo.src = bannerUrl;
      previewVideo.style.display = 'block';
      profileSettingsPreviewBanner.style.background = '';
    } else if (bannerUrl) {
      // Remove any preview video
      const previewVideo = profileSettingsPreviewBanner.querySelector('video');
      if (previewVideo) previewVideo.remove();
      profileSettingsPreviewBanner.style.background = `url('${bannerUrl}') center/cover no-repeat`;
    } else {
      // Remove any preview video
      const previewVideo = profileSettingsPreviewBanner.querySelector('video');
      if (previewVideo) previewVideo.remove();
      profileSettingsPreviewBanner.style.background = 'linear-gradient(90deg, var(--accent) 0%, #232129 100%)';
    }
    // Status
    const status = statusToggleInput && statusToggleInput.checked ? 'Online' : 'Invisible';
    const statusDot = document.querySelector('.profile-settings-preview-status .status-dot');
    const statusLabel = document.querySelector('.profile-settings-preview-status .status-label');
    if (statusDot && statusLabel) {
      if (status === 'Online') {
        statusDot.classList.add('online');
        statusDot.classList.remove('offline');
        statusLabel.textContent = 'Online';
        statusLabel.style.color = 'var(--online)';
      } else {
        statusDot.classList.remove('online');
        statusDot.classList.add('offline');
        statusLabel.textContent = 'Invisible';
        statusLabel.style.color = '#888';
      }
    }
    profileSettingsPanel.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    // Show main section by default
    profileSettingsContents.forEach(c => c.style.display = c.classList.contains('profile-settings-section-main') ? '' : 'none');
    profileSettingsSectionTitle.textContent = 'Main Profile';
    profileSettingsNav.querySelectorAll('li').forEach(li => li.classList.remove('active'));
    profileSettingsNav.querySelector('li[data-section="main"]').classList.add('active');
    updateProfileSettingsScrollBar();
  }
  function closeProfileSettingsPanel() {
    profileSettingsPanel.style.display = 'none';
    document.body.style.overflow = '';
  }
  if (profileSettingsClose) {
    profileSettingsClose.addEventListener('click', closeProfileSettingsPanel);
  }
  document.addEventListener('keydown', function(e) {
    if (profileSettingsPanel.style.display === 'flex' && (e.key === 'Escape' || e.key === 'Esc')) {
      closeProfileSettingsPanel();
    }
  });
  if (profileSettingsNav) {
    profileSettingsNav.addEventListener('click', function(e) {
      const li = e.target.closest('li[data-section]');
      if (!li) return;
      profileSettingsNav.querySelectorAll('li').forEach(l => l.classList.remove('active'));
      li.classList.add('active');
      const section = li.dataset.section;
      profileSettingsContents.forEach(c => c.style.display = c.classList.contains('profile-settings-section-' + section) ? '' : 'none');
      profileSettingsSectionTitle.textContent = li.textContent;
    });
  }
  // Live update preview on name/avatar/bio/banner/status change
  if (profileSettingsNameInput) {
    profileSettingsNameInput.addEventListener('input', function() {
      profileSettingsPreviewName.textContent = profileSettingsNameInput.value;
    });
  }
  if (profileSettingsAvatarPreview) {
    profileSettingsAvatarPreview.addEventListener('load', function() {
      profileSettingsPreviewAvatar.src = profileSettingsAvatarPreview.src;
    });
  }
  if (profileSettingsBioInput) {
    profileSettingsBioInput.addEventListener('input', function() {
      profileSettingsPreviewBio.textContent = profileSettingsBioInput.value;
    });
  }
  if (statusToggleInput) {
    statusToggleInput.addEventListener('change', function() {
      const statusDot = document.querySelector('.profile-settings-preview-status .status-dot');
      const statusLabel = document.querySelector('.profile-settings-preview-status .status-label');
      if (statusToggleInput.checked) {
        statusDot.classList.add('online');
        statusDot.classList.remove('offline');
        statusLabel.textContent = 'Online';
        statusLabel.style.color = 'var(--online)';
      } else {
        statusDot.classList.remove('online');
        statusDot.classList.add('offline');
        statusLabel.textContent = 'Invisible';
        statusLabel.style.color = '#888';
      }
    });
  }
  // Banner live update (if you add a banner picker, update .profile-settings-preview-banner.style.background)
  // ... existing code ...
  // Save changes (display name, avatar, bio)
  if (profileSettingsSaveBtn) {
    profileSettingsSaveBtn.addEventListener('click', async function() {
      const newName = profileSettingsNameInput.value.trim();
      const newBio = profileSettingsBioInput.value.trim();
      // For avatar, just use the preview src for now
      const newAvatarUrl = profileSettingsAvatarPreview.src;
      profileSettingsSaveBtn.disabled = true;
      profileSettingsFeedback.textContent = 'Saving...';
      profileSettingsFeedback.classList.add('show');
      try {
        await supabase.from('users').update({
          display_name: newName,
          bio: newBio,
          avatar_url: newAvatarUrl
        }).eq('id', localStorage.getItem('user_id'));
        profileSettingsFeedback.textContent = 'Saved!';
        setTimeout(() => profileSettingsFeedback.classList.remove('show'), 1200);
        // Update localStorage and profile UI
        localStorage.setItem('display_name', newName);
        document.querySelector('.profile-name').textContent = newName;
        document.querySelector('.profile-bio').textContent = newBio;
        document.querySelector('.profile-avatar').src = newAvatarUrl;
      } catch (err) {
        profileSettingsFeedback.textContent = 'Failed to save.';
        setTimeout(() => profileSettingsFeedback.classList.remove('show'), 1800);
      }
      profileSettingsSaveBtn.disabled = false;
    });
  }
  // Avatar change (reuse cropper if available, else just file input for now)
  if (profileSettingsAvatarBtn) {
    profileSettingsAvatarBtn.addEventListener('click', function() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async function(e) {
        const file = e.target.files[0];
        if (!file) return;
        // For now, just use a local URL preview
        const url = URL.createObjectURL(file);
        profileSettingsAvatarPreview.src = url;
        profileSettingsPreviewAvatar.src = url;
      };
      input.click();
    });
  }

  // --- PROFILE SETTINGS PANEL ENHANCED INTERACTIVITY ---
  // Accent color picker
  const accentColorSwatches = document.querySelectorAll('.accent-color-swatch');
  if (accentColorSwatches.length) {
    accentColorSwatches.forEach(swatch => {
      swatch.addEventListener('click', function() {
        accentColorSwatches.forEach(s => s.classList.remove('selected'));
        swatch.classList.add('selected');
        document.documentElement.style.setProperty('--accent', swatch.dataset.color);
        document.documentElement.style.setProperty('--accent-hover', swatch.dataset.color);
        // Optionally save to localStorage or backend
      });
    });
    // Set initial selection
    const currentAccent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    let found = false;
    accentColorSwatches.forEach(swatch => {
      if (swatch.dataset.color === currentAccent) {
        swatch.classList.add('selected');
        found = true;
      }
    });
    if (!found) accentColorSwatches[0].classList.add('selected');
  }
  // Online status toggle
  if (statusToggleInput) {
    statusToggleInput.addEventListener('change', function() {
      const label = document.querySelector('.status-label');
      if (statusToggleInput.checked) {
        label.textContent = 'Online';
        label.style.color = 'var(--online)';
      } else {
        label.textContent = 'Invisible';
        label.style.color = '#888';
      }
      // Optionally save to backend/localStorage
    });
  }
  // Theme switcher
  const themeToggleInput = document.querySelector('.theme-toggle-input');
  if (themeToggleInput) {
    themeToggleInput.addEventListener('change', function() {
      if (themeToggleInput.checked) {
        document.body.classList.remove('light-theme');
        document.body.classList.add('dark-theme');
      } else {
        document.body.classList.remove('dark-theme');
        document.body.classList.add('light-theme');
      }
      // Optionally save to localStorage or backend
    });
  }
  // Animated nav icon transitions (subtle pop on nav switch)
  if (profileSettingsNav) {
    profileSettingsNav.addEventListener('click', function(e) {
      const li = e.target.closest('li[data-section]');
      if (!li) return;
      const icon = li.querySelector('.animated-icon');
      if (icon) {
        icon.style.transform = 'scale(1.18)';
        setTimeout(() => { icon.style.transform = ''; }, 320);
      }
    });
  }
  // Section transition animation
  profileSettingsContents.forEach(section => {
    section.addEventListener('transitionstart', function() {
      section.style.animation = 'profileSettingsContentPop 0.44s cubic-bezier(.4,0,.2,1)';
      setTimeout(() => { section.style.animation = ''; }, 440);
    });
  });

  // --- PROFILE SETTINGS PANEL SCROLL INDICATOR ---
  const profileSettingsMain = document.querySelector('.profile-settings-main');
  const scrollIndicator = document.querySelector('.profile-settings-scroll-indicator');
  const scrollBar = document.querySelector('.profile-settings-scroll-bar');
  function updateProfileSettingsScrollBar() {
    if (!profileSettingsMain || !scrollIndicator || !scrollBar) return;
    const scrollHeight = profileSettingsMain.scrollHeight;
    const clientHeight = profileSettingsMain.clientHeight;
    const scrollTop = profileSettingsMain.scrollTop;
    if (scrollHeight <= clientHeight) {
      scrollBar.style.height = '0px';
      scrollBar.style.top = '0px';
      scrollBar.style.opacity = '0';
      return;
    }
    const barHeight = Math.max(32, clientHeight * clientHeight / scrollHeight);
    const barTop = scrollTop * (clientHeight - barHeight) / (scrollHeight - clientHeight);
    scrollBar.style.height = barHeight + 'px';
    scrollBar.style.top = barTop + 'px';
    scrollBar.style.opacity = '1';
  }
  if (profileSettingsMain && scrollBar) {
    profileSettingsMain.addEventListener('scroll', updateProfileSettingsScrollBar);
    window.addEventListener('resize', updateProfileSettingsScrollBar);
    setTimeout(updateProfileSettingsScrollBar, 200);
  }

  // --- SEARCH BAR LOGIC ---
  const searchBtn = document.querySelector('.search-btn');
  const searchBarContainer = document.querySelector('.search-bar-container');
  const searchBarInput = document.querySelector('.search-bar-input');
  const searchBarClose = document.querySelector('.search-bar-close');
  console.log('searchBtn:', searchBtn);
  console.log('searchBarContainer:', searchBarContainer);
  console.log('searchBarInput:', searchBarInput);
  console.log('searchBarClose:', searchBarClose);

  function openSearchBar() {
    console.log('openSearchBar called');
    if (!searchBarContainer) return;
    searchBarContainer.style.display = '';
    setTimeout(() => {
      searchBarContainer.classList.add('active');
      if (searchBarInput) searchBarInput.focus();
    }, 10);
  }
  function closeSearchBar() {
    console.log('closeSearchBar called');
    if (!searchBarContainer) return;
    searchBarContainer.classList.remove('active');
    setTimeout(() => {
      searchBarContainer.style.display = 'none';
      if (searchBarInput) searchBarInput.value = '';
    }, 350);
  }
  if (searchBtn) {
    searchBtn.addEventListener('click', function() {
      console.log('searchBtn clicked');
      openSearchBar();
    });
  }
  if (searchBarClose) {
    searchBarClose.addEventListener('click', function() {
      console.log('searchBarClose clicked');
      closeSearchBar();
    });
  }
  document.addEventListener('keydown', function(e) {
    if (searchBarContainer && searchBarContainer.classList.contains('active') && e.key === 'Escape') {
      console.log('Escape pressed, closing search bar');
      closeSearchBar();
    }
  });

  // --- CREATE CHANNEL MODAL LOGIC ---
  const createChannelModal = document.getElementById('create-channel-modal');
  const channelModalClose = document.querySelector('.channel-modal-close');
  const channelModalCancel = document.querySelector('.channel-modal-cancel');
  const channelModalCreate = document.querySelector('.channel-modal-create');
  const channelNameInput = document.getElementById('channel-name');
  const channelTypeRadios = document.getElementsByName('channel-type');
  const privateChannelToggle = document.getElementById('private-channel-toggle');
  let channelModalOpen = false;

  const channelModalFeedback = document.getElementById('channel-modal-feedback');

  function showChannelModalFeedback(msg, type) {
    if (!channelModalFeedback) return;
    channelModalFeedback.textContent = msg;
    channelModalFeedback.className = 'channel-modal-feedback ' + (type === 'error' ? 'error' : 'success');
  }
  function clearChannelModalFeedback() {
    if (!channelModalFeedback) return;
    channelModalFeedback.textContent = '';
    channelModalFeedback.className = 'channel-modal-feedback';
  }

  function openCreateChannelModal() {
    if (!window.selectedServer) return;
    const ownerId = window.selectedServer.owner_id || (window.selectedServer.owner && window.selectedServer.owner.id);
    const userId = localStorage.getItem('user_id');
    if (ownerId !== userId) {
      createChannelModal.style.display = 'flex';
      createChannelModal.classList.add('modal-open');
      channelModalOpen = true;
      channelNameInput.value = '';
      channelModalCreate.disabled = true;
      channelTypeRadios[0].checked = true;
      privateChannelToggle.checked = false;
      showChannelModalFeedback('Only the server owner can create channels.', 'error');
      setTimeout(() => {
        closeCreateChannelModal();
      }, 2200);
      document.body.style.overflow = 'hidden';
      return;
    }
    createChannelModal.style.display = 'flex';
    createChannelModal.classList.add('modal-open');
    channelModalOpen = true;
    channelNameInput.value = '';
    channelModalCreate.disabled = true;
    channelTypeRadios[0].checked = true;
    privateChannelToggle.checked = false;
    clearChannelModalFeedback();
    setTimeout(() => channelNameInput.focus(), 10);
    document.body.style.overflow = 'hidden';
  }
  function closeCreateChannelModal() {
    createChannelModal.classList.remove('modal-open');
    setTimeout(() => {
      createChannelModal.style.display = 'none';
      document.body.style.overflow = '';
      channelModalOpen = false;
      clearChannelModalFeedback();
    }, 320);
  }
  if (channelModalClose) channelModalClose.addEventListener('click', closeCreateChannelModal);
  if (channelModalCancel) channelModalCancel.addEventListener('click', closeCreateChannelModal);
  createChannelModal.addEventListener('mousedown', function(e) {
    if (e.target === createChannelModal) closeCreateChannelModal();
  });
  document.addEventListener('keydown', function(e) {
    if (channelModalOpen && e.key === 'Escape') closeCreateChannelModal();
  });
  channelNameInput.addEventListener('input', function() {
    channelModalCreate.disabled = !channelNameInput.value.trim();
    clearChannelModalFeedback();
  });
  // Modal open from dropdown
  const createChannelOption = Array.from(document.querySelectorAll('.dropdown-option')).find(opt => opt.textContent.trim().toLowerCase() === 'create channel');
  if (createChannelOption) {
    createChannelOption.addEventListener('click', function(e) {
      e.stopPropagation();
      openCreateChannelModal();
      const dropdownMenu = document.querySelector('.server-dropdown-menu');
      if (dropdownMenu) dropdownMenu.classList.remove('open');
    });
  }
  // Create channel in Supabase
  if (channelModalCreate) {
    channelModalCreate.addEventListener('click', async function() {
      if (!window.selectedServer) return;
      const ownerId = window.selectedServer.owner_id || (window.selectedServer.owner && window.selectedServer.owner.id);
      const userId = localStorage.getItem('user_id');
      if (ownerId !== userId) {
        showChannelModalFeedback('Only the server owner can create channels.', 'error');
        return;
      }
      const name = channelNameInput.value.trim();
      const type = Array.from(channelTypeRadios).find(r => r.checked)?.value || 'text';
      const isPrivate = privateChannelToggle.checked;
      if (!name) return;
      channelModalCreate.disabled = true;
      channelModalCreate.textContent = 'Creating...';
      try {
        await supabase.from('channels').insert({
          server_id: window.selectedServer.id,
          name,
          type,
          is_private: isPrivate
        });
        showChannelModalFeedback('Channel created!', 'success');
        setTimeout(() => {
          closeCreateChannelModal();
          if (typeof renderServerChannels === 'function') renderServerChannels(window.selectedServer);
        }, 900);
      } catch (err) {
        showChannelModalFeedback('Failed to create channel: ' + err.message, 'error');
      }
      channelModalCreate.textContent = 'Create Channel';
      channelModalCreate.disabled = false;
    });
  }
  // --- DEFAULT CHANNELS ON SERVER CREATION ---
  const originalCreateBtnHandler = createBtn.onclick || createBtn._originalHandler;
  createBtn._originalHandler = originalCreateBtnHandler;
  createBtn.onclick = async function(e) {
    if (originalCreateBtnHandler) await originalCreateBtnHandler.call(this, e);
    // After server is created, add default channels
    try {
      // Find the most recently created server for this user
      const ownerId = localStorage.getItem('user_id');
      const { data: servers } = await supabase.from('servers').select('*').eq('owner_id', ownerId).order('created_at', { ascending: false }).limit(1);
      const newServer = servers && servers[0];
      if (newServer) {
        // Insert default text and voice channels
        await supabase.from('channels').insert([
          { server_id: newServer.id, name: 'general', type: 'text', is_private: false },
          { server_id: newServer.id, name: 'General', type: 'voice', is_private: false }
        ]);
        // Optionally refresh channel list if this server is selected
        if (window.selectedServer && window.selectedServer.id === newServer.id && typeof renderServerChannels === 'function') {
          renderServerChannels(newServer);
        }
      }
    } catch (err) {
      console.error('Failed to create default channels:', err.message);
    }
  };

  // --- Prevent chat form reload and handle message send ---
  const chatInputForm = document.querySelector('.chat-input');
  if (chatInputForm) {
    chatInputForm.addEventListener('submit', function(e) {
      e.preventDefault();
      const input = chatInputForm.querySelector('input[type="text"]');
      if (!input) return;
      const content = input.value.trim();
      if (!content) return;
      // If in DM mode, send DM message
      if (currentSidebarView === 'friends' && currentDmFriendId) {
        sendDmMessage(content);
      }
      // TODO: Add logic for server/channel messages if needed
      input.value = '';
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

// Banner live update (if you add a banner picker, update .profile-settings-preview-banner.style.background)
const profileBanner = document.querySelector('.profile-banner');
if (profileBanner) {
  profileBanner.addEventListener('load', function() {
    if (profileBanner.style.display !== 'none') {
      // Remove any preview video
      const previewVideo = profileSettingsPreviewBanner.querySelector('video');
      if (previewVideo) previewVideo.remove();
      profileSettingsPreviewBanner.style.background = `url('${profileBanner.src}') center/cover no-repeat`;
    }
  });
}
// Live update for banner video
const profileBannerVideo = document.querySelector('.profile-banner-video');
if (profileBannerVideo) {
  profileBannerVideo.addEventListener('loadeddata', function() {
    if (profileBannerVideo.style.display !== 'none') {
      // Remove any previous video
      let previewVideo = profileSettingsPreviewBanner.querySelector('video');
      if (!previewVideo) {
        previewVideo = document.createElement('video');
        previewVideo.autoplay = true;
        previewVideo.loop = true;
        previewVideo.muted = true;
        previewVideo.playsInline = true;
        previewVideo.style.width = '100%';
        previewVideo.style.height = '100%';
        previewVideo.style.objectFit = 'cover';
        previewVideo.style.objectPosition = 'center';
        previewVideo.style.borderRadius = 'inherit';
        profileSettingsPreviewBanner.appendChild(previewVideo);
      }
      previewVideo.src = profileBannerVideo.src;
      previewVideo.style.display = 'block';
      profileSettingsPreviewBanner.style.background = '';
    }
  });
}
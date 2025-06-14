const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

// --- Supabase setup ---
const SUPABASE_URL = process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'YOUR_SUPABASE_SERVICE_ROLE_KEY';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const app = express();
app.use(cors());

// Serve static files (index.html, app.js, styles.css, assets)
app.use(express.static(__dirname));

// Fallback: serve index.html for any non-API, non-Socket.IO route (SPA support)
app.get(/^\/(?!dm\/|socket.io\/).*/, (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// --- Socket.IO logic ---
io.on('connection', (socket) => {
  // Join a DM room (room name: dm_userid_friendid, sorted)
  socket.on('join_dm', ({ userId, friendId }) => {
    const room = getDmRoom(userId, friendId);
    socket.join(room);
  });

  // Handle sending a DM
  socket.on('dm_message', async ({ from, to, content, file_url, file_type, file_name }) => {
    const room = getDmRoom(from, to);
    // Save to Supabase
    const { data, error } = await supabase
      .from('messages')
      .insert([{ sender_id: from, receiver_id: to, content, file_url, file_type, file_name }])
      .select()
      .single();
    if (error) {
      socket.emit('dm_error', { error: error.message });
      return;
    }
    // Emit to both users in the room
    io.to(room).emit('dm_message', {
      id: data.id,
      from,
      to,
      content,
      file_url: data.file_url,
      file_type: data.file_type,
      file_name: data.file_name,
      created_at: data.created_at
    });
  });
});

// Helper to get consistent DM room name
function getDmRoom(a, b) {
  return `dm_${[a, b].sort().join('_')}`;
}

// --- REST endpoint to fetch DM history ---
app.get('/dm/:userId/:friendId', async (req, res) => {
  const { userId, friendId } = req.params;
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .or(`and(sender_id.eq.${userId},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${userId})`)
    .order('created_at', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`)); 
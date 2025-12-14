// app.js - Main application logic

let currentUser = null;
let currentTab = 'pending';
let currentAudio = null;
let currentPlayingRow = null;
let currentTrackData = null;

/**
 * Initialize the application
 */
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 Initializing NoLabel Control Panel...');
  
  // Show auth screen by default
  showScreen('authScreen');
  
  // Set up auth form
  const authForm = document.getElementById('authForm');
  authForm.addEventListener('submit', handleLogin);
  
  // Set up logout buttons
  document.getElementById('logoutBtn')?.addEventListener('click', logout);
  document.getElementById('signOutBtn')?.addEventListener('click', logout);
  
  // Set up tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      currentTab = tab.dataset.tab;
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      loadData();
    });
  });
  
  // Set up bottom player controls
  initBottomPlayer();
});

/**
 * Handle login
 */
async function handleLogin(e) {
  e.preventDefault();
  
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  const authError = document.getElementById('authError');
  const submitBtn = document.getElementById('authSubmitBtn');
  
  // Validation
  if (!email || !password) {
    showError(authError, 'Please fill in both email and password');
    return;
  }
  
  // Disable button
  submitBtn.disabled = true;
  submitBtn.textContent = 'Authenticating...';
  authError.classList.add('hidden');
  
  try {
    console.log('🔐 Attempting to sign in:', email);
    
    // Sign in
    const { data, error: signInError } = await window.supabase.auth.signInWithPassword({ 
      email, 
      password 
    });
    
    if (signInError) {
      console.error('❌ Authentication Failed:', signInError);
      showError(authError, signInError.message);
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign In';
      return;
    }
    
    console.log('✅ Login successful');
    
    // Check if user is a moderator
    await checkModeratorStatus(data.user);
    
  } catch (err) {
    console.error('❌ Unexpected error during authentication:', err);
    showError(authError, 'An unexpected error occurred. Please try again.');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Sign In';
  }
}

/**
 * Check if user is a moderator
 */
async function checkModeratorStatus(user) {
  console.log('🔍 Checking moderator status for:', user.email);
  
  showScreen('loadingScreen');
  
  try {
    // Get user's artist name
    const { data: profile, error: profileError } = await window.supabase
      .from('profiles')
      .select('artist_name')
      .eq('id', user.id)
      .single();
    
    if (profileError) {
      console.error('❌ Error loading profile:', profileError);
      showScreen('accessDeniedScreen');
      return;
    }
    
    // Check if artist name is in allowed moderators list
    const { data: modCheck, error: modError } = await window.supabase
      .from('allowed_moderators')
      .select('artist_name')
      .eq('artist_name', profile.artist_name)
      .single();
    
    if (modError && modError.code !== 'PGRST116') {
      console.error('❌ Error checking mod status:', modError);
      showScreen('accessDeniedScreen');
      return;
    }
    
    if (modCheck) {
      console.log('✅ User is a moderator:', profile.artist_name);
      currentUser = user;
      
      // Display moderator information (NEW)
      document.getElementById('modArtistName').textContent = profile.artist_name;
      // Truncate user ID for display (e.g., first 8 characters of the UUID)
      document.getElementById('modUserId').textContent = `ID: ${user.id.substring(0, 8)}...`;
      
      showScreen('controlPanel');
      await loadData();
    } else {
      console.log('❌ User is not a moderator');
      showScreen('accessDeniedScreen');
    }
  } catch (err) {
    console.error('❌ Unexpected error checking moderator status:', err);
    showScreen('accessDeniedScreen');
  }
}

/**
 * Load data based on current tab
 */
async function loadData() {
  console.log('📊 Loading data for tab:', currentTab);
  
  const songsLoading = document.getElementById('songsLoading');
  const songsList = document.getElementById('songsList');
  
  songsLoading?.classList.remove('hidden');
  songsList?.classList.add('hidden');
  
  try {
    let songs = [];
    
    if (currentTab === 'pending') {
      // Load from pending_tracks table
      const { data, error } = await window.supabase
        .from('pending_tracks')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      songs = data || [];
      
    } else if (currentTab === 'approved') {
      // Load approved from audio_tracks with ID >= audio-21
      const { data, error } = await window.supabase
        .from('audio_tracks')
        .select('*')
        .gte('id', 'audio-21')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      songs = data || [];
      
    } else if (currentTab === 'all') {
      // Load ALL tracks from audio_tracks (including audio-1 through audio-20+)
      const { data, error } = await window.supabase
        .from('audio_tracks')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      songs = data || [];
    }
    
    // Load stats
    await loadStats();
    
    // Render songs
    renderSongs(songs);
    
    songsLoading?.classList.add('hidden');
    songsList?.classList.remove('hidden');
    
    console.log('✅ Data loaded');
  } catch (err) {
    console.error('❌ Error loading data:', err);
    alert('Failed to load data: ' + err.message);
  }
}

/**
 * Load statistics
 */
async function loadStats() {
  try {
    // Count ALL tracks from audio_tracks
    const { count: allCount } = await window.supabase
      .from('audio_tracks')
      .select('*', { count: 'exact', head: true });
    
    // Count pending
    const { count: pendingCount } = await window.supabase
      .from('pending_tracks')
      .select('*', { count: 'exact', head: true });
    
    // Count approved (audio-21 and above)
    const { count: approvedCount } = await window.supabase
      .from('audio_tracks')
      .select('*', { count: 'exact', head: true })
      .gte('id', 'audio-21');
    
    // Update UI
    document.getElementById('statAll').textContent = allCount || 0;
    document.getElementById('statPending').textContent = pendingCount || 0;
    document.getElementById('statApproved').textContent = approvedCount || 0;
  } catch (err) {
    console.error('❌ Error loading stats:', err);
  }
}

/**
 * Render songs list
 */
function renderSongs(songs) {
  const tableBody = document.getElementById('songsTableBody');
  const emptyState = document.getElementById('emptyState');
  
  if (!tableBody || !emptyState) return;
  
  tableBody.innerHTML = '';
  
  if (songs.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }
  
  emptyState.classList.add('hidden');
  
  songs.forEach(song => {
    const row = createSongRow(song);
    tableBody.appendChild(row);
  });
}

/**
 * Create a song row element
 */
function createSongRow(song) {
  const row = document.createElement('div');
  row.className = 'song-row';
  row.style.cursor = 'pointer';
  
  const date = new Date(song.created_at);
  const dateStr = date.toLocaleDateString();
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  // Determine status based on ID prefix
  let status = 'approved';
  let statusBadge = '';
  
  if (song.id.startsWith('pen-')) {
    status = 'pending';
    statusBadge = '<span class="status-badge status-pending">Pending Review</span>';
  } else if (song.id.startsWith('audio-')) {
    status = 'approved';
    statusBadge = '<span class="status-badge status-approved">Approved</span>';
  }
  
  // Action buttons based on status
  let actionButtons = '';
  if (status === 'pending') {
    actionButtons = `
      <button class="btn-approve" onclick="approveTrack('${song.id}')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        Approve
      </button>
      <button class="btn-reject" onclick="rejectTrack('${song.id}')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
        Reject
      </button>
    `;
  }
  
  row.innerHTML = `
    <div class="song-date">
      <div class="song-date-day">${dateStr}</div>
      <div class="song-date-time">${timeStr}</div>
    </div>
    
    <div class="song-details">
      <div class="song-cover-wrapper">
        <img src="${song.cover || song.pfp_url || 'https://via.placeholder.com/48'}" alt="${song.title}" class="song-cover">
        <div class="song-play-overlay">
          <svg class="play-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
          <svg class="pause-icon hidden" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="6" y="4" width="4" height="16"></rect>
            <rect x="14" y="4" width="4" height="16"></rect>
          </svg>
        </div>
      </div>
      
      <div class="song-info">
        <div class="song-artist">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
          <span>${song.artist_name || 'Unknown Artist'}</span>
        </div>
        <div class="song-title">${song.title}</div>
        <div class="song-meta">
          <span class="song-id">${song.id}</span>
          ${statusBadge}
        </div>
      </div>
      
      <div class="mod-actions">
        ${actionButtons}
      </div>
    </div>
  `;
  
  // Add click handler to play audio (on the cover image area)
  const coverWrapper = row.querySelector('.song-cover-wrapper');
  coverWrapper.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePlayPause(song.src, row, song);
  });
  
  return row;
}

/**
 * Initialize bottom player controls
 */
function initBottomPlayer() {
  const playPauseBtn = document.getElementById('playerPlayPause');
  const stopBtn = document.getElementById('playerStop');
  
  playPauseBtn?.addEventListener('click', () => {
    if (currentAudio) {
      if (currentAudio.paused) {
        currentAudio.play();
      } else {
        currentAudio.pause();
      }
    }
  });
  
  stopBtn?.addEventListener('click', () => {
    stopPlayer();
  });
}

/**
 * Update bottom player UI
 */
function updateBottomPlayer(trackData) {
  const player = document.getElementById('bottomPlayer');
  const cover = document.getElementById('playerCover');
  const title = document.getElementById('playerTitle');
  const artist = document.getElementById('playerArtist');
  
  if (!player || !cover || !title || !artist) return;
  
  player.classList.remove('hidden');
  cover.src = trackData.cover || trackData.pfp_url || 'https://via.placeholder.com/48';
  title.textContent = trackData.title || 'Unknown Track';
  artist.textContent = trackData.artist_name || 'Unknown Artist';
  
  currentTrackData = trackData;
}

/**
 * Update player play/pause icons
 */
function updatePlayerIcons(isPlaying) {
  const playIcon = document.querySelector('.player-play-icon');
  const pauseIcon = document.querySelector('.player-pause-icon');
  
  if (isPlaying) {
    playIcon?.classList.add('hidden');
    pauseIcon?.classList.remove('hidden');
  } else {
    playIcon?.classList.remove('hidden');
    pauseIcon?.classList.add('hidden');
  }
}

/**
 * Update player progress
 */
function updatePlayerProgress() {
  if (!currentAudio) return;
  
  const currentTime = document.getElementById('playerCurrentTime');
  const duration = document.getElementById('playerDuration');
  const progressFill = document.getElementById('playerProgressFill');
  
  const current = currentAudio.currentTime;
  const total = currentAudio.duration || 0;
  
  if (currentTime) {
    currentTime.textContent = formatTime(current);
  }
  
  if (duration && total) {
    duration.textContent = formatTime(total);
  }
  
  if (progressFill && total) {
    const percentage = (current / total) * 100;
    progressFill.style.width = percentage + '%';
  }
}

/**
 * Format time in MM:SS
 */
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Stop player
 */
function stopPlayer() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  
  if (currentPlayingRow) {
    currentPlayingRow.querySelector('.play-icon')?.classList.remove('hidden');
    currentPlayingRow.querySelector('.pause-icon')?.classList.add('hidden');
    currentPlayingRow.style.backgroundColor = '';
    currentPlayingRow = null;
  }
  
  document.getElementById('bottomPlayer')?.classList.add('hidden');
  updatePlayerIcons(false);
  
  const progressFill = document.getElementById('playerProgressFill');
  if (progressFill) progressFill.style.width = '0%';
}

/**
 * Toggle play/pause for audio
 */
function togglePlayPause(audioSrc, rowElement, trackData) {
  if (!audioSrc) {
    alert('No audio file available');
    return;
  }
  
  const playIcon = rowElement.querySelector('.play-icon');
  const pauseIcon = rowElement.querySelector('.pause-icon');
  
  // If clicking on the same song that's playing, pause it
  if (currentAudio && currentPlayingRow === rowElement) {
    if (currentAudio.paused) {
      currentAudio.play();
      playIcon.classList.add('hidden');
      pauseIcon.classList.remove('hidden');
      rowElement.style.backgroundColor = '#f3f4f6';
      updatePlayerIcons(true);
      console.log('▶️ Resumed');
    } else {
      currentAudio.pause();
      playIcon.classList.remove('hidden');
      pauseIcon.classList.add('hidden');
      rowElement.style.backgroundColor = '';
      updatePlayerIcons(false);
      console.log('⏸️ Paused');
    }
    return;
  }
  
  // Stop previous audio if playing
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    if (currentPlayingRow) {
      currentPlayingRow.querySelector('.play-icon')?.classList.remove('hidden');
      currentPlayingRow.querySelector('.pause-icon')?.classList.add('hidden');
      currentPlayingRow.style.backgroundColor = '';
    }
  }
  
  // Create new audio and play
  currentAudio = new Audio(audioSrc);
  currentPlayingRow = rowElement;
  
  // Update bottom player
  updateBottomPlayer(trackData);
  
  currentAudio.addEventListener('ended', () => {
    playIcon.classList.remove('hidden');
    pauseIcon.classList.add('hidden');
    rowElement.style.backgroundColor = '';
    updatePlayerIcons(false);
    currentAudio = null;
    currentPlayingRow = null;
  });
  
  currentAudio.addEventListener('error', (e) => {
    console.error('❌ Audio error:', e);
    alert('Failed to play audio');
    playIcon.classList.remove('hidden');
    pauseIcon.classList.add('hidden');
    rowElement.style.backgroundColor = '';
    stopPlayer();
  });
  
  currentAudio.addEventListener('timeupdate', updatePlayerProgress);
  currentAudio.addEventListener('loadedmetadata', updatePlayerProgress);
  
  currentAudio.play();
  playIcon.classList.add('hidden');
  pauseIcon.classList.remove('hidden');
  rowElement.style.backgroundColor = '#f3f4f6';
  updatePlayerIcons(true);
  console.log('🎵 Playing:', audioSrc);
}

/**
 * Approve a track - move from pending_tracks to audio_tracks
 */
async function approveTrack(pendingId) {
  if (!confirm('Approve this track? It will be published to the site.')) {
    return;
  }
  
  console.log('✅ Approving track:', pendingId);
  
  try {
    // Get the pending track data
    const { data: pendingTrack, error: fetchError } = await window.supabase
      .from('pending_tracks')
      .select('*')
      .eq('id', pendingId)
      .single();
    
    if (fetchError) throw fetchError;
    
    // Find next available audio-X number
    const { data: existingAudio, error: audioFetchError } = await window.supabase
      .from('audio_tracks')
      .select('id')
      .like('id', 'audio-%')
      .order('created_at', { ascending: false });
    
    if (audioFetchError) throw audioFetchError;
    
    let nextNumber = 20;
    if (existingAudio && existingAudio.length > 0) {
      existingAudio.forEach(track => {
        const match = track.id.match(/^audio-(\d+)$/);
        if (match) {
          const num = parseInt(match[1]);
          if (num >= nextNumber) nextNumber = num + 1;
        }
      });
    }
    
    const audioId = `audio-${nextNumber}`;
    
    console.log(`📝 Creating new track: ${audioId}`);
    
    // Insert into audio_tracks with new ID
    const { error: insertError } = await window.supabase
      .from('audio_tracks')
      .insert({
        id: audioId,
        user_id: pendingTrack.user_id,
        artist_name: pendingTrack.artist_name,
        title: pendingTrack.title,
        src: pendingTrack.src,
        pfp_url: pendingTrack.cover || '',
        artist_link: pendingTrack.artist_link || '#',
        buy_link: pendingTrack.buy_link || 'notforsale.html',
        created_at: pendingTrack.created_at
      });
    
    if (insertError) throw insertError;
    
    // Delete from pending_tracks
    const { error: deleteError } = await window.supabase
      .from('pending_tracks')
      .delete()
      .eq('id', pendingId);
    
    if (deleteError) throw deleteError;
    
    console.log(`✅ Track approved: ${pendingId} → ${audioId}`);
    alert(`Track approved! Published as ${audioId}`);
    
    // Reload data
    await loadData();
    
  } catch (error) {
    console.error('❌ Error approving track:', error);
    alert('Failed to approve track: ' + error.message);
  }
}

/**
 * Reject a track - delete from pending_tracks
 */
async function rejectTrack(pendingId) {
  if (!confirm('Reject this track? This will permanently delete it.')) {
    return;
  }
  
  console.log('❌ Rejecting track:', pendingId);
  
  try {
    const { error } = await window.supabase
      .from('pending_tracks')
      .delete()
      .eq('id', pendingId);
    
    if (error) throw error;
    
    console.log('✅ Track rejected and deleted');
    alert('Track rejected');
    
    // Reload data
    await loadData();
    
  } catch (error) {
    console.error('❌ Error rejecting track:', error);
    alert('Failed to reject track: ' + error.message);
  }
}

/**
 * Logout
 */
async function logout() {
  console.log('👋 Logging out...');
  
  // Stop any playing audio
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  
  try {
    const { error } = await window.supabase.auth.signOut();
    
    if (error) {
      console.error('❌ Logout error:', error);
      alert('Failed to logout: ' + error.message);
      return;
    }
    
    console.log('✅ Logout successful');
    currentUser = null;
    
    // Show auth screen
    showScreen('authScreen');
    
    // Clear form fields
    document.getElementById('authEmail').value = '';
    document.getElementById('authPassword').value = '';
    
  } catch (err) {
    console.error('❌ Unexpected error during logout:', err);
    alert('An unexpected error occurred during logout.');
  }
}

/**
 * Show error message
 */
function showError(errorElement, message) {
  errorElement.textContent = message;
  errorElement.classList.remove('hidden');
}

/**
 * Show a specific screen
 */
function showScreen(screenId) {
  const screens = ['loadingScreen', 'authScreen', 'accessDeniedScreen', 'controlPanel'];
  screens.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.toggle('hidden', id !== screenId);
    }
  });
}

// Make functions global
window.approveTrack = approveTrack;
window.rejectTrack = rejectTrack;
window.togglePlayPause = togglePlayPause;
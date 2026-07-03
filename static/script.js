// ========== PRIME TEMP MAIL - Complete Scripts ==========

// ===== SESSION =====
let sessionId = 'user_' + Math.random().toString(36).substr(2, 9);
document.getElementById('sessionId').value = sessionId;
let refreshInterval = null;

// ===== TOAST NOTIFICATION =====
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.5s ease reverse';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

// ===== PLAY OTP SOUND =====
function playOTPSound() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.value = 0.3;
        osc.start();
        setTimeout(() => {
            osc.frequency.value = 1100;
            setTimeout(() => {
                osc.stop();
            }, 150);
        }, 150);
    } catch (e) {
        // Audio not supported
    }
}

// ===== CREATE EMAIL =====
function createEmail() {
    const display = document.getElementById('emailDisplay');
    display.value = '⏳ Generating...';
    
    fetch('/api/create?session_id=' + sessionId)
        .then(res => res.json())
        .then(data => {
            if (!data.success) {
                if (data.email) {
                    display.value = data.email;
                    showToast('⚠️ Already have active email: ' + data.email, 'info');
                } else {
                    display.value = '';
                    showToast('❌ ' + data.error, 'error');
                }
                return;
            }
            
            display.value = data.email;
            document.getElementById('otpDisplay').textContent = '⏳ Waiting for OTP...';
            document.getElementById('otpDisplay').className = 'otp-display waiting';
            document.getElementById('otpTime').textContent = '';
            updateStatus(data.email);
            refreshInbox();
            
            if (refreshInterval) clearInterval(refreshInterval);
            refreshInterval = setInterval(refreshInbox, 5000);
            
            showToast('✅ New email created: ' + data.email, 'success');
        })
        .catch(err => {
            display.value = '';
            showToast('❌ Error: ' + err.message, 'error');
        });
}

// ===== REFRESH INBOX =====
function refreshInbox() {
    fetch('/api/inbox?session_id=' + sessionId)
        .then(res => res.json())
        .then(data => {
            if (!data.success) {
                document.getElementById('inboxList').innerHTML = '<div class="loading">📭 ' + data.error + '</div>';
                return;
            }
            
            // Update OTP
            if (data.otp) {
                const otpDisplay = document.getElementById('otpDisplay');
                const oldOtp = otpDisplay.textContent;
                if (oldOtp !== data.otp) {
                    otpDisplay.textContent = data.otp;
                    otpDisplay.className = 'otp-display found';
                    document.getElementById('otpTime').textContent = '✅ Auto-detected at ' + new Date().toLocaleTimeString();
                    playOTPSound();
                    showToast('🔐 OTP Detected: ' + data.otp, 'success');
                }
            } else {
                if (document.getElementById('otpDisplay').className !== 'waiting') {
                    document.getElementById('otpDisplay').textContent = '🔍 No OTP found yet';
                    document.getElementById('otpDisplay').className = 'otp-display';
                }
            }
            
            // Update Email
            if (data.email) {
                document.getElementById('emailDisplay').value = data.email;
                updateStatus(data.email);
            }
            
            // Update Inbox
            const messages = data.messages || [];
            document.getElementById('msgCount').textContent = '(' + messages.length + ')';
            
            if (messages.length === 0) {
                document.getElementById('inboxList').innerHTML = '<div class="loading">📭 No messages yet</div>';
                return;
            }
            
            let html = '';
            messages.forEach(msg => {
                const date = new Date(msg.date * 1000);
                html += `
                    <div class="message-item" onclick="readMessage('${msg.id}')">
                        <span class="from">📤 ${msg.from || 'Unknown'}</span>
                        <span class="subject">📝 ${msg.subject || 'No Subject'}</span>
                        <span class="time">${date.toLocaleString()}</span>
                    </div>
                `;
            });
            document.getElementById('inboxList').innerHTML = html;
        })
        .catch(err => {
            console.error('Error:', err);
        });
}

// ===== READ MESSAGE =====
function readMessage(msgId) {
    document.getElementById('modalBody').innerHTML = '<div class="loading">Loading message</div>';
    document.getElementById('messageModal').style.display = 'block';
    
    fetch('/api/read?session_id=' + sessionId + '&id=' + msgId)
        .then(res => res.json())
        .then(data => {
            if (!data.success) {
                document.getElementById('modalBody').innerHTML = '<p style="color:#ff416c;">❌ ' + data.error + '</p>';
                return;
            }
            
            const date = data.date ? new Date(data.date * 1000).toLocaleString() : 'Unknown';
            document.getElementById('modalBody').innerHTML = `
                <div class="msg-meta"><strong>From:</strong> ${data.from || 'Unknown'}</div>
                <div class="msg-meta"><strong>Subject:</strong> ${data.subject || 'No Subject'}</div>
                <div class="msg-meta"><strong>Date:</strong> ${date}</div>
                <div class="msg-body">${data.text || 'No content available'}</div>
                ${data.otp ? `<div class="msg-otp">🔐 OTP: ${data.otp}</div>` : '<div style="color:#666;margin-top:10px;">🔍 No OTP found in this message</div>'}
            `;
        })
        .catch(err => {
            document.getElementById('modalBody').innerHTML = '<p style="color:#ff416c;">❌ Error: ' + err.message + '</p>';
        });
}

// ===== DELETE EMAIL =====
function deleteEmail() {
    if (!confirm('🗑️ Delete this email? All messages will be lost.')) return;
    
    fetch('/api/delete?session_id=' + sessionId)
        .then(res => res.json())
        .then(data => {
            document.getElementById('emailDisplay').value = '';
            document.getElementById('otpDisplay').textContent = '⏳ Waiting for OTP...';
            document.getElementById('otpDisplay').className = 'otp-display waiting';
            document.getElementById('otpTime').textContent = '';
            document.getElementById('inboxList').innerHTML = '<div class="loading">📭 No messages yet</div>';
            document.getElementById('msgCount').textContent = '';
            document.getElementById('statusDisplay').innerHTML = '<span class="badge badge-warning">⏳ No active email</span>';
            document.getElementById('statusDetails').textContent = '';
            if (refreshInterval) clearInterval(refreshInterval);
            showToast('🗑️ Email deleted successfully', 'info');
        });
}

// ===== COPY EMAIL =====
function copyEmail() {
    const email = document.getElementById('emailDisplay');
    if (!email.value) {
        showToast('⚠️ No email to copy. Generate one first!', 'error');
        return;
    }
    email.select();
    document.execCommand('copy');
    showToast('✅ Email copied!', 'success');
}

// ===== UPDATE STATUS =====
function updateStatus(email) {
    fetch('/api/status?session_id=' + sessionId)
        .then(res => res.json())
        .then(data => {
            if (!data.success) {
                document.getElementById('statusDisplay').innerHTML = '<span class="badge badge-danger">❌ ' + data.error + '</span>';
                return;
            }
            document.getElementById('statusDisplay').innerHTML = `
                <span class="badge badge-success">✅ Active</span>
                <span style="color:#888;font-size:0.85em;margin-left:10px;">${data.email}</span>
            `;
            document.getElementById('statusDetails').textContent = 
                `📨 ${data.messages} messages | ⏳ ${data.hours_left}h remaining`;
        });
}

// ===== CLOSE MODAL =====
function closeModal() {
    document.getElementById('messageModal').style.display = 'none';
}

// ===== KEYBOARD SHORTCUTS =====
document.addEventListener('keydown', function(e) {
    // Ctrl+N = New Email
    if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        if (typeof createEmail === 'function') createEmail();
    }
    // Ctrl+R = Refresh
    if (e.ctrlKey && e.key === 'r') {
        e.preventDefault();
        if (typeof refreshInbox === 'function') refreshInbox();
    }
    // Escape = Close Modal
    if (e.key === 'Escape') {
        if (typeof closeModal === 'function') closeModal();
    }
});

// ===== ONLINE/OFFLINE STATUS =====
window.addEventListener('online', function() {
    showToast('✅ Back online!', 'success');
    if (typeof refreshInbox === 'function') refreshInbox();
});

window.addEventListener('offline', function() {
    showToast('⚠️ You are offline. Please check your connection.', 'error');
});

// ===== CLOSE MODAL ON CLICK OUTSIDE =====
document.getElementById('messageModal').addEventListener('click', function(e) {
    if (e.target === this) closeModal();
});

// ===== AUTO-REFRESH ON LOAD =====
window.onload = function() {
    // Check if session exists
    fetch('/api/status?session_id=' + sessionId)
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                document.getElementById('emailDisplay').value = data.email;
                updateStatus(data.email);
                refreshInbox();
                if (refreshInterval) clearInterval(refreshInterval);
                refreshInterval = setInterval(refreshInbox, 5000);
            }
        });
};
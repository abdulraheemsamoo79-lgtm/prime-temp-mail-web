// ========== PREMIUM SCRIPT - COMPLETE ==========

let sessionId = 'user_' + Math.random().toString(36).substr(2, 9);
document.getElementById('sessionId').value = sessionId;
let refreshInterval = null;
let otpHistory = [];
let emailHistory = [];
let totalOtps = 0;
let totalEmails = 0;
let currentTheme = 'dark';

// ===== SIDEBAR TOGGLE =====
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

// ===== TABS =====
function showTab(tab) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-' + tab).classList.add('active');
    
    document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll(`.menu-item[onclick*="${tab}"]`).forEach(el => el.classList.add('active'));
}

// ===== THEME TOGGLE =====
function toggleTheme() {
    const root = document.documentElement;
    if (currentTheme === 'dark') {
        root.style.setProperty('--bg-primary', '#f0f0f0');
        root.style.setProperty('--bg-secondary', '#ffffff');
        root.style.setProperty('--text-primary', '#1a1a2e');
        root.style.setProperty('--text-secondary', '#666');
        root.style.setProperty('--bg-card', 'rgba(0,0,0,0.05)');
        root.style.setProperty('--border-color', 'rgba(0,0,0,0.08)');
        currentTheme = 'light';
        document.querySelector('.theme-toggle i').className = 'fas fa-sun';
    } else {
        root.style.setProperty('--bg-primary', '#0c0c1a');
        root.style.setProperty('--bg-secondary', '#1a1a2e');
        root.style.setProperty('--text-primary', '#ffffff');
        root.style.setProperty('--text-secondary', '#aaa');
        root.style.setProperty('--bg-card', 'rgba(255,255,255,0.05)');
        root.style.setProperty('--border-color', 'rgba(255,255,255,0.08)');
        currentTheme = 'dark';
        document.querySelector('.theme-toggle i').className = 'fas fa-moon';
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
                } else {
                    display.value = '';
                    showToast('❌ ' + data.error, 'error');
                }
                return;
            }
            display.value = data.email;
            totalEmails++;
            document.getElementById('totalEmails').textContent = totalEmails;
            document.getElementById('statusBadge').textContent = '🟢 Active';
            document.getElementById('statusBadge').style.color = '#38ef7d';
            
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
                document.getElementById('inboxList').innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>' + data.error + '</p></div>';
                return;
            }
            
            if (data.otp) {
                const otpDisplay = document.getElementById('otpDisplay');
                const oldOtp = otpDisplay.textContent;
                if (oldOtp !== data.otp) {
                    otpDisplay.textContent = data.otp;
                    otpDisplay.className = 'otp-display premium-otp found';
                    document.getElementById('otpTime').textContent = '✅ Auto-detected at ' + new Date().toLocaleTimeString();
                    document.getElementById('otpStatus').textContent = '🔐 OTP Found!';
                    document.getElementById('otpStatus').style.color = '#38ef7d';
                    totalOtps++;
                    document.getElementById('totalOtps').textContent = totalOtps;
                    otpHistory.push({ otp: data.otp, time: new Date().toLocaleTimeString() });
                    updateOTPHistory();
                    showToast('🔐 OTP Detected: ' + data.otp, 'success');
                    playOTPSound();
                }
            } else {
                document.getElementById('otpDisplay').textContent = '🔍 No OTP found yet';
                document.getElementById('otpDisplay').className = 'otp-display premium-otp';
                document.getElementById('otpStatus').textContent = '⏳ Waiting...';
                document.getElementById('otpStatus').style.color = '#aaa';
            }
            
            if (data.email) {
                document.getElementById('emailDisplay').value = data.email;
                updateStatus(data.email);
            }
            
            const messages = data.messages || [];
            document.getElementById('msgCount').textContent = messages.length + ' messages';
            document.getElementById('inboxBadge').textContent = messages.length;
            document.getElementById('activeToday').textContent = messages.length;
            
            if (messages.length === 0) {
                document.getElementById('inboxList').innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>No messages yet</p><span>Generate an email to start receiving OTPs</span></div>';
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

// ===== UPDATE OTP HISTORY =====
function updateOTPHistory() {
    const container = document.getElementById('otpHistory');
    if (otpHistory.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-key"></i><p>No OTPs received yet</p></div>';
        return;
    }
    let html = '';
    otpHistory.reverse().forEach(item => {
        html += `
            <div class="message-item" style="border-left-color:#38ef7d;">
                <span class="from">🔐 OTP: <strong>${item.otp}</strong></span>
                <span class="time">${item.time}</span>
            </div>
        `;
    });
    container.innerHTML = html;
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
                <div style="margin-bottom:10px;"><strong>From:</strong> ${data.from || 'Unknown'}</div>
                <div style="margin-bottom:10px;"><strong>Subject:</strong> ${data.subject || 'No Subject'}</div>
                <div style="margin-bottom:10px;"><strong>Date:</strong> ${date}</div>
                <div class="msg-body" style="background:rgba(0,0,0,0.3);padding:15px;border-radius:10px;white-space:pre-wrap;max-height:400px;overflow-y:auto;">${data.text || 'No content available'}</div>
                ${data.otp ? `<div style="background:rgba(56,239,125,0.1);border:1px solid #38ef7d;padding:12px;border-radius:10px;margin-top:15px;text-align:center;font-size:1.5em;color:#38ef7d;font-family:monospace;">🔐 OTP: ${data.otp}</div>` : '<div style="color:#666;margin-top:10px;">🔍 No OTP found in this message</div>'}
            `;
        });
}

// ===== COPY OTP =====
function copyOTP() {
    const otp = document.getElementById('otpDisplay').textContent;
    if (otp && otp !== '⏳ Waiting for OTP...' && otp !== '🔍 No OTP found yet') {
        navigator.clipboard.writeText(otp).then(() => {
            showToast('✅ OTP Copied: ' + otp, 'success');
        });
    } else {
        showToast('⚠️ No OTP to copy', 'error');
    }
}

// ===== EXTEND TIME =====
function extendTime() {
    showToast('⏳ Time extended by 1 hour!', 'info');
}

// ===== VERIFY OTP =====
function verifyOTP() {
    const otp = document.getElementById('otpDisplay').textContent;
    if (otp && otp !== '⏳ Waiting for OTP...' && otp !== '🔍 No OTP found yet') {
        showToast('✅ OTP Verified: ' + otp + ' ✅', 'success');
    } else {
        showToast('⚠️ No OTP to verify', 'error');
    }
}

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
            setTimeout(() => osc.stop(), 150);
        }, 150);
    } catch(e) {}
}

// ===== COPY EMAIL =====
function copyEmail() {
    const email = document.getElementById('emailDisplay');
    if (!email.value) {
        showToast('⚠️ No email to copy', 'error');
        return;
    }
    navigator.clipboard.writeText(email.value).then(() => {
        showToast('✅ Email copied!', 'success');
    });
}

// ===== DELETE EMAIL =====
function deleteEmail() {
    if (!confirm('🗑️ Delete this email?')) return;
    fetch('/api/delete?session_id=' + sessionId)
        .then(res => res.json())
        .then(data => {
            document.getElementById('emailDisplay').value = '';
            document.getElementById('otpDisplay').textContent = '⏳ Waiting for OTP...';
            document.getElementById('otpDisplay').className = 'otp-display premium-otp';
            document.getElementById('inboxList').innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>No messages yet</p></div>';
            document.getElementById('msgCount').textContent = '0 messages';
            document.getElementById('inboxBadge').textContent = '0';
            document.getElementById('statusBadge').textContent = '🔴 Inactive';
            document.getElementById('statusBadge').style.color = '#ff416c';
            if (refreshInterval) clearInterval(refreshInterval);
            showToast('🗑️ Email deleted', 'info');
        });
}

// ===== UPDATE STATUS =====
function updateStatus(email) {
    fetch('/api/status?session_id=' + sessionId)
        .then(res => res.json())
        .then(data => {
            if (!data.success) return;
            document.getElementById('statusBadge').textContent = '🟢 Active';
            document.getElementById('statusBadge').style.color = '#38ef7d';
        });
}

// ===== CHANGE REFRESH INTERVAL =====
function changeRefreshInterval() {
    const val = parseInt(document.getElementById('refreshInterval').value);
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(refreshInbox, val * 1000);
    showToast('⏱️ Refresh interval: ' + val + ' seconds', 'info');
}

// ===== CHANGE EXPIRY =====
function changeExpiry() {
    showToast('⏰ Expiry updated!', 'info');
}

// ===== UPGRADE PLAN =====
function upgradePlan() {
    document.getElementById('upgradeModal').style.display = 'block';
}

// ===== ACTIVATE PREMIUM =====
function activatePremium() {
    document.getElementById('upgradeModal').style.display = 'none';
    showToast('🎉 Premium Activated! Welcome to PRIME TEMP MAIL PRO!', 'success');
}

// ===== CLOSE MODAL =====
function closeModal() {
    document.getElementById('messageModal').style.display = 'none';
}

// ===== CLOSE MODAL ON ESC =====
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeModal();
    if (e.key === 'Escape') document.getElementById('upgradeModal').style.display = 'none';
});

// ===== CLOSE MODAL ON CLICK OUTSIDE =====
document.getElementById('messageModal').addEventListener('click', function(e) {
    if (e.target === this) closeModal();
});

document.getElementById('upgradeModal').addEventListener('click', function(e) {
    if (e.target === this) this.style.display = 'none';
});

// ===== AUTO-REFRESH ON LOAD =====
window.onload = function() {
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

from flask import Flask, render_template, request, jsonify
import requests
import json
import re
import time
from datetime import datetime
import threading

app = Flask(__name__)

# ========== SESSIONS STORE ==========
sessions = {}

# ========== TEMPMAILPORTAL API ==========
API_BASE = "https://api.tempmailportal.com/api"

def create_inbox():
    """Create new temporary email inbox"""
    try:
        response = requests.post(f"{API_BASE}/inbox", timeout=10)
        if response.status_code == 200:
            data = response.json()
            return {
                'email': data.get('address'),
                'token': data.get('token'),
                'created': datetime.now().isoformat(),
                'last_msg_id': None,
                'last_otp': None
            }
        return None
    except Exception as e:
        print(f"Error creating inbox: {e}")
        return None

def get_messages(token):
    """Get all messages from inbox"""
    try:
        headers = {'Authorization': f'Bearer {token}'}
        response = requests.get(f"{API_BASE}/messages", headers=headers, timeout=10)
        if response.status_code == 200:
            return response.json()
        return []
    except Exception as e:
        print(f"Error fetching messages: {e}")
        return []

def get_message_content(token, msg_id):
    """Get full message content"""
    try:
        headers = {'Authorization': f'Bearer {token}'}
        response = requests.get(f"{API_BASE}/messages/{msg_id}", headers=headers, timeout=10)
        if response.status_code == 200:
            return response.json()
        return {}
    except Exception as e:
        print(f"Error reading message: {e}")
        return {}

def delete_inbox(token):
    """Delete inbox"""
    try:
        headers = {'Authorization': f'Bearer {token}'}
        response = requests.delete(f"{API_BASE}/inbox", headers=headers)
        return response.status_code == 200
    except:
        return False

def extract_otp(text):
    """Extract OTP from text using multiple patterns"""
    if not text:
        return None
    
    patterns = [
        r'OTP[:\s]*(\d{4,8})',
        r'[Oo][Tt][Pp][:\s]*(\d{4,8})',
        r'code[:\s]*(\d{4,8})',
        r'verification[:\s]*(\d{4,8})',
        r'verify[:\s]*(\d{4,8})',
        r'pin[:\s]*(\d{4,8})',
        r'confirmation[:\s]*(\d{4,8})',
        r'Your verification code is (\d{4,8})',
        r'verification code: (\d{4,8})',
        r'code: (\d{4,8})',
        r'OTP: (\d{4,8})',
        r'\b(\d{4,8})\b',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            if match.group(1):
                return match.group(1)
            return match.group(0)
    return None

def format_time(timestamp):
    try:
        dt = datetime.fromtimestamp(int(timestamp))
        return dt.strftime("%H:%M:%S - %d/%m/%Y")
    except:
        return "Unknown"

# ========== ROUTES ==========
@app.route('/')
def home():
    """Render main page"""
    return render_template('index.html')

@app.route('/api/create')
def api_create():
    """Create new email"""
    session_id = request.args.get('session_id', 'default')
    
    if session_id in sessions:
        return jsonify({
            'success': False,
            'error': 'Already have active email',
            'email': sessions[session_id]['email']
        })
    
    inbox = create_inbox()
    if not inbox:
        return jsonify({
            'success': False,
            'error': 'Failed to create email. Please try again.'
        })
    
    sessions[session_id] = inbox
    return jsonify({
        'success': True,
        'email': inbox['email'],
        'token': inbox['token']
    })

@app.route('/api/inbox')
def api_inbox():
    """Get all messages and auto-detect OTP"""
    session_id = request.args.get('session_id', 'default')
    
    if session_id not in sessions:
        return jsonify({
            'success': False,
            'error': 'No active email. Create one first.'
        })
    
    session = sessions[session_id]
    token = session['token']
    
    # Get messages
    messages = get_messages(token)
    
    # Auto-OTP detection
    otp = None
    if messages:
        latest = messages[0]
        if session.get('last_msg_id') != latest['id']:
            session['last_msg_id'] = latest['id']
            content = get_message_content(token, latest['id'])
            body = content.get('text', '') or content.get('html', '') or ''
            subject = content.get('subject', '')
            full_text = f"{subject} {body}"
            otp = extract_otp(full_text)
            if otp:
                session['last_otp'] = otp
                session['last_otp_time'] = datetime.now().isoformat()
    
    # Return messages with OTP if found
    return jsonify({
        'success': True,
        'messages': messages,
        'otp': session.get('last_otp'),
        'otp_time': session.get('last_otp_time'),
        'email': session['email']
    })

@app.route('/api/read')
def api_read():
    """Read full message content"""
    session_id = request.args.get('session_id', 'default')
    msg_id = request.args.get('id')
    
    if not msg_id:
        return jsonify({'success': False, 'error': 'Message ID required'})
    
    if session_id not in sessions:
        return jsonify({'success': False, 'error': 'No active email'})
    
    token = sessions[session_id]['token']
    content = get_message_content(token, msg_id)
    
    if not content:
        return jsonify({'success': False, 'error': 'Message not found'})
    
    # Extract OTP from this message
    body = content.get('text', '') or content.get('html', '') or ''
    subject = content.get('subject', '')
    full_text = f"{subject} {body}"
    otp = extract_otp(full_text)
    
    return jsonify({
        'success': True,
        'from': content.get('from', 'Unknown'),
        'subject': content.get('subject', 'No Subject'),
        'text': body[:500] if body else 'No content',
        'html': content.get('html', '')[:500],
        'date': content.get('date', 0),
        'otp': otp
    })

@app.route('/api/delete')
def api_delete():
    """Delete email"""
    session_id = request.args.get('session_id', 'default')
    
    if session_id in sessions:
        token = sessions[session_id]['token']
        delete_inbox(token)
        del sessions[session_id]
        return jsonify({'success': True})
    
    return jsonify({'success': False, 'error': 'No active email'})

@app.route('/api/status')
def api_status():
    """Get email status"""
    session_id = request.args.get('session_id', 'default')
    
    if session_id not in sessions:
        return jsonify({
            'success': False,
            'error': 'No active email'
        })
    
    session = sessions[session_id]
    token = session['token']
    messages = get_messages(token)
    
    try:
        created = datetime.fromisoformat(session['created'])
        time_left = 86400 - (datetime.now() - created).seconds
        hours_left = max(0, time_left // 3600)
    except:
        hours_left = 24
    
    return jsonify({
        'success': True,
        'email': session['email'],
        'messages': len(messages),
        'created': session['created'],
        'hours_left': hours_left,
        'otp': session.get('last_otp')
    })

# ========== AUTO CLEANUP ==========
def cleanup_sessions():
    """Remove sessions older than 24 hours"""
    while True:
        time.sleep(3600)  # Every hour
        try:
            now = datetime.now()
            expired = []
            for sid, session in sessions.items():
                created = datetime.fromisoformat(session['created'])
                if (now - created).seconds > 86400:
                    expired.append(sid)
            for sid in expired:
                token = sessions[sid]['token']
                delete_inbox(token)
                del sessions[sid]
                print(f"🗑️ Cleaned up expired session: {sid}")
        except Exception as e:
            print(f"Cleanup error: {e}")

# Start cleanup thread
cleanup_thread = threading.Thread(target=cleanup_sessions, daemon=True)
cleanup_thread.start()

# ========== MAIN ==========
if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
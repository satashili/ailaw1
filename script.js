document.addEventListener('DOMContentLoaded', function() {
    const loginModal = document.getElementById('loginModal');
    const registerModal = document.getElementById('registerModal');
    const loginBtn = document.querySelector('.login');
    const registerBtn = document.querySelector('.register');
    const closeBtns = document.querySelectorAll('.close');
    const showRegisterLink = document.getElementById('showRegister');
    const showLoginLink = document.getElementById('showLogin');
    const positionCards = document.querySelectorAll('.position-card');

    // 处理立场卡片点击
    positionCards.forEach(card => {
        card.addEventListener('click', function() {
            const position = this.querySelector('h3').textContent;
            if (!isLoggedIn()) {
                showLoginPrompt();
                return;
            }
            navigateToUpload(position);
        });
    });

    // 检查是否登录
    function isLoggedIn() {
        return !!localStorage.getItem('token');
    }

    // 显示登录提示
    function showLoginPrompt() {
        const prompt = document.createElement('div');
        prompt.className = 'login-prompt';
        prompt.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        `;
        
        prompt.innerHTML = `
            <div class="login-prompt-content" style="
                background: white;
                padding: 2rem;
                border-radius: 8px;
                text-align: center;
            ">
                <h3>Login Required</h3>
                <p>Please login to use this feature</p>
                <button class="prompt-login-btn" style="
                    background: var(--primary-color);
                    color: white;
                    border: none;
                    padding: 0.5rem 2rem;
                    border-radius: 4px;
                    margin-top: 1rem;
                    cursor: pointer;
                ">Login Now</button>
            </div>
        `;
        
        document.body.appendChild(prompt);
        
        prompt.querySelector('.prompt-login-btn').addEventListener('click', () => {
            prompt.remove();
            loginModal.style.display = 'block';
        });
        
        prompt.addEventListener('click', (e) => {
            if (e.target === prompt) {
                prompt.remove();
            }
        });
    }

    // 跳转到上传页面
    function navigateToUpload(position) {
        sessionStorage.setItem('selectedPosition', position);
        window.location.href = 'upload.html';
    }

    // 登录表单处理
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = e.target.querySelector('input[type="email"]').value;
        const password = e.target.querySelector('input[type="password"]').value;
        
        try {
            const response = await fetch('http://localhost:3000/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error);
            }

            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            loginModal.style.display = 'none';
            updateAuthUI();
        } catch (error) {
            alert('登录失败: ' + error.message);
        }
    });

    // 注册表单处理
    document.getElementById('registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = e.target.querySelector('input[type="text"]').value;
        const email = e.target.querySelector('input[type="email"]').value;
        const password = e.target.querySelector('input[type="password"]').value;
        
        try {
            const response = await fetch('http://localhost:3000/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, email, password })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error);
            }

            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            registerModal.style.display = 'none';
            updateAuthUI();
        } catch (error) {
            alert('注册失败: ' + error.message);
        }
    });

    // 更新认证UI
    function updateAuthUI() {
        const authButtons = document.querySelector('.auth-buttons');
        const user = JSON.parse(localStorage.getItem('user'));
        
        if (user) {
            // 获取最新的用户信息，包括免费试用次数
            fetch('http://localhost:3000/api/user/info', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            })
            .then(response => response.json())
            .then(data => {
                // 更新本地存储的用户信息
                localStorage.setItem('user', JSON.stringify(data));
                
                // 显示用户信息和免费试用次数
                let subscriptionStatus = '';
                if (data.hasActiveSubscription) {
                    subscriptionStatus = '<span class="premium-badge">Premium</span>';
                } else if (data.freeTrialsRemaining > 0) {
                    subscriptionStatus = `<span class="trial-badge">${data.freeTrialsRemaining} free trials left</span>`;
                } else {
                    subscriptionStatus = '<span class="trial-expired">Free trial expired</span>';
                }
                
                authButtons.innerHTML = `
                    <div class="user-info">
                        <span>Welcome, ${data.username}</span>
                        ${subscriptionStatus}
                    </div>
                    <button class="logout">Logout</button>
                `;
                
                document.querySelector('.logout').addEventListener('click', () => {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    updateAuthUI();
                });
            })
            .catch(error => {
                console.error('Error fetching user info:', error);
                // 如果获取失败，使用本地存储的信息
                authButtons.innerHTML = `
                    <span>Welcome, ${user.username}</span>
                    <button class="logout">Logout</button>
                `;
                
                document.querySelector('.logout').addEventListener('click', () => {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    updateAuthUI();
                });
            });
        } else {
            authButtons.innerHTML = `
                <button class="login">Login</button>
                <button class="register">Register</button>
            `;
            
            // 重新绑定登录注册按钮事件
            document.querySelector('.login')?.addEventListener('click', () => {
                loginModal.style.display = 'block';
            });
            
            document.querySelector('.register')?.addEventListener('click', () => {
                registerModal.style.display = 'block';
            });
        }
    }

    // 初始化UI
    updateAuthUI();

    // 模态框相关事件处理
    loginBtn?.addEventListener('click', () => {
        loginModal.style.display = 'block';
    });

    registerBtn?.addEventListener('click', () => {
        registerModal.style.display = 'block';
    });

    closeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            loginModal.style.display = 'none';
            registerModal.style.display = 'none';
        });
    });

    showRegisterLink?.addEventListener('click', (e) => {
        e.preventDefault();
        loginModal.style.display = 'none';
        registerModal.style.display = 'block';
    });

    showLoginLink?.addEventListener('click', (e) => {
        e.preventDefault();
        registerModal.style.display = 'none';
        loginModal.style.display = 'block';
    });

    window.addEventListener('click', (e) => {
        if (e.target === loginModal) {
            loginModal.style.display = 'none';
        }
        if (e.target === registerModal) {
            registerModal.style.display = 'none';
        }
    });

    // 订阅按钮处理
    const subscribeButtons = document.querySelectorAll('.subscribe-btn');
    
    subscribeButtons.forEach(button => {
        button.addEventListener('click', async function() {
            const plan = this.getAttribute('data-plan');
            
            if (!isLoggedIn()) {
                showLoginPrompt();
                return;
            }
            
            try {
                const response = await fetch('http://localhost:3000/api/subscribe', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify({ plan })
                });
                
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.error);
                }
                
                showMessage('Subscription successful! Enjoy premium features.', 'success');
                
                // 更新用户订阅状态
                const user = JSON.parse(localStorage.getItem('user'));
                user.hasActiveSubscription = true;
                localStorage.setItem('user', JSON.stringify(user));
                
            } catch (error) {
                showMessage('Subscription failed: ' + error.message, 'error');
            }
        });
    });
    
    // 显示消息提示
    function showMessage(message, type) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.textContent = message;
        
        document.body.appendChild(messageDiv);
        
        setTimeout(() => {
            messageDiv.remove();
        }, 5000);
    }
    
    // 检查订阅状态
    async function checkSubscriptionStatus() {
        if (!isLoggedIn()) return;
        
        try {
            const response = await fetch('http://localhost:3000/api/subscription/status', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error);
            }
            
            // 更新用户订阅状态
            const user = JSON.parse(localStorage.getItem('user'));
            user.hasActiveSubscription = data.hasActiveSubscription;
            localStorage.setItem('user', JSON.stringify(user));
            
        } catch (error) {
            console.error('Failed to check subscription status:', error);
        }
    }
    
    // 登录后检查订阅状态
    if (isLoggedIn()) {
        checkSubscriptionStatus();
    }
});
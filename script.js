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
                <h3>请先登录</h3>
                <p>您需要登录后才能使用此功能</p>
                <button class="prompt-login-btn" style="
                    background: var(--primary-color);
                    color: white;
                    border: none;
                    padding: 0.5rem 2rem;
                    border-radius: 4px;
                    margin-top: 1rem;
                    cursor: pointer;
                ">立即登录</button>
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
            authButtons.innerHTML = `
                <span>欢迎，${user.username}</span>
                <button class="logout">登出</button>
            `;
            
            document.querySelector('.logout').addEventListener('click', () => {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                updateAuthUI();
            });
        } else {
            authButtons.innerHTML = `
                <button class="login">登录</button>
                <button class="register">注册</button>
            `;
            
            // 重新绑定登录注册按钮事件
            document.querySelector('.login').addEventListener('click', () => {
                loginModal.style.display = 'block';
            });
            
            document.querySelector('.register').addEventListener('click', () => {
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
});
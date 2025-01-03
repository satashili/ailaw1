document.addEventListener('DOMContentLoaded', function() {
    const loginModal = document.getElementById('loginModal');
    const registerModal = document.getElementById('registerModal');
    const loginBtn = document.querySelector('.login');
    const registerBtn = document.querySelector('.register');
    const closeBtns = document.querySelectorAll('.close');
    const showRegisterLink = document.getElementById('showRegister');
    const showLoginLink = document.getElementById('showLogin');

    // 打开登录模态框
    loginBtn.addEventListener('click', () => {
        loginModal.style.display = 'block';
    });

    // 打开注册模态框
    registerBtn.addEventListener('click', () => {
        registerModal.style.display = 'block';
    });

    // 关闭模态框
    closeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            loginModal.style.display = 'none';
            registerModal.style.display = 'none';
        });
    });

    // 切换到注册表单
    showRegisterLink.addEventListener('click', (e) => {
        e.preventDefault();
        loginModal.style.display = 'none';
        registerModal.style.display = 'block';
    });

    // 切换到登录表单
    showLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        registerModal.style.display = 'none';
        loginModal.style.display = 'block';
    });

    // 点击模态框外部关闭
    window.addEventListener('click', (e) => {
        if (e.target === loginModal) {
            loginModal.style.display = 'none';
        }
        if (e.target === registerModal) {
            registerModal.style.display = 'none';
        }
    });

    // 处理表单提交
    document.getElementById('loginForm').addEventListener('submit', (e) => {
        e.preventDefault();
        // 在这里添加登录逻辑
        console.log('登录表单提交');
    });

    document.getElementById('registerForm').addEventListener('submit', (e) => {
        e.preventDefault();
        // 在这里添加注册逻辑
        console.log('注册表单提交');
    });
}); 
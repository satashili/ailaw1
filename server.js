const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const app = express();

app.use(cors());
app.use(express.json());

const SECRET_KEY = 'skfsfjsdfsd';

// 连接MongoDB数据库
mongoose.connect('mongodb://localhost:27017/contract_assistant', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('MongoDB连接成功');
}).catch((err) => {
    console.error('MongoDB连接失败:', err);
});

// 定义用户模型
const userSchema = new mongoose.Schema({
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// 注册接口
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        // 检查用户是否已存在
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: '该邮箱已被注册' });
        }

        // 加密密码
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // 创建新用户
        const user = new User({
            username,
            email,
            password: hashedPassword
        });
        
        await user.save();

        // 生成 token
        const token = jwt.sign({ userId: user._id }, SECRET_KEY, { expiresIn: '24h' });
        
        res.json({ 
            token, 
            user: { 
                id: user._id, 
                username: user.username, 
                email: user.email 
            } 
        });
    } catch (error) {
        console.error('注册错误:', error);
        res.status(500).json({ error: '服务器错误' });
    }
});

// 登录接口
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // 查找用户
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ error: '用户不存在' });
        }

        // 验证密码
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).json({ error: '密码错误' });
        }

        // 生成 token
        const token = jwt.sign({ userId: user._id }, SECRET_KEY, { expiresIn: '24h' });
        
        res.json({ 
            token, 
            user: { 
                id: user._id, 
                username: user.username, 
                email: user.email 
            } 
        });
    } catch (error) {
        console.error('登录错误:', error);
        res.status(500).json({ error: '服务器错误' });
    }
});

app.listen(3000, () => {
    console.log('Server running on port 3000');
}); 
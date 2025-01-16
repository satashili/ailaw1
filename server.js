require('dotenv').config();

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const OpenAI = require('openai');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('.')); // 将当前目录作为静态文件目录

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

// 初始化 OpenAI 客户端
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: 'https://api.deepseek.com' // 可选的自定义端点
});

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

// 验证 token 的中间件
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: '未提供认证令牌' });
    }

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) {
            return res.status(403).json({ error: '无效的令牌' });
        }
        req.user = user;
        next();
    });
};

// 合同分析接口
app.post('/api/analyze', authenticateToken, async (req, res) => {
    try {
        const { content, position } = req.body;
        
        // 根据不同立场设置不同的提示词
        let prompt = '';
        switch(position) {
            case '甲方立场':
                prompt = `作为合同甲方的法律顾问，请分析以下合同内容，重点关注保护甲方权益的角度，指出可能存在的风险，并给出具体的修改建议：\n\n${content}`;
                break;
            case '乙方立场':
                prompt = `作为合同乙方的法律顾问，请分析以下合同内容，重点关注保护乙方权益的角度，指出可能存在的风险，并给出具体的修改建议：\n\n${content}`;
                break;
            case '中立立场':
                prompt = `请以中立的立场分析以下合同内容，确保合同条款公平合理，同时为双方提供平衡的建议：\n\n${content}`;
                break;
            default:
                throw new Error('无效的立场选择');
        }

        // 调用 DeepSeek API
        const completion = await openai.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: "你是一位专业的法律顾问，擅长合同分析和风险评估。请用中文回复，并按照以下格式组织回答：\n1. 主要风险点\n2. 具体分析\n3. 修改建议"
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            model: "deepseek-chat", // 修改为 DeepSeek 支持的模型名称
            temperature: 0.7,
            max_tokens: 2000
        });

        // 返回分析结果
        res.json({
            analysis: completion.choices[0].message.content
        });
    } catch (error) {
        console.error('分析错误:', error);
        res.status(500).json({ error: '服务器错误: ' + error.message });
    }
});

app.listen(3000, () => {
    console.log('Server running on port 3000');
}); 
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
            return res.status(400).json({ error: 'Email already registered' });
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
            return res.status(400).json({ error: 'User does not exist' });
        }

        // 验证密码
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).json({ error: 'Incorrect password' });
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
            case 'Party A':
                prompt = `As a professional legal advisor, you are reviewing a contract for Party A (the initiator/principal). Please analyze the following contract content from the perspective of protecting Party A's interests:

${content}

Please strictly follow this format in your response:

1. Key Risk Points:
   - List clauses that are most unfavorable to Party A
   - Identify potential liability risks and insufficient protection of rights
   - Point out areas where Party A's interests might be compromised

2. Detailed Analysis:
   - Explain the potential adverse impacts of each risk point on Party A
   - Analyze unequal stipulations of rights and obligations
   - Evaluate the reasonableness of liability provisions

3. Modification Suggestions:
   - Provide specific revision suggestions for each risk point
   - Recommend additional protective clauses
   - Suggest how to strengthen Party A's position in the contract

Please ensure comprehensive analysis with a focus on protecting Party A's interests.`;
                break;

            case 'Party B':
                prompt = `As a professional legal advisor, you are reviewing a contract for Party B (the recipient/contractor). Please analyze the following contract content from the perspective of protecting Party B's interests:

${content}

Please strictly follow this format in your response:

1. Key Risk Points:
   - List clauses that are most unfavorable to Party B
   - Identify excessive obligations or insufficient protection
   - Detect potential contractual traps

2. Detailed Analysis:
   - Explain the potential adverse impacts of each risk point on Party B
   - Analyze unequal stipulations of rights and obligations
   - Evaluate the fairness of liability provisions

3. Modification Suggestions:
   - Provide specific revision suggestions for each risk point
   - Recommend liability limitation or exemption clauses
   - Suggest how to balance rights and obligations

Please ensure comprehensive analysis with a focus on protecting Party B's interests.`;
                break;

            case 'Neutral':
                prompt = `As an impartial legal advisor, please analyze the following contract content from a neutral perspective to ensure fair treatment of both parties:

${content}

Please strictly follow this format in your response:

1. Key Risk Points:
   - Identify clauses that may be unfair to either party
   - Point out ambiguous terms that could lead to disputes
   - Highlight potential legal compliance issues

2. Detailed Analysis:
   - Explain how each clause affects both parties' interests
   - Evaluate the overall fairness and reasonableness
   - Assess the enforceability and legal validity

3. Modification Suggestions:
   - Provide balanced revision suggestions for each issue
   - Recommend additional clauses for clarity
   - Suggest how to make the contract more fair and executable

Please ensure objective analysis to help both parties achieve a mutually beneficial agreement.`;
                break;

            default:
                throw new Error('Invalid perspective selection');
        }

        // 调用 DeepSeek API
        const completion = await openai.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: "你是一位专业的法律顾问，擅长合同分析和风险评估。请用英文回复，并按照以下格式组织回答：\n1. 主要风险点\n2. 具体分析\n3. 修改建议"
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
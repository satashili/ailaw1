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
    createdAt: { type: Date, default: Date.now },
    hasActiveSubscription: { type: Boolean, default: false },
    freeTrialsRemaining: { type: Number, default: 10 } // 添加10次免费试用机会
});

const User = mongoose.model('User', userSchema);

// 定义订阅模型
const subscriptionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    plan: { type: String, required: true, enum: ['monthly', 'yearly'] },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date, required: true },
    active: { type: Boolean, default: true }
});

const Subscription = mongoose.model('Subscription', subscriptionSchema);

// 初始化 OpenAI 客户端
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: 'https://api.deepseek.com' // 可选的自定义端点
});

// 检测内容语言
function detectLanguage(text) {
    // 简单检测是否包含中文字符
    const chinesePattern = /[\u4e00-\u9fa5]/g;
    const chineseChars = text.match(chinesePattern);
    
    if (chineseChars && chineseChars.length > text.length * 0.1) {
        return 'zh';
    }
    
    return 'en';
}

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
        // 获取用户信息
        const user = await User.findById(req.user.userId);
        
        // 检查用户是否有活跃订阅或免费试用次数
        if (!user.hasActiveSubscription && user.freeTrialsRemaining <= 0) {
            return res.status(403).json({ 
                error: '您已用完免费试用次数，请订阅以继续使用',
                freeTrialsRemaining: 0
            });
        }
        
        const { content, position } = req.body;
        
        // 如果用户没有活跃订阅但有免费试用次数，减少试用次数
        if (!user.hasActiveSubscription && user.freeTrialsRemaining > 0) {
            user.freeTrialsRemaining -= 1;
            await user.save();
        }
        
        // 设置响应头，支持流式传输
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // 根据不同立场设置不同的提示词
        let prompt = '';
        const language = detectLanguage(content);
        const isChineseContent = language === 'zh';

        switch(position) {
            case 'Party A':
                prompt = isChineseContent ? 
                    `作为专业法律顾问，您正在为甲方（发起方/委托方）审查合同。请从保护甲方利益的角度分析以下合同内容：

${content}

请严格按照以下格式回复：

1. 主要风险点：
   - 列出对甲方最不利的条款
   - 识别潜在的责任风险和权利保护不足之处
   - 指出可能损害甲方利益的领域

2. 详细分析：
   - 解释每个风险点对甲方的潜在不利影响
   - 分析权利和义务的不平等规定
   - 评估责任条款的合理性

3. 修改建议：
   - 为每个风险点提供具体的修改建议
   - 推荐额外的保护条款
   - 建议如何加强甲方在合同中的地位

请确保全面分析，重点关注保护甲方利益。` :
                    `As a professional legal advisor, you are reviewing a contract for Party A (the initiator/principal). Please analyze the following contract content from the perspective of protecting Party A's interests:

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

        // 修改为流式调用
        const stream = await openai.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: isChineseContent ? 
                        "你是一位专业的法律顾问，擅长合同分析和风险评估。请按照用户要求的格式组织回答。" :
                        "You are a professional legal advisor specializing in contract analysis and risk assessment. Please organize your response according to the requested format."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            model: "deepseek-chat",
            temperature: 0.7,
            max_tokens: 2000,
            stream: true  // 启用流式输出
        });

        // 逐块发送响应
        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
                res.write(`data: ${JSON.stringify({ content })}\n\n`);
            }
        }

        // 在分析完成后，发送剩余试用次数信息
        if (!user.hasActiveSubscription) {
            res.write(`data: ${JSON.stringify({ 
                freeTrialsRemaining: user.freeTrialsRemaining,
                isTrialUsage: true
            })}\n\n`);
        }

        res.write('data: [DONE]\n\n');
        res.end();

    } catch (error) {
        console.error('分析错误:', error);
        res.write(`data: ${JSON.stringify({ error: '服务器错误: ' + error.message })}\n\n`);
        res.end();
    }
});

// 处理支付接口
app.post('/api/subscribe', authenticateToken, async (req, res) => {
    try {
        const { plan } = req.body;
        const userId = req.user.userId;
        
        // 计算订阅结束日期
        const startDate = new Date();
        const endDate = new Date();
        
        if (plan === 'monthly') {
            endDate.setMonth(endDate.getMonth() + 1);
        } else if (plan === 'yearly') {
            endDate.setFullYear(endDate.getFullYear() + 1);
        } else {
            return res.status(400).json({ error: '无效的订阅计划' });
        }
        
        // 创建新订阅
        const subscription = new Subscription({
            userId,
            plan,
            startDate,
            endDate,
            active: true
        });
        
        await subscription.save();
        
        // 更新用户订阅状态
        await User.findByIdAndUpdate(userId, { hasActiveSubscription: true });
        
        res.json({ 
            success: true, 
            subscription: {
                plan,
                startDate,
                endDate
            }
        });
    } catch (error) {
        console.error('订阅错误:', error);
        res.status(500).json({ error: '服务器错误' });
    }
});

// 检查订阅状态
app.get('/api/subscription/status', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        
        // 查找用户的活跃订阅
        const subscription = await Subscription.findOne({
            userId,
            active: true,
            endDate: { $gt: new Date() }
        });
        
        if (subscription) {
            res.json({
                hasActiveSubscription: true,
                subscription: {
                    plan: subscription.plan,
                    startDate: subscription.startDate,
                    endDate: subscription.endDate
                }
            });
        } else {
            // 如果没有活跃订阅，更新用户状态
            await User.findByIdAndUpdate(userId, { hasActiveSubscription: false });
            res.json({ hasActiveSubscription: false });
        }
    } catch (error) {
        console.error('获取订阅状态错误:', error);
        res.status(500).json({ error: '服务器错误' });
    }
});

// 添加获取用户信息的接口，包括免费试用次数
app.get('/api/user/info', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }
        
        res.json({
            id: user._id,
            username: user.username,
            email: user.email,
            hasActiveSubscription: user.hasActiveSubscription,
            freeTrialsRemaining: user.freeTrialsRemaining
        });
    } catch (error) {
        console.error('获取用户信息错误:', error);
        res.status(500).json({ error: '服务器错误' });
    }
});

app.listen(3000, () => {
    console.log('Server running on port 3000');
}); 
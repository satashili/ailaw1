document.addEventListener('DOMContentLoaded', function() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const positionSpan = document.getElementById('currentPosition');
    const resultDiv = document.querySelector('.analysis-result');
    const resultContent = document.querySelector('.result-content');
    
    // 添加一个队列来管理打字效果
    const typingQueue = [];
    let isTyping = false;
    
    // 处理打字队列的函数
    function processTypingQueue() {
        if (typingQueue.length === 0 || isTyping) {
            return;
        }
        
        isTyping = true;
        const content = typingQueue.shift();
        let index = 0;
        
        function typeNextChar() {
            if (index < content.length) {
                resultContent.textContent += content[index];
                // 自动滚动到底部
                resultContent.scrollTop = resultContent.scrollHeight;
                index++;
                
                // 根据字符类型添加不同的延迟，使打字效果更自然
                let delay = 15; // 基础延迟
                
                // 如果是标点符号，增加延迟
                if (['.', '!', '?', '。', '！', '？', '，', ',', ':', '：', ';', '；'].includes(content[index - 1])) {
                    delay = 100; // 标点符号后停顿更长
                } else if (['\n', '\r'].includes(content[index - 1])) {
                    delay = 150; // 换行后停顿更长
                } else {
                    // 添加一些随机性
                    delay += Math.random() * 20;
                }
                
                setTimeout(typeNextChar, delay);
            } else {
                isTyping = false;
                processTypingQueue(); // 处理队列中的下一项
            }
        }
        
        typeNextChar();
    }

    // Display the selected perspective
    const selectedPosition = sessionStorage.getItem('selectedPosition');
    positionSpan.textContent = selectedPosition || 'Not selected';

    // Handle file drag and drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#6c5ce7';
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '';
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '';
        const files = e.dataTransfer.files;
        if (files.length) {
            handleFile(files[0]);
        }
    });

    // Handle click to upload
    dropZone.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
            handleFile(e.target.files[0]);
        }
    });

    async function handleFile(file) {
        try {
            // 检查文件类型
            const isWordDocument = file.name.endsWith('.docx') || file.name.endsWith('.doc') || 
                                  file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                                  file.type === 'application/msword';
            
            const isPdfDocument = file.name.endsWith('.pdf') || file.type === 'application/pdf';
            
            let content;
            let displayContent;
            
            if (isWordDocument) {
                // 处理Word文档
                content = await readWordDocument(file);
                displayContent = content.html;
                content = content.text; // 用于分析的纯文本内容
            } else if (isPdfDocument) {
                // 处理PDF文档
                content = await readFile(file);
                // 转义HTML并保留格式
                displayContent = `<pre>${escapeHtml(content)}</pre>`;
            } else {
                // 处理其他文件
                content = await readFile(file);
                
                // 检查是否是可能的二进制内容
                if (isBinaryContent(content)) {
                    displayContent = '<p>此文件可能包含二进制内容，无法正确显示</p>';
                } else {
                    // 转义HTML并保留格式
                    displayContent = `<pre>${escapeHtml(content)}</pre>`;
                }
            }
            
            // 显示结果区域
            resultDiv.style.display = 'block';
            
            // 创建文件内容显示区域
            const fileContentDiv = document.createElement('div');
            fileContentDiv.className = 'file-content';
            
            if (isWordDocument) {
                fileContentDiv.innerHTML = `
                    <h3>Word文档内容</h3>
                    <div class="content-display word-content">${displayContent}</div>
                `;
            } else if (isPdfDocument) {
                fileContentDiv.innerHTML = `
                    <h3>PDF文档内容</h3>
                    <div class="content-display pdf-content">${displayContent}</div>
                `;
            } else if (file.type.includes('image') || 
                      file.type.includes('audio') || file.type.includes('video') || 
                      file.type.includes('application/octet-stream') || isBinaryContent(content)) {
                // 二进制文件显示文件信息而不是内容
                fileContentDiv.innerHTML = `
                    <h3>文件信息</h3>
                    <div class="file-info">
                        <p><strong>文件名:</strong> ${file.name}</p>
                        <p><strong>文件类型:</strong> ${file.type || '未知'}</p>
                        <p><strong>文件大小:</strong> ${formatFileSize(file.size)}</p>
                        <p>二进制文件内容不显示，仅进行分析</p>
                    </div>
                `;
            } else {
                // 文本文件显示内容
                fileContentDiv.innerHTML = `
                    <h3>文件内容</h3>
                    <div class="content-display">${displayContent}</div>
                `;
            }
            
            // 清空之前的内容并添加文件内容显示
            resultContent.textContent = '';
            resultDiv.insertBefore(fileContentDiv, resultContent);
            
            const position = sessionStorage.getItem('selectedPosition');
            // 分析合同
            await analyzeContract(content, position);
        } catch (error) {
            console.error('处理文件错误:', error);
            alert('处理文件时出错: ' + error.message);
        }
    }

    function readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            // 检查文件类型
            if (file.type.includes('pdf')) {
                // PDF文件处理
                reader.onload = async (e) => {
                    try {
                        const pdfData = new Uint8Array(e.target.result);
                        const pdfText = await extractTextFromPdf(pdfData);
                        resolve(pdfText);
                    } catch (error) {
                        console.error('PDF处理错误:', error);
                        alert('PDF处理错误: ' + error.message);
                        reject(error);
                    }
                };
                reader.onerror = (e) => reject(new Error('Failed to read PDF file'));
                reader.readAsArrayBuffer(file);
            } else {
                // 文本文件尝试使用UTF-8编码读取
                reader.onload = (e) => {
                    let content = e.target.result;
                    
                    // 检测是否包含乱码（简单检测）
                    if (containsGarbledText(content)) {
                        // 如果检测到乱码，尝试使用其他编码重新读取
                        const reader2 = new FileReader();
                        reader2.onload = (e2) => {
                            try {
                                // 尝试使用TextDecoder解码
                                const buffer = e2.target.result;
                                // 尝试不同的编码
                                const encodings = ['gbk', 'gb18030', 'big5', 'shift-jis'];
                                
                                for (const encoding of encodings) {
                                    try {
                                        const decoder = new TextDecoder(encoding);
                                        const decodedContent = decoder.decode(buffer);
                                        if (!containsGarbledText(decodedContent)) {
                                            resolve(decodedContent);
                                            return;
                                        }
                                    } catch (err) {
                                        console.log(`尝试使用${encoding}解码失败:`, err);
                                    }
                                }
                                
                                // 如果所有编码都失败，返回原始内容
                                resolve(content);
                            } catch (decodeError) {
                                console.error('解码失败:', decodeError);
                                resolve(content); // 返回原始内容
                            }
                        };
                        reader2.onerror = (e) => reject(new Error('Failed to read file with alternative encoding'));
                        reader2.readAsArrayBuffer(file);
                    } else {
                        resolve(content);
                    }
                };
                reader.onerror = (e) => reject(new Error('Failed to read file'));
                reader.readAsText(file, 'UTF-8');
            }
        });
    }

    // 从PDF中提取文本
    async function extractTextFromPdf(pdfData) {
        try {
            // 加载PDF文档
            const loadingTask = pdfjsLib.getDocument({ data: pdfData });
            const pdf = await loadingTask.promise;
            
            let fullText = '';
            
            // 遍历每一页并提取文本
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const textItems = textContent.items;
                
                // 将文本项合并成页面文本
                let pageText = '';
                let lastY = null;
                
                for (const item of textItems) {
                    // 检查是否需要添加换行（如果Y坐标变化较大）
                    if (lastY !== null && Math.abs(lastY - item.transform[5]) > 5) {
                        pageText += '\n';
                    }
                    
                    pageText += item.str;
                    lastY = item.transform[5];
                }
                
                fullText += pageText + '\n\n';
            }
            
            return fullText;
        } catch (error) {
            console.error('PDF文本提取错误:', error);
            throw new Error('无法从PDF中提取文本: ' + error.message);
        }
    }

    // 简单检测文本是否包含乱码
    function containsGarbledText(text) {
        // 检查是否包含常见的乱码字符组合
        const garbledPatterns = [
            //g,                    // 替换字符
            /[\uFFFD\uFFFE\uFFFF]/g, // Unicode替换字符
            /(\u0000|\u0001)/g,      // 控制字符
        ];
        
        for (const pattern of garbledPatterns) {
            if (pattern.test(text)) {
                return true;
            }
        }
        
        // 检查中文内容是否正常
        const chinesePattern = /[\u4e00-\u9fa5]/g;
        const chineseChars = text.match(chinesePattern);
        
        // 如果文件中应该有中文（基于文件名判断），但没有找到中文字符
        if (chineseChars === null && /[\u4e00-\u9fa5]/.test(file.name)) {
            return true;
        }
        
        return false;
    }

    // 格式化文件大小
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // 检查内容是否可能是二进制
    function isBinaryContent(content) {
        // 检查是否包含大量不可打印字符
        const nonPrintableChars = content.match(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g);
        if (nonPrintableChars && nonPrintableChars.length > content.length * 0.1) {
            return true;
        }
        
        // 检查是否包含常见的二进制文件头标记
        const binaryHeaders = [
            'PK\x03\x04',     // ZIP
            '\x25\x50\x44\x46', // PDF
            '\x89\x50\x4E\x47', // PNG
            '\xFF\xD8\xFF',    // JPEG
            '\x47\x49\x46\x38', // GIF
        ];
        
        for (const header of binaryHeaders) {
            if (content.startsWith(header)) {
                return true;
            }
        }
        
        return false;
    }

    async function analyzeContract(content, position) {
        try {
            console.log('Starting analysis, position:', position);
            console.log('Token:', localStorage.getItem('token'));
            
            // 获取用户信息
            const user = JSON.parse(localStorage.getItem('user'));
            
            // 确保结果区域可见
            resultDiv.style.display = 'block';
            
            // 清空之前的分析结果内容，但保留文件内容显示
            const fileContent = document.querySelector('.file-content');
            if (fileContent) {
                // 保留文件内容显示
            } else {
                resultContent.textContent = ''; // 清空之前的内容
            }
            
            // 添加加载指示器
            const loadingIndicator = document.createElement('div');
            loadingIndicator.className = 'loading-indicator';
            loadingIndicator.innerHTML = `
                <div class="loading-spinner"></div>
                <p>分析中，请稍候...</p>
            `;
            resultDiv.appendChild(loadingIndicator);
            
            // 如果用户没有订阅且没有免费试用次数，显示订阅提示
            if (!user.hasActiveSubscription && user.freeTrialsRemaining <= 0) {
                resultDiv.removeChild(loadingIndicator); // 移除加载指示器
                showSubscriptionPrompt();
                return;
            }
            
            // 如果是免费试用，显示试用信息
            if (!user.hasActiveSubscription && user.freeTrialsRemaining > 0) {
                const trialInfo = document.createElement('div');
                trialInfo.className = 'trial-info';
                trialInfo.innerHTML = `
                    <div class="trial-banner">
                        <span>Free Trial - ${user.freeTrialsRemaining} uses remaining</span>
                        <button class="upgrade-btn">Upgrade to Premium</button>
                    </div>
                `;
                resultDiv.prepend(trialInfo);
                
                // 添加升级按钮事件
                trialInfo.querySelector('.upgrade-btn').addEventListener('click', () => {
                    showSubscriptionPrompt();
                });
            }
            
            const response = await fetch('http://localhost:3000/api/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    content,
                    position
                })
            });

            // 处理流式响应
            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') break;
                        
                        try {
                            const parsedData = JSON.parse(data);
                            
                            // 处理内容更新
                            if (parsedData.content) {
                                // 收到第一个内容时，移除加载指示器
                                const loadingIndicator = document.querySelector('.loading-indicator');
                                if (loadingIndicator && loadingIndicator.parentNode) {
                                    loadingIndicator.parentNode.removeChild(loadingIndicator);
                                }
                                
                                // 将内容添加到打字队列
                                typingQueue.push(parsedData.content);
                                // 如果当前没有打字效果在进行，则开始处理队列
                                processTypingQueue();
                            }
                            
                            // 处理免费试用信息更新
                            if (parsedData.isTrialUsage && parsedData.freeTrialsRemaining !== undefined) {
                                // 更新用户信息
                                const user = JSON.parse(localStorage.getItem('user'));
                                user.freeTrialsRemaining = parsedData.freeTrialsRemaining;
                                localStorage.setItem('user', JSON.stringify(user));
                                
                                // 更新试用信息显示
                                const trialBanner = document.querySelector('.trial-banner span');
                                if (trialBanner) {
                                    trialBanner.textContent = `Free Trial - ${parsedData.freeTrialsRemaining} uses remaining`;
                                }
                            }
                            
                            // 处理错误
                            if (parsedData.error) {
                                throw new Error(parsedData.error);
                            }
                        } catch (e) {
                            console.error('Error parsing chunk:', e);
                        }
                    }
                }
            }

        } catch (error) {
            console.error('Error during analysis:', error);
            resultContent.textContent = `Error: ${error.message}`;
        }
    }

    // 显示订阅提示
    function showSubscriptionPrompt() {
        const prompt = document.createElement('div');
        prompt.className = 'subscription-prompt';
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
            <div class="subscription-prompt-content" style="
                background: white;
                padding: 2rem;
                border-radius: 8px;
                text-align: center;
                max-width: 500px;
            ">
                <h3>Premium Feature</h3>
                <p>Contract analysis requires an active subscription</p>
                <div style="margin: 1.5rem 0;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 1rem;">
                        <div style="text-align: left;">
                            <h4>Monthly Plan</h4>
                            <p>$5/month</p>
                        </div>
                        <button class="prompt-subscribe-btn" data-plan="monthly" style="
                            background: var(--primary-color);
                            color: white;
                            border: none;
                            padding: 0.5rem 1rem;
                            border-radius: 4px;
                            cursor: pointer;
                        ">Subscribe</button>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <div style="text-align: left;">
                            <h4>Yearly Plan (Best Value)</h4>
                            <p>$20/year (Save 67%)</p>
                        </div>
                        <button class="prompt-subscribe-btn" data-plan="yearly" style="
                            background: var(--primary-color);
                            color: white;
                            border: none;
                            padding: 0.5rem 1rem;
                            border-radius: 4px;
                            cursor: pointer;
                        ">Subscribe</button>
                    </div>
                </div>
                <button class="prompt-close-btn" style="
                    background: transparent;
                    color: #666;
                    border: 1px solid #ddd;
                    padding: 0.5rem 2rem;
                    border-radius: 4px;
                    cursor: pointer;
                ">Cancel</button>
            </div>
        `;
        
        document.body.appendChild(prompt);
        
        // 订阅按钮事件
        prompt.querySelectorAll('.prompt-subscribe-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const plan = btn.getAttribute('data-plan');
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
                    
                    // 更新用户订阅状态
                    const user = JSON.parse(localStorage.getItem('user'));
                    user.hasActiveSubscription = true;
                    localStorage.setItem('user', JSON.stringify(user));
                    
                    // 关闭提示并重新分析
                    prompt.remove();
                    alert('Subscription successful! You can now use premium features.');
                    
                    // 重新触发分析
                    const fileInput = document.getElementById('fileInput');
                    if (fileInput.files.length) {
                        handleFile(fileInput.files[0]);
                    }
                    
                } catch (error) {
                    alert('Subscription failed: ' + error.message);
                }
            });
        });
        
        // 关闭按钮事件
        prompt.querySelector('.prompt-close-btn').addEventListener('click', () => {
            prompt.remove();
        });
        
        // 点击背景关闭
        prompt.addEventListener('click', (e) => {
            if (e.target === prompt) {
                prompt.remove();
            }
        });
    }

    // 辅助函数：转义HTML特殊字符，防止XSS攻击
    function escapeHtml(text) {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;")
            .replace(/\n/g, "<br>")
            .replace(/\s{2,}/g, function(match) {
                return '&nbsp;'.repeat(match.length);
            });
    }

    // 读取Word文档
    function readWordDocument(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = function(event) {
                const arrayBuffer = event.target.result;
                
                // 使用mammoth.js转换Word文档为HTML
                mammoth.convertToHtml({arrayBuffer: arrayBuffer})
                    .then(function(result) {
                        // 获取HTML内容
                        const html = result.value;
                        // 获取警告信息
                        const warnings = result.messages;
                        if (warnings.length > 0) {
                            console.warn('Word转换警告:', warnings);
                        }
                        
                        // 使用mammoth.js提取纯文本
                        mammoth.extractRawText({arrayBuffer: arrayBuffer})
                            .then(function(textResult) {
                                resolve({
                                    html: html,
                                    text: textResult.value
                                });
                            })
                            .catch(function(error) {
                                console.error('提取文本错误:', error);
                                // 如果提取纯文本失败，尝试从HTML中提取
                                const tempDiv = document.createElement('div');
                                tempDiv.innerHTML = html;
                                const text = tempDiv.textContent || tempDiv.innerText || '';
                                resolve({
                                    html: html,
                                    text: text
                                });
                            });
                    })
                    .catch(function(error) {
                        console.error('Word转换错误:', error);
                        reject(new Error('无法解析Word文档: ' + error.message));
                    });
            };
            reader.onerror = function(error) {
                reject(new Error('读取文件失败: ' + error.message));
            };
            reader.readAsArrayBuffer(file);
        });
    }
}); 
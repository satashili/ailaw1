document.addEventListener('DOMContentLoaded', function() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const positionSpan = document.getElementById('currentPosition');
    const resultDiv = document.querySelector('.analysis-result');
    const resultContent = document.querySelector('.result-content');

    // 显示选择的立场
    const selectedPosition = sessionStorage.getItem('selectedPosition');
    positionSpan.textContent = selectedPosition || '未选择';

    // 处理文件拖放
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

    // 处理点击上传
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
            const content = await readFile(file);
            const position = sessionStorage.getItem('selectedPosition');
            const analysis = await analyzeContract(content, position);
            
            resultDiv.style.display = 'block';
            resultContent.textContent = analysis;
        } catch (error) {
            alert('处理文件时发生错误：' + error.message);
        }
    }

    function readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('读取文件失败'));
            reader.readAsText(file);
        });
    }

    async function analyzeContract(content, position) {
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

        if (!response.ok) {
            throw new Error('分析请求失败');
        }

        const data = await response.json();
        return data.analysis;
    }
}); 
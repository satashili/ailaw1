document.addEventListener('DOMContentLoaded', function() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const positionSpan = document.getElementById('currentPosition');
    const resultDiv = document.querySelector('.analysis-result');
    const resultContent = document.querySelector('.result-content');

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

            const content = await readFile(file);
            const position = sessionStorage.getItem('selectedPosition');
            const analysis = await analyzeContract(content, position);
            
            resultDiv.style.display = 'block';
            resultContent.textContent = analysis;
        } catch (error) {
            alert('Error processing file: ' + error.message);
        }
    }

    function readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    async function analyzeContract(content, position) {
        try {
            console.log('Starting analysis, position:', position);
            console.log('Token:', localStorage.getItem('token'));
            
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

            console.log('Server response status:', response.status);
            const data = await response.json();
            console.log('Server response data:', data);
            
            if (!response.ok) {
                throw new Error(data.error || 'Analysis request failed');
            }

            return data.analysis;
        } catch (error) {
            console.error('Error during analysis:', error);
            throw error;
        }
    }
}); 
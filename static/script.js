document.addEventListener('DOMContentLoaded', () => {
    // --- Elements ---
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    const imagePreview = document.getElementById('imagePreview');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const textInput = document.getElementById('textInput');
    const resultSection = document.getElementById('resultSection');
    const loadingState = document.getElementById('loadingState');
    const resultsContent = document.getElementById('resultsContent');
    const aiStatus = document.getElementById('aiStatus');
    const aiStatusIndicator = aiStatus.querySelector('.status-indicator');
    const aiStatusText = aiStatus.querySelector('.status-text');
    const modelSelect = document.getElementById('modelSelect');
    const usedModelBadge = document.getElementById('usedModelBadge');

    // New Elements
    const suspectedAiName = document.getElementById('suspectedAiName');
    const suspectedConfidence = document.getElementById('suspectedConfidence');
    const sentencesContainer = document.getElementById('sentencesContainer');
    const sentenceInspector = document.getElementById('sentenceInspector');
    const inspectorBadge = document.getElementById('inspectorBadge');
    const inspectorProb = document.getElementById('inspectorProb');
    const inspectorText = document.getElementById('inspectorText');
    const inspectorReason = document.getElementById('inspectorReason');
    const inspectorGoogleBtn = document.getElementById('inspectorGoogleBtn');
    const closeInspectorBtn = document.getElementById('closeInspectorBtn');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const sourcesList = document.getElementById('sourcesList');

    let currentFile = null;
    let activeTab = 'upload-tab';
    let currentSentences = [];

    // --- 1. Check AI Health ---
    async function checkHealth() {
        try {
            const response = await fetch('/api/health');
            const data = await response.json();
            
            if (response.ok && data.status === 'ok') {
                aiStatusIndicator.className = 'status-indicator active';
                aiStatusText.innerHTML = `<i class="fa-solid fa-circle-check" style="color:var(--success-color)"></i> AI Sẵn sàng (${data.default_model || 'Gemini 3.8'})`;
            } else {
                aiStatusIndicator.className = 'status-indicator error';
                aiStatusText.textContent = data.message || 'Lỗi kết nối';
            }
        } catch (e) {
            aiStatusIndicator.className = 'status-indicator error';
            aiStatusText.textContent = 'Không thể kết nối Server';
        }
    }

    checkHealth();

    // --- 2. Tab Switching ---
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            tab.classList.add('active');
            const target = tab.getAttribute('data-target');
            document.getElementById(target).classList.add('active');
            activeTab = target;
        });
    });

    // --- 3. Upload & Drag Drop ---
    uploadArea.addEventListener('click', () => fileInput.click());

    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = 'var(--primary-color)';
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.style.borderColor = 'rgba(0, 122, 255, 0.35)';
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = 'rgba(0, 122, 255, 0.35)';
        if (e.dataTransfer.files.length > 0) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });

    function handleFile(file) {
        if (!file.type.startsWith('image/')) {
            alert('Vui lòng chọn file hình ảnh hợp lệ (PNG, JPG, WEBP)!');
            return;
        }
        currentFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            imagePreview.style.backgroundImage = `url(${e.target.result})`;
            imagePreview.classList.add('has-image');
        };
        reader.readAsDataURL(file);
    }

    // --- 4. Animate Circular Progress ---
    function animateProgress(elementId, valueId, endValue, color) {
        let current = 0;
        const el = document.getElementById(elementId);
        const valEl = document.getElementById(valueId);
        if (!el || !valEl) return;
        
        endValue = Math.min(100, Math.max(0, parseInt(endValue) || 0));
        if (endValue === 0) {
            valEl.textContent = "0";
            el.style.background = `conic-gradient(${color} 0deg, rgba(0,0,0,0.06) 0deg)`;
            return;
        }

        const timer = setInterval(() => {
            current += 1;
            if (current >= endValue) {
                current = endValue;
                clearInterval(timer);
            }
            valEl.textContent = current;
            el.style.background = `conic-gradient(${color} ${current * 3.6}deg, rgba(0,0,0,0.06) 0deg)`;
        }, 12);
    }

    // --- 5. Render Sentences (Sentence X-Ray) ---
    function renderSentences(sentences, filter = 'all') {
        sentencesContainer.innerHTML = '';
        if (!sentences || sentences.length === 0) {
            sentencesContainer.innerHTML = '<p style="color:var(--text-secondary)">Không trích xuất được từng câu để soi quét.</p>';
            return;
        }

        sentences.forEach((sentence, index) => {
            const isMatch = (filter === 'all') || (sentence.type === filter);
            
            const span = document.createElement('span');
            span.className = `sentence-span type-${sentence.type}`;
            span.textContent = sentence.text + ' ';
            span.dataset.index = index;

            if (!isMatch) {
                span.style.opacity = '0.2';
                span.style.filter = 'grayscale(1)';
            } else {
                span.style.opacity = '1';
                span.style.filter = 'none';
            }

            span.addEventListener('click', () => {
                document.querySelectorAll('.sentence-span').forEach(s => s.classList.remove('active-selected'));
                span.classList.add('active-selected');
                showSentenceInspector(sentence);
            });

            sentencesContainer.appendChild(span);
        });
    }

    function showSentenceInspector(sentence) {
        sentenceInspector.style.display = 'block';
        inspectorText.textContent = `“${sentence.text}”`;

        // Phân loại nhãn
        if (sentence.type === 'ai') {
            const aiLabel = sentence.ai_detected ? `AI (${sentence.ai_detected})` : 'AI Viết';
            inspectorBadge.textContent = aiLabel;
            inspectorBadge.className = 'inspector-badge ai-badge';
        } else if (sentence.type === 'plagiarized') {
            inspectorBadge.textContent = 'Đạo Văn / Trùng Lặp';
            inspectorBadge.className = 'inspector-badge plag-badge';
        } else {
            inspectorBadge.textContent = 'Tự Viết (Human)';
            inspectorBadge.className = 'inspector-badge human-badge';
        }

        inspectorProb.textContent = `Xác suất: ${sentence.probability || 90}%`;
        inspectorReason.innerHTML = `<strong>Nhận định chuyên gia:</strong> ${sentence.reason || 'Dấu hiệu cấu trúc và ngữ nghĩa đặc trưng.'}`;

        // Link Google Search 100% Real
        if (sentence.google_search_url) {
            inspectorGoogleBtn.href = sentence.google_search_url;
            inspectorGoogleBtn.style.display = 'inline-flex';
        } else {
            inspectorGoogleBtn.style.display = 'none';
        }

        sentenceInspector.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    closeInspectorBtn.addEventListener('click', () => {
        sentenceInspector.style.display = 'none';
        document.querySelectorAll('.sentence-span').forEach(s => s.classList.remove('active-selected'));
    });

    // --- 6. Sentence Filters ---
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const filter = btn.dataset.filter;
            renderSentences(currentSentences, filter);
        });
    });

    // --- 7. Analyze Button Event ---
    analyzeBtn.addEventListener('click', async () => {
        let formData = new FormData();

        if (modelSelect && modelSelect.value) {
            formData.append('model_name', modelSelect.value);
        }

        if (activeTab === 'upload-tab') {
            if (!currentFile) {
                alert('Vui lòng chọn hoặc kéo thả một hình ảnh bài văn!');
                return;
            }
            formData.append('file', currentFile);
        } else {
            const text = textInput.value.trim();
            if (!text) {
                alert('Vui lòng dán hoặc nhập văn bản cần quét!');
                return;
            }
            formData.append('text', text);
        }

        resultSection.style.display = 'block';
        loadingState.style.display = 'block';
        resultsContent.style.display = 'none';
        sentenceInspector.style.display = 'none';

        try {
            const response = await fetch('/api/analyze', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (!response.ok || data.error) {
                throw new Error(data.error || 'Có lỗi xảy ra trong quá trình phân tích');
            }

            loadingState.style.display = 'none';
            resultsContent.style.display = 'block';

            // Used Model Badge
            if (usedModelBadge && data.used_model) {
                usedModelBadge.innerHTML = `<i class="fa-solid fa-robot"></i> Đã giám định bởi: <strong>${data.used_model}</strong>`;
            }

            const overall = data.overall || {};

            // Animate 3 circular cards
            animateProgress('aiProgress', 'aiValue', overall.ai_percentage || 0, 'var(--danger-color)');
            animateProgress('plagiarismProgress', 'plagValue', overall.plagiarism_percentage || 0, 'var(--warning-color)');
            animateProgress('humanProgress', 'humanValue', overall.human_percentage || 0, 'var(--success-color)');

            // Suspected AI Card
            if (suspectedAiName) {
                suspectedAiName.textContent = overall.suspected_ai || 'Không xác định rõ';
            }
            if (suspectedConfidence) {
                suspectedConfidence.textContent = `Độ tin cậy giám định: ${overall.confidence || 'Cao'}`;
            }

            // Summary text
            document.getElementById('analysisText').textContent = overall.summary || 'Đã hoàn thành phân tích toàn diện.';

            // Render Sentences (Sentence X-Ray)
            currentSentences = data.sentences || [];
            renderSentences(currentSentences, 'all');

            // Render Sources with 100% Real Links
            sourcesList.innerHTML = '';
            if (data.sources && data.sources.length > 0) {
                data.sources.forEach(src => {
                    const li = document.createElement('li');
                    li.className = 'source-item';
                    li.innerHTML = `
                        <div class="source-meta">
                            <div class="source-title"><i class="fa-solid fa-file-lines"></i> ${src.title || 'Nguồn đối soát'}</div>
                            <div class="source-snippet">${src.snippet ? '“' + src.snippet + '”' : 'Trùng khớp nội dung đối soát.'}</div>
                        </div>
                        <a href="${src.url}" target="_blank" class="source-link-btn">
                            <i class="fa-brands fa-google"></i> Đối soát Google <i class="fa-solid fa-arrow-up-right-from-square"></i>
                        </a>
                    `;
                    sourcesList.appendChild(li);
                });
            } else {
                sourcesList.innerHTML = '<li style="padding:12px;color:var(--text-secondary)">Không phát hiện nguồn sao chép trực tiếp đáng kể từ Internet.</li>';
            }

            resultSection.scrollIntoView({ behavior: 'smooth' });

        } catch (error) {
            loadingState.style.display = 'none';
            alert(error.message);
            resultSection.style.display = 'none';
        }
    });
});

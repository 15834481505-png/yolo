// ★★★ 在文件最顶部添加 ★★★
ort.env.wasm.wasmPaths = 'lib/';// 如果wasm文件在lib目录
ort.env.wasm.numThreads = 1;

class SanghuangDetector {
    constructor() {
        this.model = null;
        this.isModelLoaded = false;
        this.currentImage = null;
        this.currentImageSrc = null;
        this.currentImgSize = 640;
        this.resultCanvas = null;
        this.padX = 0;
        this.padY = 0;
        this.scale = 1;
        this.init();
    }

    async init() {
        this.bindEvents();
        await this.loadModel();
    }

    //============================================
    // ★ 核心：带进度条 +缓存的模型加载
    // ============================================
    async loadModel() {
        const loadingOverlay = document.getElementById('loadingOverlay');
        const loadingText = document.querySelector('.loading-text');
        const loadingHint = document.querySelector('.loading-hint');

        loadingOverlay.style.display = 'flex';

        // ★ 注入进度条 UI
        this.injectProgressBar(loadingOverlay);

        try {
            // 第1步：尝试从IndexedDB 缓存读取
            loadingText.textContent = '检查缓存...';
            let modelBuffer = await this.loadFromCache('sanghuang_model_v1');

            if (modelBuffer) {
                //★ 命中缓存，秒加载！
                console.log('✅ 从缓存加载模型');
                loadingText.textContent = '从缓存加载中...';
                this.updateProgress(100, '从缓存加载，即将完成...');
            } else {
                // ★ 首次加载：带进度条下载
                console.log('⏬ 首次加载，开始下载模型...');
                loadingText.textContent = '首次加载，正在下载模型...';
                modelBuffer = await this.downloadWithProgress('model/model.onnx');

                // ★ 下载完成后存入缓存（下次秒加载）
                loadingText.textContent = '正在缓存模型...';
                await this.saveToCache('sanghuang_model_v1', modelBuffer);
                console.log('✅ 模型已缓存到本地');
            }

            //第2步：用ArrayBuffer 创建推理会话
            loadingText.textContent = '初始化模型引擎...';
            this.updateProgress(100, '初始化推理引擎...');

            this.model = await ort.InferenceSession.create(modelBuffer, {
                executionProviders: ['cpu'],
                graphOptimizationLevel: 'all',});

            this.isModelLoaded = true;
            console.log('✅ 模型加载成功');
            console.log('   输入名:', this.model.inputNames);
            console.log('   输出名:', this.model.outputNames);

        } catch (error) {
            console.error('❌ 模型加载失败:', error);
            loadingText.textContent = '加载失败';
            loadingHint.textContent = error.message;
            loadingHint.style.color = '#ff6b6b';

            // 加载失败则清除可能损坏的缓存
            await this.deleteFromCache('sanghuang_model_v1');

            setTimeout(() => {
                loadingOverlay.style.display = 'none';
            }, 5000);
            return;
        }

        loadingOverlay.style.display = 'none';
    }

    // ============================================
    // ★ 带进度条的下载（关键！）
    // ============================================
    async downloadWithProgress(url) {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`模型文件不存在 (HTTP ${response.status})，请检查路径: ${url}`);
        }

        const contentLength = response.headers.get('content-length');
        const total = parseInt(contentLength, 10);
        let loaded = 0;

        const reader = response.body.getReader();
        const chunks = [];

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            loaded += value.length;
            const progress = Math.round((loaded / total) * 100);
            this.updateProgress(progress, `下载中 ${progress}%`);
        }

        const blob = new Blob(chunks);
        return await blob.arrayBuffer();
    }

    // ============================================
    // ★ 进度条 UI 注入
    // ============================================
    injectProgressBar(container) {
        if (document.getElementById('progressBarContainer')) return;

        const progressContainer = document.createElement('div');
        progressContainer.id = 'progressBarContainer';
        progressContainer.className = 'progress-container';

        const progressBar = document.createElement('div');
        progressBar.id = 'progressBar';
        progressBar.className = 'progress-bar';

        const progressText = document.createElement('div');
        progressText.id = 'progressText';
        progressText.className = 'progress-text';

        progressContainer.appendChild(progressBar);
        progressContainer.appendChild(progressText);
        container.appendChild(progressContainer);
    }

    updateProgress(percent, text) {
        const progressBar = document.getElementById('progressBar');
        const progressText = document.getElementById('progressText');
        if (progressBar && progressText) {
            progressBar.style.width = percent + '%';
            progressText.textContent = text;
        }
    }

    // ============================================
    // ★ 本地缓存管理（IndexedDB）
    // ============================================
    async loadFromCache(key) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('SanghuangDetector', 1);
            request.onerror = () => reject('IndexedDB 打开失败');
            request.onsuccess = (event) => {
                const db = event.target.result;
                const transaction = db.transaction(['models'], 'readonly');
                const store = transaction.objectStore('models');
                const getRequest = store.get(key);
                getRequest.onsuccess = () => resolve(getRequest.result);
                getRequest.onerror = () => resolve(null);
            };
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('models')) {
                    db.createObjectStore('models');
                }
                resolve(null);
            };
        });
    }

    async saveToCache(key, buffer) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('SanghuangDetector', 1);
            request.onerror = () => reject('IndexedDB 打开失败');
            request.onsuccess = (event) => {
                const db = event.target.result;
                const transaction = db.transaction(['models'], 'readwrite');
                const store = transaction.objectStore('models');
                const putRequest = store.put(buffer, key);
                putRequest.onsuccess = () => resolve();
                putRequest.onerror = () => reject('缓存失败');
            };
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('models')) {
                    db.createObjectStore('models');
                }
                resolve();
            };
        });
    }

    async deleteFromCache(key) {
        return new Promise((resolve) => {
            const request = indexedDB.open('SanghuangDetector', 1);
            request.onsuccess = (event) => {
                const db = event.target.result;
                const transaction = db.transaction(['models'], 'readwrite');
                const store = transaction.objectStore('models');
                store.delete(key);
                resolve();
            };
        });
    }

    // ============================================
    // ★ 事件绑定
    // ============================================
    bindEvents() {
        const uploadZone = document.getElementById('uploadZone');
        const fileInput = document.getElementById('fileInput');
        const detectBtn = document.getElementById('detectBtn');
        const exportBtn = document.getElementById('exportBtn');
        const confidenceSlider = document.getElementById('confidence');
        const confidenceValue = document.getElementById('confidenceValue');
        const imageSizeSelect = document.getElementById('imageSize');

        uploadZone.addEventListener('click', () => fileInput.click());
        uploadZone.addEventListener('dragover', (e) => e.preventDefault());
        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            if (e.dataTransfer.files.length > 0) {
                this.handleFile(e.dataTransfer.files[0]);
            }
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFile(e.target.files[0]);
            }
        });

        detectBtn.addEventListener('click', () => this.detect());
        exportBtn.addEventListener('click', () => this.exportResult());

        confidenceSlider.addEventListener('input', (e) => {
            confidenceValue.textContent = (parseInt(e.target.value) / 100).toFixed(2);
            document.getElementById('confidenceDisplay').textContent = (parseInt(e.target.value) / 100).toFixed(2);
        });

        imageSizeSelect.addEventListener('change', (e) => {
            if (e.target.value !== 'auto') {
                this.currentImgSize = parseInt(e.target.value);
            }
        });

        // 图片尺寸转换相关事件
        const resizeUploadZone = document.getElementById('resizeUploadZone');
        const resizeFileInput = document.getElementById('resizeFileInput');
        const resizeBtn = document.getElementById('resizeBtn');
        const downloadResizedBtn = document.getElementById('downloadResizedBtn');

        if (resizeUploadZone) {
            resizeUploadZone.addEventListener('click', () => resizeFileInput.click());
            resizeUploadZone.addEventListener('dragover', (e) => e.preventDefault());
            resizeUploadZone.addEventListener('drop', (e) => {
                e.preventDefault();
                if (e.dataTransfer.files.length > 0) {
                    this.handleResizeFile(e.dataTransfer.files[0]);
                }
            });

            resizeFileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.handleResizeFile(e.target.files[0]);
                }
            });

            if (resizeBtn) {
                resizeBtn.addEventListener('click', () => this.resizeImage());
            }

            if (downloadResizedBtn) {
                downloadResizedBtn.addEventListener('click', () => this.downloadResizedImage());
            }
        }
    }

    async handleFile(file) {
        if (!file.type.startsWith('image/')) {
            alert('请上传图片文件！');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.currentImage = img;
                this.currentImageSrc = e.target.result;
                this.displayImage(img, 'originalImage');
                document.getElementById('detectBtn').disabled = false;
                document.getElementById('exportBtn').disabled = true;
                document.getElementById('imageSizeValue').textContent = `${img.width}x${img.height}`;
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    async handleResizeFile(file) {
        if (!file.type.startsWith('image/')) {
            alert('请上传图片文件！');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.resizeImageElement = img;
                this.resizeImageSrc = e.target.result;
                this.displayImage(img, 'resizePreview');
                document.getElementById('resizeBtn').disabled = false;
                document.getElementById('downloadResizedBtn').disabled = true;
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    displayImage(img, containerId) {
        const container = document.getElementById(containerId);
        container.innerHTML = '';
        const imgElement = document.createElement('img');
        imgElement.src = img.src || this.currentImageSrc;
        imgElement.className = 'uploaded-image';
        imgElement.style.maxWidth = '100%';
        imgElement.style.maxHeight = '300px';
        container.appendChild(imgElement);
    }

    async detect() {
        if (!this.isModelLoaded || !this.currentImage) {
            alert('请先上传图片！');
            return;
        }

        const startTime = performance.now();

        try {
            const inputTensor = await this.preprocessImage(this.currentImage, this.currentImgSize);
            const results = await this.runInference(inputTensor);
            const detections = this.postprocessResults(results);
            
            this.displayResults(detections, this.currentImage);
            
            const endTime = performance.now();
            const detectionTime = Math.round(endTime - startTime);
            document.getElementById('detectionTime').textContent = `${detectionTime}ms`;
            document.getElementById('detectionCount').textContent = detections.length;
            document.getElementById('foundCount').textContent = detections.length;
            document.getElementById('exportBtn').disabled = false;

        } catch (error) {
            console.error('检测失败:', error);
            alert('检测失败，请重试');
        }
    }

    preprocessImage(image, img_size) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img_size;
        canvas.height = img_size;

        const scale = Math.min(img_size / image.width, img_size / image.height);
        const newWidth = Math.round(image.width * scale);
        const newHeight = Math.round(image.height * scale);
        const padX = (img_size - newWidth) / 2;
        const padY = (img_size - newHeight) / 2;

        this.padX = padX;
        this.padY = padY;
        this.scale = scale;

        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, img_size, img_size);
        ctx.drawImage(image, padX, padY, newWidth, newHeight);

        const imageData = ctx.getImageData(0, 0, img_size, img_size);
        const data = imageData.data;
        const inputData = new Float32Array(3 * img_size * img_size);
        const pixelCount = img_size * img_size;

        for (let i = 0, p = 0; i < data.length; i += 4, p++) {
            inputData[p] = data[i] / 255.0;
            inputData[p + pixelCount] = data[i + 1] / 255.0;
            inputData[p + 2 * pixelCount] = data[i + 2] / 255.0;
        }

        return new ort.Tensor('float32', inputData, [1, 3, img_size, img_size]);
    }

    async runInference(inputTensor) {
        let inputName = 'images';
        if (this.model.inputNames && this.model.inputNames.length > 0) {
            inputName = this.model.inputNames[0];
        }
        const feeds = {};
        feeds[inputName] = inputTensor;

        try {
            return await this.model.run(feeds);
        } catch (e) {
            console.warn(`"${inputName}" 失败，尝试 "input"...`);
            return await this.model.run({ input: inputTensor });
        }
    }

    postprocessResults(results) {
        let output, outputShape;
        if (results['output0']) {
            output = results['output0'].data;
            outputShape = results['output0'].dims;
        } else {
            const firstKey = Object.keys(results)[0];
            output = results[firstKey].data;
            outputShape = results[firstKey].dims;
        }

        const numChannels = outputShape[1];
        const numDetections = outputShape[2];
        const numClasses = numChannels - 4;

        const confidenceThreshold = parseFloat(document.getElementById('confidence').value) / 100;
        const detections = [];

        for (let i = 0; i < numDetections; i++) {
            let maxScore = 0;
            let bestClass = 0;
            for (let c = 0; c < numClasses; c++) {
                const score = output[(4 + c) * numDetections + i];
                if (score > maxScore) { maxScore = score; bestClass = c; }
            }
            if (maxScore < confidenceThreshold) continue;

            const cx = output[0 * numDetections + i];
            const cy = output[1 * numDetections + i];
            const w = output[2 * numDetections + i];
            const h = output[3 * numDetections + i];

            detections.push({
                x1: cx - w / 2, y1: cy - h / 2,
                x2: cx + w / 2, y2: cy + h / 2,
                confidence: maxScore, classId: bestClass
            });
        }

        return this.applyNMS(detections, 0.45);
    }

    applyNMS(detections, iouThreshold) {
        detections.sort((a, b) => b.confidence - a.confidence);
        const keep = [];
        const suppressed = new Array(detections.length).fill(false);
        for (let i = 0; i < detections.length; i++) {
            if (suppressed[i]) continue;
            keep.push(detections[i]);
            for (let j = i + 1; j < detections.length; j++) {
                if (!suppressed[j] && this.computeIOU(detections[i], detections[j]) > iouThreshold) {
                    suppressed[j] = true;
                }
            }
        }
        return keep;
    }

    computeIOU(box1, box2) {
        const x1 = Math.max(box1.x1, box2.x1);
        const y1 = Math.max(box1.y1, box2.y1);
        const x2 = Math.min(box1.x2, box2.x2);
        const y2 = Math.min(box1.y2, box2.y2);
        const areaIntersect = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
        const area1 = (box1.x2 - box1.x1) * (box1.y2 - box1.y1);
        const area2 = (box2.x2 - box2.x1) * (box2.y2 - box2.y1);
        return areaIntersect / (area1 + area2 - areaIntersect);
    }

    displayResults(detections, image) {
        const container = document.getElementById('resultImage');
        container.innerHTML = '';

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = image.width;
        canvas.height = image.height;
        ctx.drawImage(image, 0, 0);

        const img_size = this.currentImgSize;
        const scale = this.scale;
        const padX = this.padX;
        const padY = this.padY;

        detections.forEach((det) => {
            const x1 = (det.x1 * img_size - padX) / scale;
            const y1 = (det.y1 * img_size - padY) / scale;
            const x2 = (det.x2 * img_size - padX) / scale;
            const y2 = (det.y2 * img_size - padY) / scale;

            ctx.strokeStyle = '#FF4D4F';
            ctx.lineWidth = 2;
            ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

            ctx.fillStyle = 'rgba(255, 77, 79, 0.7)';
            ctx.font = '12px Arial';
            const label = `桑黄 ${(det.confidence * 100).toFixed(1)}%`;
            const textWidth = ctx.measureText(label).width;
            ctx.fillRect(x1, y1 - 15, textWidth + 8, 15);
            ctx.fillStyle = '#fff';
            ctx.fillText(label, x1 + 4, y1 - 3);
        });

        this.resultCanvas = canvas;
        const imgElement = document.createElement('img');
        imgElement.src = canvas.toDataURL('image/jpeg');
        imgElement.className = 'result-image';
        imgElement.style.maxWidth = '100%';
        imgElement.style.maxHeight = '400px';
        container.appendChild(imgElement);
    }

    exportResult() {
        if (!this.resultCanvas) return;

        const link = document.createElement('a');
        link.download = `sanghuang_detection_${Date.now()}.jpg`;
        link.href = this.resultCanvas.toDataURL('image/jpeg');
        link.click();
    }

    async resizeImage() {
        if (!this.resizeImageElement) {
            alert('请先上传要转换的图片！');
            return;
        }

        const targetSize = parseInt(document.getElementById('resizeTargetSize').value);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = targetSize;
        canvas.height = targetSize;

        const scale = Math.min(targetSize / this.resizeImageElement.width, targetSize / this.resizeImageElement.height);
        const newWidth = Math.round(this.resizeImageElement.width * scale);
        const newHeight = Math.round(this.resizeImageElement.height * scale);
        const padX = (targetSize - newWidth) / 2;
        const padY = (targetSize - newHeight) / 2;

        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, targetSize, targetSize);
        ctx.drawImage(this.resizeImageElement, padX, padY, newWidth, newHeight);

        this.resizedCanvas = canvas;
        const imgElement = document.createElement('img');
        imgElement.src = canvas.toDataURL('image/jpeg');
        imgElement.className = 'resized-image';
        imgElement.style.maxWidth = '100%';
        imgElement.style.maxHeight = '300px';

        const preview = document.getElementById('resizePreview');
        preview.innerHTML = '';
        preview.appendChild(imgElement);

        document.getElementById('downloadResizedBtn').disabled = false;
        alert(`图片已调整为 ${targetSize}x${targetSize} 尺寸`);
    }

    downloadResizedImage() {
        if (!this.resizedCanvas) return;

        const link = document.createElement('a');
        link.download = `resized_${Date.now()}.jpg`;
        link.href = this.resizedCanvas.toDataURL('image/jpeg');
        link.click();
    }
}

// 初始化应用
window.addEventListener('DOMContentLoaded', () => {
    new SanghuangDetector();
});
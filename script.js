/**
 * YouTube学习视频下载器 - 更新的JavaScript文件
 * 连接真实的后端API，实现完整的下载功能
 */

// ====================
// 全局配置和状态管理
// ====================

// 自动检测API base URL - Netlify Functions
const API_BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000/api' 
    : '/.netlify/functions';

const AppState = {
    currentPage: 'download',
    downloads: [],
    history: [],
    settings: {
        downloadPath: '~/Downloads',
        defaultQuality: 'best',
        concurrentDownloads: 3,
        themeMode: 'light',
        enableAnimations: true,
        retryCount: 3,
        historyRetention: 90
    },
    statistics: {
        totalDownloads: 0,
        totalSize: 0,
        thisMonth: 0,
        activeDownloads: 0
    },
    pollingInterval: null
};

// ====================
// API请求工具函数
// ====================

/**
 * 发送API请求
 */
async function apiRequest(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || `HTTP ${response.status}`);
        }
        
        return data;
    } catch (error) {
        console.error('API请求失败:', error);
        throw error;
    }
}

/**
 * 获取视频信息
 */
async function fetchVideoInfo(url) {
    return apiRequest('/video-info', {
        method: 'POST',
        body: JSON.stringify({ url })
    });
}

/**
 * 开始下载
 */
async function startDownloadRequest(url, quality, format) {
    return apiRequest('/download', {
        method: 'POST',
        body: JSON.stringify({ url, quality, format })
    });
}

/**
 * 获取下载任务列表
 */
async function fetchDownloadTasks() {
    return apiRequest('/tasks');
}

/**
 * 取消下载任务
 */
async function cancelDownloadTask(taskId) {
    return apiRequest(`/tasks/${taskId}/cancel`, {
        method: 'POST'
    });
}

/**
 * 获取下载历史
 */
async function fetchDownloadHistory(search = '') {
    const params = search ? `?search=${encodeURIComponent(search)}` : '';
    return apiRequest(`/history${params}`);
}

/**
 * 删除历史记录
 */
async function deleteHistoryItem(historyId) {
    return apiRequest(`/history/${historyId}`, {
        method: 'DELETE'
    });
}

/**
 * 获取统计数据
 */
async function fetchStats() {
    return apiRequest('/stats');
}

// ====================
// 核心工具函数
// ====================

/**
 * 格式化文件大小
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 格式化时间
 */
function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * 显示Toast通知
 */
function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    toast.innerHTML = `
        <div class="toast-header">
            <span class="toast-title">${type.charAt(0).toUpperCase() + type.slice(1)}</span>
            <button class="toast-close" onclick="this.parentElement.parentElement.remove()">
                <i data-feather="x"></i>
            </button>
        </div>
        <div class="toast-message">${message}</div>
    `;
    
    container.appendChild(toast);
    feather.replace();
    
    if (duration > 0) {
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, duration);
    }
}

/**
 * 检查后端服务连接
 */
async function checkServerConnection() {
    try {
        await fetch(`${API_BASE_URL}/stats`);
        return true;
    } catch (error) {
        return false;
    }
}

// ====================
// 页面导航功能
// ====================

/**
 * 显示指定页面
 */
function showPage(pageId) {
    // 更新导航状态
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.tab === pageId) {
            tab.classList.add('active');
        }
    });
    
    // 切换页面内容
    document.querySelectorAll('.page-content').forEach(page => {
        page.classList.remove('active');
    });
    
    const targetPage = document.getElementById(`${pageId}-page`);
    if (targetPage) {
        targetPage.classList.add('active');
        AppState.currentPage = pageId;
        
        // 页面特定的初始化
        switch (pageId) {
            case 'queue':
                loadDownloadTasks();
                break;
            case 'history':
                loadDownloadHistory();
                break;
            case 'settings':
                loadSettings();
                break;
        }
    }
}

// ====================
// 下载页面功能
// ====================

/**
 * 粘贴剪贴板内容
 */
async function pasteFromClipboard() {
    try {
        const text = await navigator.clipboard.readText();
        const urlInput = document.getElementById('video-url');
        urlInput.value = text;
        urlInput.focus();
        
        // 自动解析视频信息
        if (text.includes('youtube.com') || text.includes('youtu.be')) {
            await parseVideoUrl(text);
        }
        
        showToast('已粘贴链接', 'success', 1500);
    } catch (err) {
        showToast('无法访问剪贴板', 'error');
    }
}

/**
 * 解析视频URL并显示预览
 */
async function parseVideoUrl(url) {
    const preview = document.getElementById('video-preview');
    
    try {
        showToast('正在解析视频信息...', 'info', 2000);
        
        const response = await fetchVideoInfo(url);
        const videoInfo = response.data;
        
        // 更新预览显示
        document.getElementById('preview-title').textContent = videoInfo.title;
        document.getElementById('preview-channel').textContent = videoInfo.channel;
        document.getElementById('preview-image').src = videoInfo.thumbnail;
        document.getElementById('preview-duration').textContent = formatTime(videoInfo.duration);
        document.getElementById('preview-views').textContent = `${parseInt(videoInfo.viewCount).toLocaleString()} 次观看`;
        document.getElementById('preview-upload-date').textContent = videoInfo.uploadDate;
        
        // 更新质量选项
        const qualitySelect = document.getElementById('video-quality');
        qualitySelect.innerHTML = '';
        
        if (videoInfo.availableQualities && videoInfo.availableQualities.length > 0) {
            qualitySelect.innerHTML += '<option value="best">最佳质量</option>';
            videoInfo.availableQualities.forEach(quality => {
                qualitySelect.innerHTML += `<option value="${quality}">${quality}</option>`;
            });
        } else {
            qualitySelect.innerHTML = `
                <option value="best">最佳质量</option>
                <option value="1080p">1080p</option>
                <option value="720p">720p</option>
                <option value="480p">480p</option>
            `;
        }
        
        preview.style.display = 'block';
        showToast('视频信息解析成功', 'success', 2000);
        
    } catch (error) {
        console.error('解析视频信息失败:', error);
        showToast(`解析失败: ${error.message}`, 'error');
        preview.style.display = 'none';
    }
}

/**
 * 开始下载
 */
async function startDownload() {
    const urlInput = document.getElementById('video-url');
    const quality = document.getElementById('video-quality').value;
    const format = document.getElementById('video-format').value;
    
    if (!urlInput.value.trim()) {
        showToast('请输入YouTube视频链接', 'warning');
        return;
    }
    
    // 检查服务器连接
    const isConnected = await checkServerConnection();
    if (!isConnected) {
        showToast('无法连接到下载服务，请确保后端服务已启动', 'error');
        console.log('请运行: npm install && npm start');
        return;
    }
    
    const downloadBtn = document.getElementById('start-download');
    const originalText = downloadBtn.innerHTML;
    
    try {
        // 显示加载状态
        downloadBtn.innerHTML = '<i data-feather="loader"></i><span>创建下载任务...</span>';
        downloadBtn.disabled = true;
        feather.replace();
        
        const response = await startDownloadRequest(urlInput.value.trim(), quality, format);
        
        showToast(`下载任务已创建: ${response.taskId}`, 'success');
        
        // 清空输入
        urlInput.value = '';
        document.getElementById('video-preview').style.display = 'none';
        
        // 跳转到队列页面
        setTimeout(() => {
            showPage('queue');
        }, 1500);
        
    } catch (error) {
        console.error('创建下载任务失败:', error);
        showToast(`下载失败: ${error.message}`, 'error');
    } finally {
        // 恢复按钮状态
        downloadBtn.innerHTML = originalText;
        downloadBtn.disabled = false;
        feather.replace();
    }
}

// ====================
// 队列页面功能
// ====================

/**
 * 加载下载任务
 */
async function loadDownloadTasks() {
    try {
        const response = await fetchDownloadTasks();
        AppState.downloads = response.data;
        updateQueueDisplay();
    } catch (error) {
        console.error('加载下载任务失败:', error);
        showToast('加载下载队列失败', 'error');
    }
}

/**
 * 更新队列显示
 */
function updateQueueDisplay() {
    const queueList = document.getElementById('queue-list');
    const activeDownloads = AppState.downloads.filter(d => d.status === 'downloading').length;
    const pendingDownloads = AppState.downloads.filter(d => d.status === 'pending').length;
    
    // 更新统计
    document.getElementById('active-downloads').textContent = activeDownloads;
    document.getElementById('pending-downloads').textContent = pendingDownloads;
    
    // 计算总体进度
    const totalProgress = AppState.downloads.length > 0 ? 
        AppState.downloads.reduce((sum, d) => sum + (d.progress || 0), 0) / AppState.downloads.length : 0;
    document.getElementById('overall-percentage').textContent = `${Math.round(totalProgress)}%`;
    document.getElementById('overall-progress-fill').style.width = `${totalProgress}%`;
    
    if (AppState.downloads.length === 0) {
        queueList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <i data-feather="inbox"></i>
                </div>
                <h3>队列为空</h3>
                <p>还没有下载任务，去添加一些视频吧！</p>
                <button class="secondary-btn" onclick="showPage('download')">
                    <i data-feather="plus"></i>
                    添加下载
                </button>
            </div>
        `;
    } else {
        queueList.innerHTML = AppState.downloads.map(createQueueItemHTML).join('');
    }
    
    feather.replace();
}

/**
 * 创建队列项目HTML
 */
function createQueueItemHTML(download) {
    return `
        <div class="queue-item">
            <div class="queue-item-header">
                <div class="queue-thumbnail">
                    <img src="${download.thumbnail}" alt="${download.title}" loading="lazy" 
                         onerror="this.src='https://via.placeholder.com/200x150?text=Video'">
                </div>
                <div class="queue-info">
                    <h4 title="${download.title}">${download.title}</h4>
                    <div class="queue-meta">
                        <span>${download.channel}</span>
                        <span>${download.quality}</span>
                        <span>${download.format?.toUpperCase()}</span>
                        <span class="status-badge ${download.status}">${getStatusText(download.status)}</span>
                    </div>
                </div>
                <div class="queue-actions">
                    ${download.status === 'completed' ? 
                        `<button class="action-btn" onclick="downloadFile('${download.id}')" title="下载文件">
                            <i data-feather="download"></i>
                        </button>` : ''
                    }
                    <button class="action-btn danger" onclick="removeDownload('${download.id}')" title="删除任务">
                        <i data-feather="trash-2"></i>
                    </button>
                </div>
            </div>
            <div class="queue-progress">
                <div class="progress-header">
                    <span class="progress-percentage">${Math.round(download.progress || 0)}%</span>
                    <span class="progress-speed">${download.speed || '0 MB/s'}</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${download.progress || 0}%"></div>
                </div>
                ${download.error ? `<div class="error-message" style="color: var(--error-red); font-size: 12px; margin-top: 8px;">${download.error}</div>` : ''}
            </div>
        </div>
    `;
}

/**
 * 获取状态文本
 */
function getStatusText(status) {
    const statusMap = {
        pending: '等待中',
        downloading: '下载中',
        paused: '已暂停',
        completed: '已完成',
        failed: '失败',
        cancelled: '已取消'
    };
    return statusMap[status] || status;
}

/**
 * 下载完成的文件
 */
function downloadFile(taskId) {
    const task = AppState.downloads.find(d => d.id === taskId);
    if (task && task.status === 'completed') {
        // 直接打开下载链接
        window.open(`${API_BASE_URL}/download-file/${encodeURIComponent(task.filename || task.title + '.mp4')}`, '_blank');
        showToast('开始下载文件...', 'success');
    } else {
        showToast('文件不可用', 'error');
    }
}

/**
 * 删除下载任务
 */
async function removeDownload(taskId) {
    if (!confirm('确定要删除这个下载任务吗？')) {
        return;
    }
    
    try {
        await cancelDownloadTask(taskId);
        await loadDownloadTasks(); // 重新加载任务列表
        showToast('任务已删除', 'success');
    } catch (error) {
        console.error('删除任务失败:', error);
        showToast(`删除失败: ${error.message}`, 'error');
    }
}

/**
 * 开始轮询更新队列状态
 */
function startPolling() {
    if (AppState.pollingInterval) {
        clearInterval(AppState.pollingInterval);
    }
    
    AppState.pollingInterval = setInterval(async () => {
        if (AppState.currentPage === 'queue') {
            await loadDownloadTasks();
        }
    }, 2000); // 每2秒更新一次
}

/**
 * 停止轮询
 */
function stopPolling() {
    if (AppState.pollingInterval) {
        clearInterval(AppState.pollingInterval);
        AppState.pollingInterval = null;
    }
}

// ====================
// 历史记录页面功能
// ====================

/**
 * 加载下载历史
 */
async function loadDownloadHistory() {
    try {
        const searchTerm = document.getElementById('history-search').value;
        const response = await fetchDownloadHistory(searchTerm);
        AppState.history = response.data;
        updateHistoryDisplay();
        
        // 同时更新统计数据
        await updateHistoryStats();
    } catch (error) {
        console.error('加载历史记录失败:', error);
        showToast('加载历史记录失败', 'error');
    }
}

/**
 * 更新历史记录显示
 */
function updateHistoryDisplay() {
    const historyList = document.getElementById('history-list');
    const searchTerm = document.getElementById('history-search').value.toLowerCase();
    const filter = document.getElementById('history-filter').value;
    
    let filteredHistory = [...AppState.history];
    
    // 时间过滤
    if (filter !== 'all') {
        const now = new Date();
        const filterDate = new Date();
        
        switch (filter) {
            case 'today':
                filterDate.setDate(now.getDate());
                break;
            case 'week':
                filterDate.setDate(now.getDate() - 7);
                break;
            case 'month':
                filterDate.setMonth(now.getMonth() - 1);
                break;
        }
        
        filteredHistory = filteredHistory.filter(item => 
            new Date(item.downloadDate) >= filterDate
        );
    }
    
    if (filteredHistory.length === 0) {
        historyList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <i data-feather="clock"></i>
                </div>
                <h3>暂无历史记录</h3>
                <p>开始下载一些视频，建立你的学习资料库吧！</p>
            </div>
        `;
    } else {
        historyList.innerHTML = filteredHistory.map(createHistoryItemHTML).join('');
    }
    
    feather.replace();
}

/**
 * 创建历史记录项目HTML
 */
function createHistoryItemHTML(item) {
    return `
        <div class="history-item">
            <div class="history-thumbnail">
                <img src="${item.thumbnail}" alt="${item.title}" loading="lazy" 
                     onerror="this.src='https://via.placeholder.com/300x200?text=Video'">
                <div class="history-overlay">
                    <button class="action-btn" onclick="downloadHistoryFile('${item.id}')" title="下载文件">
                        <i data-feather="download"></i>
                    </button>
                    <button class="action-btn danger" onclick="deleteHistory('${item.id}')" title="删除记录">
                        <i data-feather="trash-2"></i>
                    </button>
                </div>
            </div>
            <div class="history-content">
                <h4 title="${item.title}">${item.title}</h4>
                <div class="history-meta">
                    <span><i data-feather="user"></i> ${item.channel}</span>
                    <span><i data-feather="calendar"></i> ${formatDate(item.downloadDate)}</span>
                    <span><i data-feather="hard-drive"></i> ${item.size}</span>
                    <span><i data-feather="video"></i> ${item.quality} ${item.format?.toUpperCase()}</span>
                </div>
            </div>
        </div>
    `;
}

/**
 * 格式化日期
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return '今天';
    if (diffDays === 2) return '昨天';
    if (diffDays <= 7) return `${diffDays}天前`;
    
    return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

/**
 * 更新历史统计
 */
async function updateHistoryStats() {
    try {
        const response = await fetchStats();
        const stats = response.data;
        
        document.getElementById('total-downloads').textContent = stats.totalDownloads;
        document.getElementById('total-size').textContent = stats.totalSize;
        document.getElementById('this-month').textContent = stats.thisMonth;
        
        AppState.statistics = stats;
    } catch (error) {
        console.error('更新统计失败:', error);
    }
}

/**
 * 下载历史文件
 */
function downloadHistoryFile(itemId) {
    const item = AppState.history.find(h => h.id === itemId);
    if (item) {
        window.open(`${API_BASE_URL}/download-file/${encodeURIComponent(item.filename)}`, '_blank');
        showToast('开始下载文件...', 'success');
    } else {
        showToast('文件不存在', 'error');
    }
}

/**
 * 删除历史记录
 */
async function deleteHistory(itemId) {
    if (!confirm('确定要删除这条历史记录吗？文件也会被删除。')) {
        return;
    }
    
    try {
        await deleteHistoryItem(itemId);
        await loadDownloadHistory(); // 重新加载历史
        showToast('历史记录已删除', 'success');
    } catch (error) {
        console.error('删除历史记录失败:', error);
        showToast(`删除失败: ${error.message}`, 'error');
    }
}

// ====================
// 设置页面功能
// ====================

/**
 * 加载设置
 */
function loadSettings() {
    document.getElementById('download-path').value = AppState.settings.downloadPath;
    document.getElementById('default-quality').value = AppState.settings.defaultQuality;
    document.getElementById('concurrent-downloads').value = AppState.settings.concurrentDownloads;
    document.getElementById('theme-mode').value = AppState.settings.themeMode;
    document.getElementById('enable-animations').checked = AppState.settings.enableAnimations;
    document.getElementById('retry-count').value = AppState.settings.retryCount;
    document.getElementById('history-retention').value = AppState.settings.historyRetention;
}

/**
 * 保存设置
 */
function saveSettings() {
    AppState.settings = {
        downloadPath: document.getElementById('download-path').value,
        defaultQuality: document.getElementById('default-quality').value,
        concurrentDownloads: parseInt(document.getElementById('concurrent-downloads').value),
        themeMode: document.getElementById('theme-mode').value,
        enableAnimations: document.getElementById('enable-animations').checked,
        retryCount: parseInt(document.getElementById('retry-count').value),
        historyRetention: parseInt(document.getElementById('history-retention').value)
    };
    
    // 保存到localStorage
    localStorage.setItem('ytdownloader-settings', JSON.stringify(AppState.settings));
    
    // 应用主题设置
    applyTheme(AppState.settings.themeMode);
    
    showToast('设置已保存', 'success');
}

/**
 * 重置设置
 */
function resetSettings() {
    if (confirm('确定要恢复默认设置吗？')) {
        AppState.settings = {
            downloadPath: '~/Downloads',
            defaultQuality: 'best',
            concurrentDownloads: 3,
            themeMode: 'light',
            enableAnimations: true,
            retryCount: 3,
            historyRetension: 90
        };
        loadSettings();
        localStorage.removeItem('ytdownloader-settings');
        showToast('设置已重置为默认值', 'info');
    }
}

/**
 * 选择下载路径
 */
function choosePath() {
    showToast('下载路径由服务器配置决定', 'info', 2000);
}

/**
 * 应用主题
 */
function applyTheme(theme) {
    if (theme === 'dark') {
        document.body.classList.add('dark-theme');
    } else {
        document.body.classList.remove('dark-theme');
    }
}

// ====================
// 应用初始化
// ====================

/**
 * 初始化应用
 */
async function initializeApp() {
    // 初始化Feather图标
    feather.replace();
    
    // 从localStorage加载设置
    const savedSettings = localStorage.getItem('ytdownloader-settings');
    if (savedSettings) {
        try {
            AppState.settings = { ...AppState.settings, ...JSON.parse(savedSettings) };
        } catch (error) {
            console.error('加载保存的设置失败:', error);
        }
    }
    
    // 应用主题
    applyTheme(AppState.settings.themeMode);
    
    // 设置事件监听器
    setupEventListeners();
    
    // 显示默认页面
    showPage('download');
    
    // 检查服务器连接
    const isConnected = await checkServerConnection();
    if (!isConnected) {
        showToast('未连接到下载服务，某些功能可能不可用', 'warning', 5000);
        console.warn('后端服务未启动，请运行: npm install && npm start');
    } else {
        showToast('下载服务已连接', 'success', 2000);
        // 开始轮询更新
        startPolling();
    }
    
    console.log('YouTube学习视频下载器已初始化');
}

/**
 * 设置事件监听器
 */
function setupEventListeners() {
    // 导航标签点击
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            showPage(tab.dataset.tab);
        });
    });
    
    // 设置按钮点击
    document.querySelector('.settings-btn').addEventListener('click', () => {
        showPage('settings');
    });
    
    // 粘贴按钮
    document.getElementById('paste-btn').addEventListener('click', pasteFromClipboard);
    
    // 下载按钮
    document.getElementById('start-download').addEventListener('click', startDownload);
    
    // URL输入框变化
    document.getElementById('video-url').addEventListener('input', debounce((e) => {
        const url = e.target.value.trim();
        if (url && (url.includes('youtube.com') || url.includes('youtu.be'))) {
            parseVideoUrl(url);
        } else {
            document.getElementById('video-preview').style.display = 'none';
        }
    }, 1000));
    
    // 历史记录搜索
    document.getElementById('history-search').addEventListener('input', debounce(() => {
        loadDownloadHistory();
    }, 500));
    
    // 历史记录过滤
    document.getElementById('history-filter').addEventListener('change', () => {
        updateHistoryDisplay();
    });
    
    // 设置相关按钮
    document.getElementById('choose-path').addEventListener('click', choosePath);
    document.getElementById('save-settings').addEventListener('click', saveSettings);
    document.getElementById('reset-settings').addEventListener('click', resetSettings);
    
    // 键盘快捷键
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case '1':
                    e.preventDefault();
                    showPage('download');
                    break;
                case '2':
                    e.preventDefault();
                    showPage('queue');
                    break;
                case '3':
                    e.preventDefault();
                    showPage('history');
                    break;
                case '4':
                    e.preventDefault();
                    showPage('settings');
                    break;
            }
        }
    });
    
    // 页面可见性变化
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            stopPolling();
        } else {
            startPolling();
        }
    });
    
    // 底部状态更新
    setInterval(updateAppStatus, 5000);
}

/**
 * 防抖函数
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * 更新应用状态
 */
async function updateAppStatus() {
    try {
        const response = await fetchStats();
        const stats = response.data;
        
        document.getElementById('app-status').textContent = 
            stats.activeDownloads > 0 ? `${stats.activeDownloads}个下载中` : '就绪';
        document.getElementById('download-count').textContent = stats.totalDownloads;
    } catch (error) {
        // 静默处理错误，避免频繁弹窗
        document.getElementById('app-status').textContent = '离线';
    }
}

// ====================
// 应用启动
// ====================

// 等待DOM加载完成后初始化应用
document.addEventListener('DOMContentLoaded', initializeApp);

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
    stopPolling();
});

// 导出全局函数供HTML调用
window.showPage = showPage;
window.pasteFromClipboard = pasteFromClipboard;
window.startDownload = startDownload;
window.removeDownload = removeDownload;
window.downloadFile = downloadFile;
window.downloadHistoryFile = downloadHistoryFile;
window.deleteHistory = deleteHistory;
window.choosePath = choosePath;
window.saveSettings = saveSettings;
window.resetSettings = resetSettings;
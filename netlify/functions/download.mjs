import ytdl from '@distube/ytdl-core';
import sanitize from 'sanitize-filename';

export default async (req, context) => {
    // 设置CORS头
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // 处理预检请求
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers });
    }

    if (req.method !== 'POST') {
        return new Response(
            JSON.stringify({ success: false, error: 'Method not allowed' }),
            { status: 405, headers }
        );
    }

    try {
        const body = await req.json();
        const { url, quality, format } = body;
        
        console.log('📡 收到下载请求:', { url, quality, format });
        
        if (!url || !ytdl.validateURL(url)) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: '无效的YouTube视频链接'
                }),
                { status: 400, headers }
            );
        }

        // 获取视频信息
        const info = await ytdl.getInfo(url);
        const videoDetails = info.videoDetails;
        
        // 获取指定格式
        let selectedFormat;
        if (quality && quality !== 'best') {
            selectedFormat = ytdl.chooseFormat(info.formats, { 
                quality: quality,
                filter: format === 'mp3' ? 'audioonly' : 'videoandaudio'
            });
        } else {
            selectedFormat = ytdl.chooseFormat(info.formats, { 
                quality: 'highest',
                filter: format === 'mp3' ? 'audioonly' : 'videoandaudio'
            });
        }
        
        if (!selectedFormat) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: '未找到合适的视频格式'
                }),
                { status: 400, headers }
            );
        }
        
        const filename = sanitize(`${videoDetails.title}.${selectedFormat.container}`);
        
        // 生成任务ID
        const taskId = Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
        
        console.log('✅ 下载链接生成成功:', taskId);
        
        // 返回下载信息
        return new Response(
            JSON.stringify({
                success: true,
                data: {
                    taskId: taskId,
                    filename: filename,
                    title: videoDetails.title,
                    downloadUrl: selectedFormat.url,
                    directDownload: true,
                    message: '点击下方链接开始下载'
                }
            }),
            { status: 200, headers }
        );
        
    } catch (error) {
        console.error('❌ 下载请求处理失败:', error);
        return new Response(
            JSON.stringify({
                success: false,
                error: error.message || '下载请求处理失败'
            }),
            { status: 500, headers }
        );
    }
};
import ytdl from '@distube/ytdl-core';
import sanitize from 'sanitize-filename';

export default async (req, context) => {
    // 设置CORS头
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    };

    // 处理预检请求
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers });
    }

    if (req.method !== 'GET') {
        return new Response('Method not allowed', { status: 405, headers });
    }

    try {
        const url = new URL(req.url);
        const videoUrl = url.searchParams.get('url');
        const quality = url.searchParams.get('quality') || 'highest';
        const format = url.searchParams.get('format') || 'mp4';
        
        if (!videoUrl || !ytdl.validateURL(videoUrl)) {
            return new Response('Invalid YouTube URL', { status: 400, headers });
        }

        // 获取视频信息
        const info = await ytdl.getInfo(videoUrl);
        const videoDetails = info.videoDetails;
        
        // 选择格式
        let selectedFormat;
        if (quality !== 'highest') {
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
            return new Response('No suitable format found', { status: 400, headers });
        }
        
        const filename = sanitize(`${videoDetails.title}.${selectedFormat.container}`);
        
        // 创建下载流
        const videoStream = ytdl(videoUrl, { format: selectedFormat });
        
        // 设置下载响应头
        const downloadHeaders = {
            ...headers,
            'Content-Type': 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Transfer-Encoding': 'chunked'
        };
        
        // 使用Response streaming API
        const readableStream = new ReadableStream({
            start(controller) {
                videoStream.on('data', (chunk) => {
                    controller.enqueue(chunk);
                });
                
                videoStream.on('end', () => {
                    controller.close();
                });
                
                videoStream.on('error', (error) => {
                    console.error('Stream error:', error);
                    controller.error(error);
                });
            }
        });
        
        return new Response(readableStream, {
            status: 200,
            headers: downloadHeaders
        });
        
    } catch (error) {
        console.error('❌ 流式下载失败:', error);
        return new Response('Download failed', { status: 500, headers });
    }
};
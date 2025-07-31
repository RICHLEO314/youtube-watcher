import ytdl from '@distube/ytdl-core';

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
        const { url } = body;
        
        console.log('📡 收到视频信息请求:', url);
        
        if (!url || !ytdl.validateURL(url)) {
            console.log('❌ 无效的YouTube链接:', url);
            return new Response(
                JSON.stringify({
                    success: false,
                    error: '无效的YouTube视频链接'
                }),
                { status: 400, headers }
            );
        }

        console.log('🔍 正在获取视频信息...');
        
        // 获取视频信息
        let info;
        try {
            info = await ytdl.getInfo(url, {
                requestOptions: {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    }
                }
            });
        } catch (primaryError) {
            console.log('⚠️ 主要方法获取视频信息失败，尝试简化方法...');
            info = await ytdl.getInfo(url);
        }
        
        const videoDetails = info.videoDetails;
        const formats = ytdl.filterFormats(info.formats, 'videoandaudio');
        
        console.log('✅ 视频信息获取成功:', videoDetails.title);
        
        const videoInfo = {
            success: true,
            data: {
                id: videoDetails.videoId,
                title: videoDetails.title,
                description: videoDetails.shortDescription,
                thumbnail: videoDetails.thumbnails[videoDetails.thumbnails.length - 1]?.url,
                duration: parseInt(videoDetails.lengthSeconds),
                author: videoDetails.author.name,
                views: parseInt(videoDetails.viewCount),
                uploadDate: videoDetails.publishDate,
                formats: formats.slice(0, 5).map(format => ({
                    itag: format.itag,
                    quality: format.qualityLabel || format.quality,
                    container: format.container,
                    hasVideo: format.hasVideo,
                    hasAudio: format.hasAudio,
                    filesize: format.contentLength ? parseInt(format.contentLength) : null
                }))
            }
        };
        
        return new Response(
            JSON.stringify(videoInfo),
            { status: 200, headers }
        );
        
    } catch (error) {
        console.error('❌ 获取视频信息失败:', error);
        return new Response(
            JSON.stringify({
                success: false,
                error: error.message || '获取视频信息失败'
            }),
            { status: 500, headers }
        );
    }
};
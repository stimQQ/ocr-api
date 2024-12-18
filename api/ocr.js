const fetch = require('node-fetch');

// 百度 OCR API 配置
const API_KEY = process.env.BAIDU_API_KEY;
const SECRET_KEY = process.env.BAIDU_SECRET_KEY;

// 缓存 token
let accessToken = null;
let tokenExpireTime = 0;

// 获取百度 access token
async function getAccessToken() {
  // 如果token未过期，直接返回
  if (accessToken && Date.now() < tokenExpireTime) {
    return accessToken;
  }

  try {
    const response = await fetch(
      `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${API_KEY}&client_secret=${SECRET_KEY}`
    );

    const data = await response.json();
    
    if (data.access_token) {
      accessToken = data.access_token;
      // 提前一小时过期
      tokenExpireTime = Date.now() + (data.expires_in * 1000) - 3600000;
      return accessToken;
    } else {
      throw new Error('Failed to get access token');
    }
  } catch (error) {
    console.error('Get token error:', error);
    throw error;
  }
}

// 主处理函数
module.exports = async (req, res) => {
  // 添加 CORS 头部
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // 处理 OPTIONS 请求
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 只处理 POST 请求
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // 检查请求体
    if (!req.body || !req.body.image) {
      throw new Error('Missing image data');
    }

    const { image } = req.body;

    // 获取token
    const token = await getAccessToken();

    // 调用百度OCR API
    const response = await fetch(
      `https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic?access_token=${token}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: `image=${encodeURIComponent(image)}`
      }
    );

    if (!response.ok) {
      throw new Error(`Baidu API error: ${response.status}`);
    }

    const result = await response.json();

    // 检查百度API返回的错误
    if (result.error_code) {
      throw new Error(result.error_msg || 'Baidu API error');
    }

    // 返回识别结果
    res.json(result);
  } catch (error) {
    console.error('OCR Error:', error);
    res.status(500).json({ 
      error: error.message,
      detail: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

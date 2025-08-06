const express = require('express');
const axios = require('axios');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors({
    origin: '*', // للتجربة الآن، لاحقاً نغيرها لdomain محدد
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json({ limit: '10mb' }));

// Rate limiting - حماية من الاستخدام المفرط
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // حد أقصى 10 طلبات لكل 15 دقيقة لكل IP
    message: {
        error: "Too many requests, please try again after 15 minutes.",
        code: "RATE_LIMIT_EXCEEDED"
    }
});

app.use('/api/', limiter);

// Health check endpoint
app.get('/', (req, res) => {
    res.json({
        status: 'active',
        message: 'EcoVista Wallpaper API is running',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

// Main wallpaper generation endpoint
app.post('/api/v1/generate-wallpaper', async (req, res) => {
    try {
        console.log('🎨 New wallpaper generation request received');
        
        const { prompt, user_id, app_version } = req.body;
        
        // التحقق من البيانات الواردة
        if (!prompt || prompt.trim().length < 3) {
            return res.status(400).json({
                error: "Please provide a detailed description (at least 3 characters)",
                code: "INVALID_PROMPT"
            });
        }
        
        if (prompt.length > 500) {
            return res.status(400).json({
                error: "Description too long. Please keep it under 500 characters",
                code: "PROMPT_TOO_LONG"
            });
        }
        
        // تحسين الـ prompt للطبيعة
        const enhancedPrompt = `${prompt}, beautiful nature wallpaper, high quality, mobile phone wallpaper, 4K, detailed, stunning, peaceful natural scenery`;
        
        console.log('📝 Enhanced prompt:', enhancedPrompt);
        console.log('👤 User ID:', user_id);
        
        // استدعاء DumplingAI API
        const response = await axios.post('https://app.dumplingai.com/api/v1/generate-ai-image', {
            model: "FLUX.1-schnell",
            input: {
                prompt: enhancedPrompt,
                num_outputs: 1,
                aspect_ratio: "9:16",
                output_format: "webp",
                output_quality: 90
            }
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.DUMPLING_AI_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 60000
        });
        
        console.log('✅ DumplingAI response received');
        
        // معالجة الاستجابة
        let imageURL = null;
        
        if (response.data.images && response.data.images.length > 0) {
            imageURL = response.data.images[0].url;
        } else if (response.data.output && response.data.output.length > 0) {
            imageURL = response.data.output[0];
        }
        
        if (!imageURL) {
            console.error('❌ No image URL found in response');
            return res.status(500).json({
                error: "Failed to generate wallpaper. Please try a different description.",
                code: "NO_IMAGE_GENERATED"
            });
        }
        
        console.log('🔗 Generated image URL:', imageURL);
        
        // إرسال الاستجابة الناجحة
        res.json({
            success: true,
            image_url: imageURL,
            prompt_used: enhancedPrompt,
            user_id: user_id,
            generation_time: new Date().toISOString(),
            message: "Beautiful nature wallpaper generated successfully!"
        });
        
    } catch (error) {
        console.error('❌ Error generating wallpaper:', error.message);
        
        let errorMessage = "AI service temporarily unavailable. Please try again later.";
        let errorCode = "SERVICE_ERROR";
        let statusCode = 500;
        
        if (error.response) {
            const status = error.response.status;
            const data = error.response.data;
            
            console.error('🔴 DumplingAI API Error:', status, data);
            
            if (status === 401) {
                errorMessage = "Service authentication error. Please contact support.";
                errorCode = "AUTH_ERROR";
                statusCode = 503;
            } else if (status === 429) {
                errorMessage = "Daily AI generation limit reached. Please try again tomorrow!";
                errorCode = "RATE_LIMIT";
                statusCode = 429;
            } else if (status === 400) {
                errorMessage = "Invalid request. Please try a different description.";
                errorCode = "INVALID_REQUEST";
                statusCode = 400;
            }
        }
        
        res.status(statusCode).json({
            error: errorMessage,
            code: errorCode,
            timestamp: new Date().toISOString()
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 EcoVista Wallpaper API running on port ${PORT}`);
    console.log(`⚡ Ready to generate beautiful nature wallpapers!`);
});

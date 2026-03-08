export default async function handler(req, res) {
    // Hanya izinkan method POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { mimeType, base64Data } = req.body;

    if (!base64Data || !mimeType) {
        return res.status(400).json({ error: 'Data gambar tidak ditemukan' });
    }

    // Mengambil API Key secara aman dari Environment Variable Vercel
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'Server misconfiguration: API key missing' });
    }

    const systemPrompt = `Tindak lanjuti gambar ini sebagai seorang Kurator Microstock Profesional. Berikan respon dalam format JSON murni. Jadilah pengkritik yang tajam (jangan jadi yes-man). Analisis anatomi, pencahayaan, logika perspektif, dan terutama temukan cacat hasil generasi AI (AI artifacts) sekecil apapun. Jika ada cacat, sebutkan di mana letaknya, dan berikan solusi teknis bagaimana memperbaikinya (misalnya di Photoshop/cropping) sebelum dijual ke microstock.`;

    const userQuery = `Berikan:\n1. Judul deskriptif dan SEO-friendly dalam Bahasa INGGRIS (maksimal 15 kata).\n2. Tepat 49 kata kunci relevan dalam Bahasa INGGRIS, dipisahkan hanya dengan koma. Urutkan dari yang paling spesifik ke yang paling umum.\n3. Evaluasi dan Kritik Solutif dalam Bahasa INDONESIA mengenai gambar ini.`;

    const payload = {
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{
            role: "user",
            parts: [
                { text: userQuery },
                { inlineData: { mimeType: mimeType, data: base64Data } }
            ]
        }],
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: "OBJECT",
                properties: {
                    title: { type: "STRING" },
                    keywords: { type: "STRING" },
                    critique: { type: "STRING" }
                },
                required: ["title", "keywords", "critique"]
            }
        }
    };

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Gemini API Error: ${response.status} - ${errText}`);
        }

        const data = await response.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!rawText) throw new Error("Invalid response format from AI");

        // Pembersihan JSON yang ketat untuk mengantisipasi markdown backticks
        const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        const resultJson = JSON.parse(cleaned);

        return res.status(200).json(resultJson);

    } catch (error) {
        console.error("Backend Error:", error);
        return res.status(500).json({ error: error.message });
    }
}